import fetch from 'node-fetch';
import config from '../config.js';

export default class ZimuApi {
    static async insertClip(clip) {
        const url = `${config.zimu.url}/clips`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.zimu.auth}`,
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(clip)
        });
        const json = await res.json();
        if (!res.ok) {
            throw json;
        }
        return json;
    }

    static async updateClip(id, clip) {
        const url = `${config.zimu.url}/clips/${id}`;
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.zimu.auth}`,
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(clip)
        });
        const json = await res.json();
        if (!res.ok) {
            throw json;
        }
        return json;
    }

    static async deleteClip(id) {
        const url = `${config.zimu.url}/clips/${id}`;
        await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${config.zimu.auth}`
            }
        });
    }
}