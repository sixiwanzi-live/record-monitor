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
                roomId: 25061813,
                remoteDst: 'sp8:/麻尤米mayumi'
            },
            {
                // 3号直播间，用于测试
                roomId: 23058,
                remoteDst: 'sp9:/東雪蓮Official'
            }
        ],
        whitelist1: [
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