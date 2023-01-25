import { spawn } from 'child_process';
import { copyFile, unlink } from 'fs/promises';
import config from './config.js';
import BiliApi from './api/BiliApi.js';
import ZimuApi from './api/ZimuApi.js';
import PushApi from './api/PushApi.js';

export default class BililiveService {

    constructor() {
        this.roomMap = new Map();
        this.odMap = new Map();
        this.odMap.set(1, '四禧丸子');
        this.odMap.set(2, '四禧丸子');
        this.odMap.set(3, '四禧丸子');
        this.odMap.set(4, '四禧丸子');
        this.odMap.set(5, '量子少年');
        this.odMap.set(6, '量子少年');
        this.odMap.set(9, 'EOE组合');
        this.odMap.set(10, 'EOE组合');
        this.odMap.set(11, 'EOE组合');
        this.odMap.set(12, 'EOE组合');
        this.odMap.set(13, 'EOE组合');
        this.odMap.set(14, 'sp9/明前奶绿');
        this.odMap.set(15, '星律动');
        this.odMap.set(16, '星律动');
        this.odMap.set(17, '星律动');
        this.odMap.set(18, '量子少年');
        this.odMap.set(19, '量子少年');
        this.odMap.set(20, 'sp7/麻尤米mayumi');
        this.odMap.set(21, 'sp9/凜凜蝶凜');
        this.odMap.set(22, 'ASOUL');
        this.odMap.set(23, 'ASOUL');
        this.odMap.set(24, 'ASOUL');
        this.odMap.set(25, 'ASOUL');
        this.odMap.set(26, 'ASOUL');
        this.odMap.set(27, '星律动');
        this.odMap.set(28, '星律动');
        this.odMap.set(32, 'sp2/星瞳_Official');
        this.odMap.set(33, '星律动');
    }

