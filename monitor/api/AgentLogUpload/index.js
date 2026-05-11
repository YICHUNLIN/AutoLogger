
/**
 * @description 新增 每日工作記錄
 */

// 警報門檻值 (可依據伺服器實際狀況微調)
const THRESHOLDS = { 
    cpuUsage: 90,     // CPU 超過 90%
    memUsage: 85,     // 記憶體超過 85%
    diskUsage: 80,    // 硬碟超過 80%
    syslogErrors: 50
};
module.exports = function(context){
    const {ipFilter} = context.mids;
    const {LogCollector} = context.discord
    const {AddAgentLog} = context.models;
    return [
        ipFilter,
        (req, res, next) => {
            const { security, health} = req.body;

            // 若 Payload 格式不符，提前返回
            if (!security || !health) {
                return res.status(400).json({ error: 'Invalid payload format' });
            }
            return next();
        },
        (req, res) => {
            const { security, health, changes, timestamp } = req.body;
            const ip = req.clientIp;
            
            console.log(`[${timestamp}] 收到來自 ${ip} 的報告`);

            let alerts = [];
            let isCritical = false;

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
            // CPU 檢查
            if (health.cpuUsage >= THRESHOLDS.cpuUsage) {
                alerts.push(`*💻 CPU 負載過高*\n> 目前使用率: **${health.cpuUsage.toFixed(1)}%**`);
            }

            // 記憶體檢查
            if (health.memUsage >= THRESHOLDS.memUsage) {
                alerts.push(`*🧠 記憶體即將耗盡*\n> 目前使用率: **${health.memUsage.toFixed(1)}%**`);
            }
            
            // --- 硬碟檢查 (支援多個掛載點的陣列檢查) ---
            if (health.diskUsage && Array.isArray(health.diskUsage)) {
                let fullDisks = []; // 用來收集超過門檻的硬碟清單

                // 檢查每一個掛載點
                health.diskUsage.forEach(disk => {
                    if (disk.usage >= THRESHOLDS.diskUsage) {
                        fullDisks.push(`**${disk.mount}** (已使用: ${disk.usage}%)`);
                    }
                });
                
                // 如果有任何一個硬碟超過門檻，就觸發警報
                if (fullDisks.length > 0) {
                    isCritical = true;
                    alerts.push(`*💾 硬碟空間不足警報*\n> 以下掛載點容量已達警戒值：\n> 🔸 ${fullDisks.join('\n> 🔸 ')}`);
                } else {
                    alerts.push(`*💾 硬碟掛載資訊*\n>`);
                    const d = health.diskUsage.map(d => `**${d.mount}** (已使用: ${d.usage}%)`);
                    alerts = [...alerts, ...d];
                }
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
            const level = isCritical ? 'critical' : 'warning';
            LogCollector.exec(ip, alerts, level);

            // 預留寫入資料庫的區塊供 Dashboard 使用
            AddAgentLog(ip, timestamp, {...req.body, level})
            res.status(200).json({ message: 'Report processed successfully' });

        }
    ]
};