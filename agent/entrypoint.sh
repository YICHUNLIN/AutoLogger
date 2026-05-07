#!/bin/bash
set -e

# 1. 將 Docker 的環境變數導出，讓 Cron 執行時讀得到
printenv | grep -v "no_proxy" > /etc/environment

# 2. 建立 Crontab 任務
# 設定每小時的第 0 分鐘執行，並把輸出導向 Docker 的標準輸出 (這樣 docker logs 才看得到)
echo "0 * * * * root . /etc/environment; /app/log_analyzer.sh > /proc/1/fd/1 2>&1" > /etc/cron.d/log_cron

# 3. 設定正確權限並載入
chmod 0644 /etc/cron.d/log_cron
crontab /etc/cron.d/log_cron

echo "🚀 Docker Agent 啟動成功！Cron 排程已載入 (每小時整點執行)。"

# 4. 在前景執行 Cron (防止 Container 結束)
exec cron -f