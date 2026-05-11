const fs = require('fs');
const path = require('path');
var express = require('express');
var api = express.Router();
/**
 * @param app   {express} express 模組
 * @param mids  {array of mid} 中間處理的注入
 */
module.exports = (context, app, mids) => {
    const routesRoot = path.basename(__dirname);
    const base = `${process.cwd()}`
    console.log(`=== Load '${routesRoot}' ===`);
    // // 動態載入模組
    fs.readdirSync(__dirname)
        .filter(file => (file.slice(-3) !== '.js'))
        .forEach(dir => {
            const config = JSON.parse(fs.readFileSync(`${base}/${routesRoot}/${dir}/cfg.json`));
            const t_module = require(`./${dir}/${config.index}`);
            if (t_module) {
                const module = t_module(context, config);
                api[config.method](`/${routesRoot}${config.name}`, module);
                console.log(`- ${config.method.toUpperCase()}`,`/${routesRoot}${config.name}` , `${config.desc}`)
            }
        });
    app.use(`/${routesRoot}`, mids, api);
}