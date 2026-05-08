#!/bin/bash
# ==========================================
# 1. 環境變數
# ==========================================
CONTROLLER_URL=https://logger.kmn.tw:7318/api/upload-logs

TIME_SYSLOG=$(date -d "1 hour ago" '+%b %e %H')
TIME_ISO=$(date -d "1 hour ago" '+%Y-%m-%d %H')

echo "[$(date)] 🚀 啟動 Log 分析任務... (目標: $CONTROLLER_URL)" >> /proc/1/fd/1

# ==========================================
# 2. 深度安全與網路分析
# ==========================================
AUTH_FAILS=$(grep "$TIME_SYSLOG" /var/log/auth.log 2>/dev/null | grep -c "Failed password")
TOP_ATTACKERS=$(grep "$TIME_SYSLOG" /var/log/auth.log 2>/dev/null | grep "Failed password" | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr | head -n 3 | awk '{print "{\"ip\":\""$2"\", \"count\":"$1"}"}' | paste -sd "," -)
AUTH_SUCCESS=$(grep "$TIME_SYSLOG" /var/log/auth.log 2>/dev/null | grep -c "Accepted")
SUCCESS_IPS=$(grep "$TIME_SYSLOG" /var/log/auth.log 2>/dev/null | grep "Accepted" | awk '{for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' | sort | uniq -c | sort -nr | head -n 5 | awk '{print "{\"ip\":\""$2"\", \"count\":"$1"}"}' | paste -sd "," -)
F2B_BANS=$(grep "$TIME_ISO" /var/log/fail2ban.log 2>/dev/null | grep -c "Ban")
UFW_BLOCKS=$(grep "$TIME_SYSLOG" /var/log/ufw.log 2>/dev/null | grep -c "BLOCK")
TOP_PORTS=$(grep "$TIME_SYSLOG" /var/log/ufw.log 2>/dev/null | grep "UFW BLOCK" | grep -o "DPT=[0-9]*" | awk -F= '{print $2}' | sort | uniq -c | sort -nr | head -n 3 | awk '{print "{\"port\":"$2", \"count\":"$1"}"}' | paste -sd "," -)

# ==========================================
# 3. 系統健康度與變動
# ==========================================
SYS_ERRORS=$(grep "$TIME_SYSLOG" /var/log/syslog 2>/dev/null | grep -i -c "error\|critical")
OOM_KILLS=$(grep "$TIME_SYSLOG" /var/log/kern.log 2>/dev/null | grep -i -c "Out of memory")
PKG_INSTALLS=$(grep "$TIME_ISO" /var/log/dpkg.log 2>/dev/null | grep -c "install ")

# ==========================================
# 4. Docker 容器錯誤日誌掃描
# ==========================================
DOCKER_ERRORS=0
CONTAINERS=$(docker ps --format '{{.Names}}' | grep -v "log-agent")

for container in $CONTAINERS; do
    ERR_COUNT=$(docker logs --since 1h "$container" 2>&1 | grep -i -c "error\|exception\|fail")
    if [ "$ERR_COUNT" -gt 0 ]; then
        DOCKER_ERRORS=$((DOCKER_ERRORS + ERR_COUNT))
    fi
done


# ==========================================
# 資源收集區 (CPU, RAM, Disk)
# ==========================================

# 1. CPU 使用率 (%) - 取 1 秒內的平均值
# 邏輯：100% 減去 idle (空閒) 的比例
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

# 2. 記憶體使用率 (%)
# 邏輯：(已使用 / 總量) * 100
MEM_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}')

# 3. 硬碟使用率 (%) - 根目錄
echo "  ├─ 💾 正在掃描所有實體掛載點..."

# 1. 取得硬碟使用率，過濾掉虛擬掛載點，並轉成 JSON 陣列格式
# 格式會變成類似: [{"mount":"/", "usage":50}, {"mount":"/mnt/data", "usage":90}]
# 1. 取得硬碟使用率，過濾掉虛擬掛載點以及 /snap 相關路徑
DISK_INFO_JSON=$(df -P | grep -vE '^Filesystem|tmpfs|devtmpfs|overlay|shm|squashfs|loop|/snap' | awk '{gsub("%","",$5); printf "{\"mount\":\"%s\", \"usage\":%s},", $6, $5}' | sed 's/,$//')
DISK_USAGE="[$DISK_INFO_JSON]"

# 2. 在終端機印出所有掛載點的狀態 (方便手動測試時觀看)
df -hP | grep -vE '^Filesystem|tmpfs|devtmpfs|overlay|shm|squashfs|loop|/snap' | while read -r line; do
    MOUNT_PT=$(echo "$line" | awk '{print $6}')
    USAGE_PCT=$(echo "$line" | awk '{print $5}')
    echo "  │  ├─ 磁碟 $MOUNT_PT: $USAGE_PCT"
done
# ------------------------------------------------
# 顯示分析過程 (用於手動執行時查看)
# ------------------------------------------------
echo "📊 [資源狀態監控]"
echo "  ├─ 💻 CPU 使用率: ${CPU_USAGE}%"
echo "  ├─ 🧠 記憶體使用率: ${MEM_USAGE}%"
echo "  └─ 💾 硬碟使用率: ${DISK_USAGE}%"

# ==========================================
# 5. 組裝 JSON Payload 
# ==========================================
JSON_PAYLOAD=$(cat <<EOF
{
    "security": {
        "authFails": ${AUTH_FAILS:-0},
        "authSuccess": ${AUTH_SUCCESS:-0},
        "topAttackers": [${TOP_ATTACKERS}],
        "successIps": [${SUCCESS_IPS}],
        "fail2banBans": ${F2B_BANS:-0},
        "ufwBlocks": ${UFW_BLOCKS:-0},
        "topScannedPorts": [${TOP_PORTS}]
    },
    "health": {
        "cpuUsage": $CPU_USAGE,
        "memUsage": $MEM_USAGE,
        "diskUsage": $DISK_USAGE,
        "syslogErrors": ${SYS_ERRORS:-0},
        "oomKills": ${OOM_KILLS:-0},
        "dockerErrors": ${DOCKER_ERRORS:-0}
    },
    "changes": {
        "packageInstalls": ${PKG_INSTALLS:-0}
    },
    "timestamp": "$(date -Iseconds)"
}
EOF
)

# ==========================================
# 6. 發送至 Node.js 控制器
# ==========================================
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$CONTROLLER_URL" \
     -H "Content-Type: application/json" \
     -d "$JSON_PAYLOAD")

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "[$(date)] ✅ 報告上傳成功" >> /proc/1/fd/1
else
    echo "[$(date)] ❌ 報告上傳失敗 (HTTP 狀態碼: $HTTP_STATUS)" >> /proc/1/fd/1
fi