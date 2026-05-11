const axios = require('axios')
// Discord 的 Embed 顏色代碼必須是十進制整數
// 紅色=16711680, 黃色=16763904, 綠色=3581519
const colors = { critical: 16711680, warning: 16763904, info: 3581519 };


function Method(context){
    this.context = context;
    this.webhookurl = 'https://discord.com/api/webhooks/1502086012137111663/sP4H5vMx3PPyjFov6F76KKsUNAVhKVitYVUI9o1Yo8qbbAJob6KwwwZrIhIdTCSFhfG3';
}

Method.prototype.exec = async function({content, title, message, level, footer}){
    try {
        if (!Array.isArray(message)) throw new Error('[USE_ERORR][PARAMETER] message must be an array')
        const payload = {
            content, // 顯示在訊息最上方的純文字
            embeds: [{
                title: title,
                description: message.join('\n\n'),
                color: colors[level] || colors.info,
                footer: {
                    text: footer
                },
                timestamp: new Date().toISOString() // 自動加上右下角的精準時間
            }]
        };
        await axios.post(this.webhookurl, payload);
        console.log(`✅ 已成功發送 去 Discord`);
    } catch (err) {
        console.error('❌ Discord 通知發送失敗:', err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

module.exports = function(){
    return new Method();
}


