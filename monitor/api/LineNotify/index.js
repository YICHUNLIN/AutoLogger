
/**
 * @description 新增 每日工作記錄
 */

module.exports = function(context){
    const {ipFilter} = context.mids;
    const {LineNotify} = context.discord
    return [
        ipFilter,
        (req, res) => {
            const { title, message, footer } = req.body;
            LineNotify.exec({title, message, footer});

            // 預留寫入資料庫的區塊供 Dashboard 使用
            
            res.status(200).json({ message: 'Report processed successfully' });
        }
    ]
};