#!/bin/bash
# ==========================================
# 1. 環境變數
# ==========================================
CONTROLLER_URL=https://logger.kmn.tw:7318/api/ods

# ==========================================
# 5. 組裝 JSON Payload 
# ==========================================
JSON_PAYLOAD=$(cat <<EOF
{
    "timestamp": "$(date -Iseconds)",
    "message":"test1234"
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