FROM node:20-slim
WORKDIR /app

# 複製 package.json 並安裝套件
COPY package*.json ./
RUN npm install

# 複製程式碼
COPY . .

# 曝露 Port (供 Docker 內部網路使用)
EXPOSE 3000

CMD ["node", "server.js"]