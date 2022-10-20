export default {
    web: {
        port: 5000,
        bodyLimit: 10 * 1024 * 1024
    },
    blrec: {
        limit: {
            upload: 10 // 单位MBps
        },
        dst: {
            datePrefix: true // 是否在上传的文件加上年月前缀，例如2022.10/{你的文件名}
        },
        whitelist: [
            {
                dir: 'sp7',
                rooms: [25061813]
            },
            {
                dir: '',
                rooms: [23058]
            }
        ]
    }
}