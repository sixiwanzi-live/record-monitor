import fetch from 'node-fetch';

export default class BiliApi {
    static async getRoomInfo(roomId) {
        const url = `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`;
        const res = await fetch(url);
        if (res.ok) {
            return (await res.json()).data;
        } else {
            console.error(await res.json());
            return null;
        }
    }

    static async getUserInfo(uid) {
        const url = `http://api.bilibili.com/x/space/acc/info?mid=${uid}`;
        const res = await fetch(url);
        if (res.ok) {
            return (await res.json()).data;
        } else {
            console.error(await res.json());
            return null;
        }
    }
}