const express = require('express');
const axios = require('axios');
const app = express();

// 【重要】信任 Nginx 等反向代理，確保 req.ip 取得的是真實客戶端 IP
app.set('trust proxy', true);
app.use(express.json());

// ==========================================
// 環境變數與參數設定區
// ==========================================
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const PORT = process.env.PORT || 3000;

// 將字串 "192.168.1.10, 192.168.1.11" 轉換成陣列，並去除多餘空白
const allowedIpsString = process.env.ALLOWED_IPS || '127.0.0.1';
const ALLOWED_IPS = allowedIpsString.split(',').map(ip => ip.trim());

// 警報門檻值 (可依據伺服器實際狀況微調)
const THRESHOLDS = {
    authFails: 10,        // 一小時內登入失敗超過幾次觸發警報
    syslogErrors: 50,     // 系統日誌錯誤超過幾次觸發警報
    dockerErrors: 20      // Docker 容器錯誤超過幾次觸發警報
};

// ==========================================
// Middleware: IP 來源白名單過濾
// ==========================================
const ipFilter = (req, res, next) => {
    // 因已啟用 trust proxy，此處的 req.ip 即為真實來源 IP
    const clientIp = req.ip.replace('::ffff:', ''); 

    if (!ALLOWED_IPS.includes(clientIp)) {
        console.warn(`⛔ 拒絕未授權的 IP 存取: ${clientIp}`);
        return res.status(403).json({ error: 'Forbidden: IP not in whitelist' });
    }
    
    req.clientIp = clientIp;
    next();
};

// ==========================================
// Slack 通知發送模組
// ==========================================
async function sendSlackAlert(ip, alertBlocks, level = 'warning') {
    if (!SLACK_WEBHOOK_URL) {
        console.error('⚠️ 未設定 SLACK_WEBHOOK_URL，無法發送通知');
        return;
    }

    const colors = { critical: '#ff0000', warning: '#ffcc00', info: '#36a64f' };
    
    const payload = {
        attachments: [{
            fallback: `伺服器 ${ip} 狀態報告`,
            color: colors[level] || colors.warning,
            pretext: `🔔 *伺服器監控報告* | 來源 IP: \`${ip}\``,
            text: alertBlocks.join('\n\n'),
            footer: "Log Analyzer Monitor",
            ts: Math.floor(Date.now() / 1000)
        }]
    };

    try {
        await axios.post(SLACK_WEBHOOK_URL, payload);
        console.log(`✅ 已成功發送 Slack 警報 (目標 IP: ${ip})`);
    } catch (err) {
        console.error('❌ Slack 通知發送失敗:', err.response ? err.response.data : err.message);
    }
}

// ==========================================
// API 路由: 接收 Agent 上傳的分析報告
// ==========================================
app.post('/api/upload-logs', ipFilter, (req, res) => {
    const { security, health, changes, timestamp } = req.body;
    const ip = req.clientIp;
    
    console.log(`[${timestamp}] 收到來自 ${ip} 的報告`);

    let alerts = [];
    let isCritical = false;

    // 若 Payload 格式不符，提前返回
    if (!security || !health) {
        return res.status(400).json({ error: 'Invalid payload format' });
    }

    // ------------------------------------------
    // 1. 安全與網路分析 (Security)
    // ------------------------------------------
    if (security.authFails > THRESHOLDS.authFails || (security.topAttackers && security.topAttackers.length > 0)) {
        let text = `*⚠️ SSH 登入異常* \n> 總失敗次數: ${security.authFails}`;
        if (security.topAttackers && security.topAttackers.length > 0) {
            text += `\n> 👑 主要攻擊者:\n` + security.topAttackers.map(a => `>   • ${a.ip} (${a.count} 次)`).join('\n');
        }
        alerts.push(text);
    }

    if (security.authSuccess > 0 && security.successIps && security.successIps.length > 0) {
        alerts.push(`*✅ 成功登入紀錄*\n> 總次數: ${security.authSuccess}\n` + security.successIps.map(s => `>   • 來源: ${s.ip} (${s.count} 次)`).join('\n'));
    }

    if (security.fail2banBans > 0) {
        alerts.push(`*🛡️ 防火牆封鎖 (Fail2Ban)*\n> 新增封鎖了 ${security.fail2banBans} 個惡意 IP`);
    }

    if (security.topScannedPorts && security.topScannedPorts.length > 0) {
        alerts.push(`*📡 異常 Port 掃描攔截*\n` + security.topScannedPorts.map(p => `>   • Port ${p.port} (${p.count} 次)`).join('\n'));
    }

    // ------------------------------------------
    // 2. 系統健康度分析 (Health)
    // ------------------------------------------
    if (health.oomKills > 0) {
        isCritical = true; // OOM 是嚴重事件，提升警報等級為 critical
        alerts.push(`*🔥 嚴重錯誤 (OOM Kill)*\n> 發生了 ${health.oomKills} 次記憶體耗盡事件！`);
    }

    if (health.syslogErrors > THRESHOLDS.syslogErrors) {
        alerts.push(`*⚠️ 系統日誌異常*\n> 發現 ${health.syslogErrors} 筆系統錯誤日誌 (大於設定門檻 ${THRESHOLDS.syslogErrors})`);
    }

    if (health.dockerErrors > THRESHOLDS.dockerErrors) {
        alerts.push(`*🐳 Docker 容器異常*\n> 發現 ${health.dockerErrors} 筆容器錯誤日誌 (大於設定門檻 ${THRESHOLDS.dockerErrors})`);
    }

    // ------------------------------------------
    // 3. 系統變動 (Changes)
    // ------------------------------------------
    if (changes && changes.packageInstalls > 0) {
        alerts.push(`*📦 套件異動*\n> 過去一小時內系統安裝/更新了 ${changes.packageInstalls} 個套件`);
    }

    // ------------------------------------------
    // 4. 判斷並發送通知
    // ------------------------------------------
    // 只要陣列中有任何警報訊息，就呼叫 Slack 發送
    if (alerts.length > 0) {
        const level = isCritical ? 'critical' : 'warning';
        sendSlackAlert(ip, alerts, level);
    }

    // 預留寫入資料庫的區塊供 Dashboard 使用
    
    res.status(200).json({ message: 'Report processed successfully' });
});

// ==========================================
// 啟動伺服器
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Monitor 控制器啟動成功，正在監聽 Port ${PORT}`);
    console.log(`🛡️ 信任代理 (Trust Proxy): 啟用`);
    console.log(`📝 目前載入的 IP 白名單:`, ALLOWED_IPS);
});