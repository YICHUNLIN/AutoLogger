# 使用 Ubuntu 22.04
FROM ubuntu:22.04

# 設定非互動模式，避免安裝卡住
ENV DEBIAN_FRONTEND=noninteractive

# 【關鍵修復】移除導致報錯的 docker-clean 腳本，避免 APT 執行完畢後報錯
RUN rm -f /etc/apt/apt.conf.d/docker-clean

# 安裝所需套件
RUN apt-get update && \
    apt-get install -y cron curl tzdata docker.io && \
    rm -rf /var/lib/apt/lists/*

# 設定時區
ENV TZ=Asia/Taipei
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# 複製腳本進入容器
COPY log_analyzer.sh /app/log_analyzer.sh
COPY entrypoint.sh /app/entrypoint.sh

# 給予執行權限
RUN chmod +x /app/log_analyzer.sh /app/entrypoint.sh

# 啟動 Entrypoint
CMD ["/app/entrypoint.sh"]