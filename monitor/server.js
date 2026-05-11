require('dotenv').config();
const Context = require('./context');
const ctx = new Context()
const express = require('express');
const cors = require('cors')
const app = express();
// 白名單檔案的路徑 (對應 docker-compose 掛載進來的位置)
// 【重要】信任 Nginx 等反向代理，確保 req.ip 取得的是真實客戶端 IP
app.set('trust proxy', true);
app.use(express.json());

const PORT = process.env.PORT || 3000;

require('./api')(ctx, app, [cors()])

// ==========================================
// 啟動伺服器
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Monitor 控制器啟動成功，正在監聽 Port ${PORT}`);
    console.log(`🛡️ 信任代理 (Trust Proxy): 啟用`);
});