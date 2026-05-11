const axios = require('axios')

// Discord 的 Embed 顏色代碼必須是十進制整數
// 紅色=16711680, 黃色=16763904, 綠色=3581519
const colors = { critical: 16711680, warning: 16763904, info: 3581519 };

function Method(context){
    this.context = context;
    this.webhookurl = 'https://discord.com/api/webhooks/1501949307316863078/Xxfusv45TYI6ie-Cq5U_NcEoT6S6aqSNxe7nZ0VNiRG44g6_6pje3cAWGKfDe0h0C_Z4';
}

Method.prototype.exec = async function({ip, alertBlocks, level}){
    // 如果是嚴重等級 (Critical)，可以在 content 加上 @everyone 或特定身份組 ID
    const pingText = level === 'critical' ? '@everyone 🚨 伺服器發生嚴重錯誤！' : '';

    try {
        if (!Array.isArray(alertBlocks)) throw new Error('[USE_ERORR][PARAMETER] message must be an array')
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

        await axios.post(this.webhookurl, payload);
        console.log(`✅ 已成功發送 Discord 警報 (目標 IP: ${ip})`);
    } catch (err) {
        console.error('❌ Discord 通知發送失敗:', err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

module.exports = function(){
    return new Method();
}


