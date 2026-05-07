# 使用 Ubuntu 22.04
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# 新增 docker.io 來提供 docker CLI 工具
RUN apt-get update && \
    apt-get install -y cron curl tzdata docker.io && \
    rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Taipei
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

COPY log_analyzer.sh /app/log_analyzer.sh
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/log_analyzer.sh /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]