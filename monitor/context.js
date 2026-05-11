const fs = require('fs');
const discordAlert = require('./discordAlerts')
const mids = require('./utils/mid')
const models = require('./model')
function Context(){
    this.init();
}

Context.prototype.init = function(){
    this.storageRoot = process.cwd() + '/data';
    if (!fs.existsSync(this.storageRoot))
        fs.mkdirSync(this.storageRoot)
    this.models = models(this);
    this.discord = discordAlert(this)
    this.mids = mids;
}

module.exports = Context;