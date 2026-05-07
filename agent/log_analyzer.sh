#!/bin/bash
# 【新增這一行】強制讓這個腳本內的所有 docker 指令都用 1.41 版去溝通
export DOCKER_API_VERSION=1.41
# ==========================================
# 1. 檢查與讀取環境變數
# ==========================================
# 強制從環境變數讀取，不再設定硬體碼預設值
if [ -z "$CONTROLLER_URL" ]; then
    echo "[$(date)] ❌ 錯誤：未提供 CONTROLLER_URL 環境變數！請檢查 docker-compose.yml 設定。" >> /proc/1/fd/1
    exit 1
fi

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