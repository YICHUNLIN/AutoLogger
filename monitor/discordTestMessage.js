require('dotenv').config();
const axios = require('axios');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';



// ==========================================
// Discord 通知發送模組 (取代原本的 sendSlackAlert)
// ==========================================
async function sendDiscordAlert(ip, alertBlocks, level = 'warning') {
    if (!DISCORD_WEBHOOK_URL) {
        console.error('⚠️ 未設定 DISCORD_WEBHOOK_URL，無法發送通知');
        return;
    }

    // Discord 的 Embed 顏色代碼必須是十進制整數
    // 紅色=16711680, 黃色=16763904, 綠色=3581519
    const colors = { critical: 16711680, warning: 16763904, info: 3581519 };
    
    // 如果是嚴重等級 (Critical)，可以在 content 加上 @everyone 或特定身份組 ID
    const pingText = level === 'critical' ? '@everyone 🚨 伺服器發生嚴重錯誤！' : '';

    const payload = {
        content: pingText, // 顯示在訊息最上方的純文字
        embeds: [{
            title: `🔔 伺服器監控報告 | 來源 IP: ${ip}`,
            description: alertBlocks.join('\n\n'),
            color: colors[level] || colors.warning,
            footer: { 
                text: "Log Analyzer Monitor" 
            },
            timestamp: new Date().toISOString() // 自動加上右下角的精準時間
        }]
    };

    try {
        await axios.post(DISCORD_WEBHOOK_URL, payload);
        console.log(`✅ 已成功發送 Discord 警報 (目標 IP: ${ip})`);
    } catch (err) {
        console.error('❌ Discord 通知發送失敗:', err.response ? JSON.stringify(err.response.data) : err.message);
    }
}


sendDiscordAlert("127.0.0.1", ["這是一個測試訊息","Test12345"], 'warning');