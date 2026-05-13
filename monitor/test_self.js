require('dotenv').config();
const axios = require('axios');


axios.post('http://127.0.0.1:3000/api/upload-emp-logs',{title:'123', message: ["XXX安安你好"],footer:'xxx' },{})
    .then(console.log)
    .catch(console.log)