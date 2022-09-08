export default {
    web: {
        port: 5000,
        bodyLimit: 10 * 1024 * 1024
    },
    blrec: {
        limit: {
            upload: 3
        },
        whitelist: [
            {
                roomId: 25290861,
                remoteDst: 'sp9:/凜凜蝶凜'
            },
            {
                roomId: 22816111,
                remoteDst: 'sp9:/東雪蓮Official'
            },
            {
                roomId: 22886883,
                remoteDst: 'xt:'
            },
            {
                roomId: 22230707,
                remoteDst: 'sp9:/峰哥亡命天涯'
            },
            {
                roomId: 2444178,
                remoteDst: 'sp8:/正直少年李发卡'
            },
            {
                // 3号直播间，用于测试
                roomId: 23058,
                remoteDst: 'sp9:/東雪蓮Official'
            }
        ]
    }
}