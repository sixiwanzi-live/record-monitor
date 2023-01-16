import fetch from 'node-fetch';

export default class BiliApi {
    static async getRoomInfo(roomId) {
        const url = `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!res.ok) {
            throw json;
        }
        return json.data;
    }
}