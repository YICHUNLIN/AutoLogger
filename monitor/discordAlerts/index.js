
const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

module.exports = function(context){
    const db = {};
    console.log(`=== Load Discord ===`)
    fs.readdirSync(__dirname)
    .filter(file => {
      return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
    })
      .forEach(file => {
        const name = file.replace('.js', '');
        const model = require(path.join(__dirname, file));
        db[name] = model(context);
        console.log(name)
      });
    return db;
};
