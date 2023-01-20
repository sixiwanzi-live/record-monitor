import { spawn } from 'child_process';
import config from './config.js';
import BiliApi from './api/BiliApi.js';
import ZimuApi from './api/ZimuApi.js';
import PushApi from './api/PushApi.js';

export default class BililiveService {

    constructor() {
        this.roomMap = new Map();
    }

    webhook = async (ctx) => {
        const body = ctx.request.body;
        ctx.logger.info(body);

        const type = body.EventType;
        if (type === 'FileOpening') {
            ctx.logger.info('录制开始webhook'); 
            const datetime = body.EventData.FileOpenTime.substring(0, 19).replace('T', ' ');
            const roomId = body.EventData.RoomId;
            const name = body.EventData.Name;
            const title = body.EventData.Title.replaceAll('*', '_'); // 针对某些标题中含有*的情况，为了兼容windows系统文件，将*换成_

            // 从bilibili获取到直播间基础信息
            const roomInfo = await BiliApi.getRoomInfo(roomId);
            const uid = roomInfo.uid;
            const cover = roomInfo.user_cover.substring(8); // 去掉https://

            await PushApi.push('录制开始', `${name},${title}`);

            const clip = {
                uid:        uid,
                title:      title,
                datetime:   datetime,
                cover:      cover,
                type:       4
            };
            const newClip = await ZimuApi.insertClip(clip);
            ctx.logger.info(newClip);
            this.roomMap.set(roomId, newClip.id);
        } else if (type === 'FileClosed') {
            ctx.logger.info('录制结束webhook');
            const roomId = body.EventData.RoomId;
            const name = body.EventData.Name;
            const title = body.EventData.Title;
            const duration = body.EventData.Duration;
            const path = `${config.rec.root}/${body.EventData.RelativePath}`;

            const clipId = this.roomMap.get(roomId);
            if (duration < 10 * 60) {
                this.roomMap.set(roomId, null);
                if (clipId) {
                    ctx.logger.info(`时间过短:${name},${title},${duration}`);
                    await ZimuApi.deleteClip(clipId);
                    await PushApi.push('时间过短', `${name},${title},${duration}`);
                }
            } else {
                await PushApi.push('录制结束', `${name},${title}${duration}`);
            }
            // flv 转 mp4
            new Promise((res, rej) => {
                const cmd = [
                    '-i', path,
                    '-c', 'copy',
                    '-movflags', 'faststart',
                    path.replace('.flv', '.mp4')
                ];
                let p = spawn('ffmpeg', cmd);
                p.stdout.on('data', (data) => {
                    ctx.logger.info('stdout: ' + data.toString());
                });
                p.stderr.on('data', (data) => {
                    ctx.logger.info('stderr: ' + data.toString());
                });
                p.on('close', (code) => {
                    ctx.logger.info(`flv转mp4结束,ffmpeg退出:code:${code}`);
                    ZimuApi.updateClip(clipId, {
                        type: 3
                    });
                    res();
                });
                p.on('error', (error) => {
                    rej(error);
                });
            }).catch(error => {
                ctx.logger.error(error);
                PushApi.push('flv转mp4异常', `${error}`);
            });
            // flv 转 m4a
            new Promise((res, rej) => {
                const cmd = [
                    '-i', path,
                    '-vn',
                    '-codec', 'copy',
                    path.replace('.flv', '.m4a')
                ];
                let p = spawn('ffmpeg', cmd);
                p.stdout.on('data', (data) => {
                    ctx.logger.info('stdout: ' + data.toString());
                });
                p.stderr.on('data', (data) => {
                    ctx.logger.info('stderr: ' + data.toString());
                });
                p.on('close', (code) => {
                    ctx.logger.info(`flv转m4a结束,ffmpeg退出:code:${code}`);
                    res();
                });
                p.on('error', (error) => {
                    rej(error);
                });
            }).catch(error => {
                ctx.logger.error(error);
                PushApi.push('flv转m4a异常', `${error}`);
            });;
        }
        return {};
    }
}