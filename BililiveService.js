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

            PushApi.push('录制开始', `${name},${title}`);

            const clip = {
                uid:        uid,
                title:      title,
                datetime:   datetime,
                cover:      cover,
                type:       4
            };
            const newClip = await ZimuApi.insertClip(clip);
            ctx.logger.info(`创建新clip:`);
            ctx.logger.info(newClip);
            this.roomMap.set(roomId, newClip.id);
        } else if (type === 'FileClosed') {
            ctx.logger.info('录制结束webhook');
            const roomId = body.EventData.RoomId;
            const name = body.EventData.Name;
            const title = body.EventData.Title;
            const duration = body.EventData.Duration;

            // 生成flv，mp4，xml的源和目的文件路径
            const flvname = body.EventData.RelativePath.split('/')[2];
            const xmlname = flvname.replace('.flv', '.xml');
            const mp4name = flvname.replace('.flv', '.mp4');
            const m4aname = flvname.replace('.flv', '.m4a');

            const flvpath = `${config.rec.root}/${body.EventData.RelativePath}`;
            const mp4path = flvpath.replace('.flv', '.mp4');
            const m4apath = m4apath.replace('.flv', '.m4a');
            const od1mp4path = `${config.rec.od1}/${mp4name}`;
            const od1xmlpath = `${config.rec.od1}/${xmlname}`;
            const od2mp4path = `${config.rec.od2}/${mp4name}`;
            const od2xmlpath = `${config.rec.od2}/${xmlname}`;
            ctx.logger.info({flvpath, mp4path, od1mp4path, od1xmlpath, od2mp4path, od2xmlpath});

            const clipId = this.roomMap.get(roomId);
            const message = `${name},${title},${duration}s`;
            if (duration < 3 * 60) {
                // 如果录制时间过短，则删掉该clip在字幕库中的信息，但是录播文件不删除
                this.roomMap.set(roomId, null);
                if (clipId) {
                    ctx.logger.info(`时间过短:${message}`);
                    PushApi.push('时间过短', message);
                    await ZimuApi.deleteClip(clipId);
                }
            } else {
                PushApi.push('录制结束', message);
            }

            // flv 转 m4a
            this._toM4A(ctx, flvpath, m4apath);

            // flv 转 mp4
            new Promise((res, rej) => {
                (async () => {
                    try {
                        await this._toMP4(ctx, flvpath, mp4path);
                    } catch (ex) {
                        ctx.logger.error(ex);
                    }
                })();
            });
            (async () => {
                try {
                    const newClip = await ZimuApi.updateClip(clipId, {
                        type: 3
                    });
                    ctx.logger.info(`clip更新后:${newClip}`);
                } catch (ex) {
                    ctx.logger.error(ex);
                }
            })();
        }
        return {};
    }

    _toM4A = async (ctx, flvpath, m4apath) => {
        return new Promise((res, rej) => {
            const cmd = [
                '-i', flvpath,
                '-vn',
                '-codec', 'copy',
                m4apath
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
        });
    }

    _toMP4 = async (ctx, flvpath, mp4path) => {
        new Promise((res, rej) => {
            const cmd = [
                '-i', flvpath,
                '-c', 'copy',
                '-movflags', 'faststart',
                mp4path
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
                res();
            });
            p.on('error', (error) => {
                rej(error);
            });
        }).catch(error => {
            ctx.logger.error(error);
            PushApi.push('flv转mp4异常', `${error}`);
        });
    }
}