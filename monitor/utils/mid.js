
const fs = require('fs');       // 【新增】檔案系統模組
const path = require('path');   // 【新增】路徑處理模組
const WHITELIST_PATH = path.join(process.cwd(), 'whitelist.txt');
// ==========================================
// Middleware: IP 來源白名單過濾
// ==========================================
module.exports.ipFilter = (req, res, next) => {
    // 因已啟用 trust proxy，此處的 req.ip 即為真實來源 IP
    const clientIp = req.ip.replace('::ffff:', ''); 

    try {
        // 1. 每次收到 Request，就即時讀取檔案內容 (達到免重啟熱更新)
        const fileContent = fs.readFileSync(WHITELIST_PATH, 'utf8');
        
        // 2. 解析檔案內容：以換行符號切割，去除空白，並過濾掉空行與 # 開頭的註解
        const allowedIps = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));

        // 3. 比對 IP
        if (!allowedIps.includes(clientIp)) {
            console.warn(`⛔ 拒絕未授權的 IP 存取: ${clientIp}`);
            return res.status(403).json({ error: 'Forbidden: IP not in whitelist' });
        }
        
        req.clientIp = clientIp;
        next();
    } catch (err) {
        console.error('❌ 讀取白名單檔案失敗:', err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};