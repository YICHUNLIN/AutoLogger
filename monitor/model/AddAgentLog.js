const fs = require('fs')
function AddAgentLog(context){
    this.context = context;
    this.path = `${context.storageRoot}/agent_log`
    if (!fs.existsSync(this.path)) fs.mkdirSync(this.path);
}

AddAgentLog.prototype.exec = async function({ip, timstamp, content}){
    try{
        const t_path = `${this.path}/${ip}`
        if (!fs.existsSync(t_path)) fs.mkdirSync(t_path);
        fs.writeFileSync(`${t_path}/${timstamp}.json`, JSON.stringify(content));
        return {error: false, message: 'add agent log successed', ip, timstamp}
    }catch(err){
        return {error: true, err}
    }
}

module.exports = function (context) { 
    return new AddAgentLog(context);
};