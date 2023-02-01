export default {
    web: {
        port: 你的服务端口号,
        bodyLimit: 4 * 1024
    },
    rec: {
        minInterval: 最小录播时长,
        root: '录播文件夹位置',
        od1: 'OneDrive 1 文件夹位置',
        od2: 'OneDrive 2 文件夹位置',
        m4a: 'm4a归档文件夹位置',
        flv: 'flv归档文件夹位置',
        mp4: 'mp4临时文件夹位置'
    },
    up: {
        background: '一图流地址',
        tags: '上传的视频tag',
        cookiepath: '上传cookie路径'
    },
    push: {
        key: '你的PushDeer key'
    },
    zimu: {
        url: 'https://api.zimu.bili.studio',
        auth: '你的api权限码'
    }
}