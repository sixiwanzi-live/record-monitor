export default {
    web: {
        port: 5000,
        bodyLimit: 4 * 1024
    },
    blrec: {
        limit: {
            upload: 10 // 单位MBps
        },
        whitelist: [
            {
                remote: 'sp7', 
                hasDateDir: true,   // 是否增加一层YYYY.MM格式的文件夹，如果为true，则上传的文件路径为2022.10/{原文件名}
                hasNameDir: true,   // 是否增加一层主播昵称的文件夹，如果为true，则上传的文件路径为{昵称}/{原文件名}, 如果dateDir也为true，则文件路径为{昵称}/2022.10/{原文件名}
                rooms: [25061813, 23058]   // 直播间号可以在不同的remote之间重复
            },
            {
                remote: 'sxwz',
                hasDateDir: true,
                hasNameDir: false,
                rooms: [23058]
            }
        ],
        autoRemove: true // 是否在上传完成后自动删除
    }
}