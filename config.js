export default {
    web: {
        port: 5000,
        bodyLimit: 10 * 1024 * 1024
    },
    blrec: {
        limit: {
            upload: 10 // 单位MBps
        },
        whitelist: [
            {
                dir: 'sp8',
                rooms: [25061813]
            },
            {
                dir: 'sp9',
                rooms: [23058]
            }
        ]
    }
}