    webhook = async (ctx) => {
        const body = ctx.request.body;
        ctx.logger.info(body);

        const type = body.EventType;
        if (type === 'FileOpening') {
            ctx.logger.info('录制开始webhook'); 
            const datetime = body.EventData.FileOpenTime.substring(0, 19).replace('T', ' ');
            // const roomId = body.EventData.RoomId;
            let roomId = 25290861;
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
            
            while (true) {
                try {
                    const newClip = await ZimuApi.insertClip(clip);
                    ctx.logger.info(`创建新clip:`);
                    ctx.logger.info(newClip);
                    this.roomMap.set(roomId, newClip);
                    break;
                } catch (ex) {
                    ctx.logger.error(ex);
                }
                await new Promise((res, rej) => {
                    setTimeout(() => { res(); }, 3000);
                });
            }
        } else if (type === 'FileClosed') {
            ctx.logger.info('录制结束webhook');
            // const roomId = body.EventData.RoomId;
            let roomId = 25290861;
            const name = body.EventData.Name;
            const title = body.EventData.Title;
            const duration = body.EventData.Duration;

            const clip = this.roomMap.get(roomId);
            this.roomMap.set(roomId, null);
            if (!clip) return {};
            if (!this.odMap.has(clip.authorId)) return {};
            const odPrefix = this.odMap.get(clip.authorId);

            // 生成flv，mp4，xml的源和目的文件路径
            const flvname = body.EventData.RelativePath.split('/')[2];
            const xmlname = flvname.replace('.flv', '.xml');
            const mp4name = flvname.replace('.flv', '.mp4');
            const m4aname = flvname.replace('.flv', '.m4a');

            const flvpath = `${config.rec.root}/${body.EventData.RelativePath}`;
            const xmlpath = flvpath.replace('.flv', '.xml');
            const mp4path = flvpath.replace('.flv', '.mp4');
            const m4apath = flvpath.replace('.flv', '.m4a');
            const od1mp4path = `${config.rec.od1}/${odPrefix}/${mp4name.substring(0, 4)}.${mp4name.substring(4, 6)}/${mp4name}`;
            const od1xmlpath = `${config.rec.od1}/${odPrefix}/${xmlname.substring(0, 4)}.${xmlname.substring(4, 6)}/${xmlname}`;
            const od2mp4path = `${config.rec.od2}/${odPrefix}/${mp4name.substring(0, 4)}.${mp4name.substring(4, 6)}/${mp4name}`;
            const od2xmlpath = `${config.rec.od2}/${odPrefix}/${xmlname.substring(0, 4)}.${xmlname.substring(4, 6)}/${xmlname}`;
            const dstm4apath = `${config.rec.m4a}/${m4aname}`;
            const dstflvpath = `${config.rec.flv}/${flvname}`;
            const dstmp4path = `${config.rec.mp4}/${mp4name}`;
            const dstxmlpath = `${config.rec.mp4}/${xmlname}`;
            ctx.logger.info({flvpath, mp4path, od1mp4path, od1xmlpath, od2mp4path, od2xmlpath, dstm4apath, dstflvpath, dstmp4path});

            const message = `${name},${title},${duration}s`;
            if (duration < config.rec.minInterval) {
                // 如果录制时间过短，则删掉该clip在字幕库中的信息，但是录播文件不删除
                ctx.logger.info(`时间过短:${message}`);
                PushApi.push('时间过短', message);

                while (true) {
                    try {
                        await ZimuApi.deleteClip(clip.id);
                        break;
                    } catch (ex) {
                        ctx.logger.error(ex);
                    }
                    await new Promise((res, rej) => {
                        setTimeout(() => { res(); }, 3000);
                    });
                }
            } else {
                PushApi.push('录制结束', message);
                while (true) {
                    try {
                        const newClip = await ZimuApi.updateClip(clip.id, { type: 3 });
                        ctx.logger.info('clip更新后:');
                        ctx.logger.info(newClip);
                        break;
                    } catch (ex) {
                        ctx.logger.error(ex);
                    }
                    await new Promise((res, rej) => {
                        setTimeout(() => { res(); }, 3000);
                    });
                }
            }

            new Promise((res, rej) => {
                ctx.logger.info('准备处理数据转换和迁移');
                (async () => {
                    try {
                        ctx.logger.info('开始flv转mp4');
                        await this._toMP4(ctx, flvpath, mp4path);
                        // 复制mp4到od1,od2和待转区
                        await copyFile(mp4path, od1mp4path);
                        await copyFile(od1mp4path, dstmp4path);
                        // await this._cp(ctx, mp4path, od1mp4path);
                        // await this._cp(od1mp4path, od2mp4path);
                        // await this._cp(ctx, od1mp4path, dstm4apath);
                        
                        // 复制xml到od1和od2
                        // await this._cp(ctx, xmlpath, od1xmlpath);
                        // await this._cp(od1xmlpath, od2xmlpath);
                        // await this._cp(ctx, od1xmlpath, dstxmlpath);

                        await copyFile(xmlpath, od1xmlpath);
                        await copyFile(od1xmlpath, dstxmlpath);

                        ctx.logger.info('开始flv转m4a');
                        await this._toM4A(ctx, flvpath, m4apath);
                        
                        // 复制m4a到远程地址
                        // await this._cp(ctx, m4apath, dstm4apath);
                        await copyFile(m4apath, dstm4apath);
                        // 复制flv到远程地址
                        // await this._cp(ctx, flvpath, dstflvpath);
                        await copyFile(flvpath, dstflvpath);
                        await unlink(flvpath);
                        res();
                    } catch (ex) {
                        ctx.logger.error(ex);
                        rej(ex);
                    }
                })();
            });
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
        }).catch(ex => {
            ctx.logger.error(ex);
            PushApi.push('flv转m4a异常', `${ex}`);
        });
    }

    _toMP4 = async (ctx, flvpath, mp4path) => {
        return new Promise((res, rej) => {
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
        }).catch(ex => {
            ctx.logger.error(ex);
            PushApi.push('flv转mp4异常', `${ex}`);
        });
    }

    _cp = async (ctx, src, dst) => {
        new Promise((res, rej) => {
            const cmd = [
                src, dst
            ];
            let p = spawn('copy', cmd);
            p.stdout.on('data', (data) => {
                ctx.logger.info('stdout: ' + data.toString());
            });
            p.stderr.on('data', (data) => {
                ctx.logger.info('stderr: ' + data.toString());
            });
            p.on('close', (code) => {
                ctx.logger.info(`复制${src}到${dst}结束,:code:${code}`);
                res();
            });
            p.on('error', (error) => {
                rej(error);
            });
        }).catch(ex => {
            ctx.logger.error(ex);
            PushApi.push('复制${src}到${dst}异常', `${ex}`);
        });
    }
}