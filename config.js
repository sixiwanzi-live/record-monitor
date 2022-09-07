export default {
    web: {
        port: 5000,
        bodyLimit: 10 * 1024 * 1024
    },
    blrec: {
        whitelist: [
            {
                roomId: 23058,
                remoteDst: 'asoul:/test'
            },
            {
                roomId: 437817,
                remoteDst: 'asoul:/test'
            },
            {
                roomId: 21144080,
                remoteDst: 'asoul:/test'
            }
        ]
    }
}