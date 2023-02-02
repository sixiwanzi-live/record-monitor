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
        this.odMap.set(22, 'ASOUL');
        this.odMap.set(23, 'ASOUL');
        this.odMap.set(24, 'ASOUL');
        this.odMap.set(25, 'ASOUL');
        this.odMap.set(26, 'ASOUL');
        this.odMap.set(27, '星律动');
        this.odMap.set(28, '星律动');
        this.odMap.set(32, 'sp2/星瞳_Official');
        this.odMap.set(33, '星律动');

        this.od2Set = new Set();
        this.od2Set.add(1);
        this.od2Set.add(2);
        this.od2Set.add(3);
        this.od2Set.add(4);
        this.od2Set.add(5);
        this.od2Set.add(6);
        this.od2Set.add(9);
        this.od2Set.add(10);
        this.od2Set.add(11);
        this.od2Set.add(12);
        this.od2Set.add(13);
        this.od2Set.add(14);
        this.od2Set.add(15);
        this.od2Set.add(16);
        this.od2Set.add(17);
        this.od2Set.add(18);
        this.od2Set.add(19);
        this.od2Set.add(22);
        this.od2Set.add(23);
        this.od2Set.add(24);
        this.od2Set.add(25);
        this.od2Set.add(26);
        this.od2Set.add(27);
        this.od2Set.add(28);
        this.od2Set.add(33);
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
            
            while (true) {
                try {
                    const newClip = await ZimuApi.insertClip(clip);
                    this.roomMap.set(roomId, newClip);
                    ctx.logger.info(`创建新clip:`);
                    ctx.logger.info(this.roomMap.get(roomId));
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
            const roomId = body.EventData.RoomId;
            const name = body.EventData.Name;
            const title = body.EventData.Title;
            const duration = body.EventData.Duration;

            const clip = this.roomMap.get(roomId);
            this.roomMap.set(roomId, null);
            if (!clip) {
                ctx.logger.error(`房间(${roomId})找不到clip`);
                return;
            }

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
                // 本地源的录播需要改变状态，B站源的录播不需要改变状态
                if (this.odMap.has(clip.authorId)) {
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
            }

            // 接下来的一系列转码和文件转移操作，均只涉及到本地源，B站源的录播可以直接退出
            if (!this.odMap.has(clip.authorId)) return {};
            
            const odPrefix = this.odMap.get(clip.authorId);
            // 生成flv,mp4,xml,txt的源和目的文件路径
            const flvname = body.EventData.RelativePath.split('/')[2];
            const xmlname = flvname.replace('.flv', '.xml');
            const mp4name = flvname.replace('.flv', '.mp4');
            const m4aname = flvname.replace('.flv', '.m4a');
            const txtname = flvname.replace('.flv', '.txt');

            const flvpath = `${config.rec.root}/${body.EventData.RelativePath}`;
            const xmlpath = flvpath.replace('.flv', '.xml');
            const mp4path = flvpath.replace('.flv', '.mp4');
            const m4apath = flvpath.replace('.flv', '.m4a');
            const txtpath = flvpath.replace('.flv', '.txt');
            const od1mp4path = `${config.rec.od1}/${odPrefix}/${mp4name.substring(0, 4)}.${mp4name.substring(4, 6)}/${mp4name}`;
            const od1xmlpath = `${config.rec.od1}/${odPrefix}/${xmlname.substring(0, 4)}.${xmlname.substring(4, 6)}/${xmlname}`;
            const od2mp4path = `${config.rec.od2}/${odPrefix}/${mp4name.substring(0, 4)}.${mp4name.substring(4, 6)}/${mp4name}`;
            const od2xmlpath = `${config.rec.od2}/${odPrefix}/${xmlname.substring(0, 4)}.${xmlname.substring(4, 6)}/${xmlname}`;
            const dstm4apath = `${config.rec.m4a}/${m4aname}`;
            const dstimagemp4path = `${config.rec.m4a}/${mp4name}`;
            const dstflvpath = `${config.rec.flv}/${flvname}`;
            const dsttxtpath = `${config.rec.flv}/${txtname}`;
            const dstmp4path = `${config.rec.mp4}/${mp4name}`;
            const dstxmlpath = `${config.rec.mp4}/${xmlname}`;
            ctx.logger.info({flvpath, mp4path, od1mp4path, od1xmlpath, od2mp4path, od2xmlpath, dstm4apath, dstimagemp4path, dstflvpath, dstmp4path});

            new Promise((res, rej) => {
                ctx.logger.info('准备处理数据转换和迁移');
                (async () => {
                    try {
                        ctx.logger.info('开始flv转m4a');
                        await this._toM4A(ctx, flvpath, m4apath);
                        // 复制m4a到远程地址
                        await copyFile(m4apath, dstm4apath);
                        ctx.logger.info(`复制${m4apath}到${dstm4apath}结束`);
                        await unlink(m4apath);
                        ctx.logger.info(`删除${m4apath}结束`);

                        // 如果时间长度合适，就将音频文件生成一图流视频
                        // 并且将该视频上传到B站，利用B站生成智能字幕
                        if (duration >= config.rec.minInterval) {
                            try {
                                await this._toImageMP4(ctx, dstm4apath, dstimagemp4path);
                                await this._upload(ctx, dstimagemp4path);
                                ctx.logger.info(`上传视频${dstimagemp4path}结束`);
                            } catch (ex) {
                                // 就算上传失败，也不影响接下来的操作
                                ctx.logger.error(ex);
                            }
                        }

                        ctx.logger.info('开始flv转mp4');
                        await this._toMP4(ctx, flvpath, mp4path);
                        // 复制mp4到od1,od2和待转区
                        await copyFile(mp4path, dstmp4path);
                        ctx.logger.info(`复制${mp4path}到${dstmp4path}结束`);
                        await copyFile(dstmp4path, od1mp4path);
                        ctx.logger.info(`复制${dstmp4path}到${od1mp4path}结束`);
                        if (this.od2Set.has(clip.authorId)) {
                            await copyFile(dstmp4path, od2mp4path);
                            ctx.logger.info(`复制${dstmp4path}到${od2mp4path}结束`);
                        }
                                                
                        // 复制xml到od1和od2和待转区
                        await copyFile(xmlpath, dstxmlpath);
                        ctx.logger.info(`复制${xmlpath}到${dstxmlpath}结束`);
                        await copyFile(dstxmlpath, od1xmlpath);
                        ctx.logger.info(`复制${dstxmlpath}到${od1xmlpath}结束`);
                        if (this.od2Set.has(clip.authorId)) {
                            await copyFile(dstxmlpath, od2xmlpath);
                            ctx.logger.info(`复制${dstxmlpath}到${od2xmlpath}结束`);
                        }

                        // 复制txt到远程地址，txt很可能不存在
                        try {
                            await copyFile(txtpath, dsttxtpath);
                            ctx.logger.info(`复制${txtpath}到${dsttxtpath}结束`);
                            await unlink(txtpath);
                            ctx.logger.info(`删除${txtpath}结束`);
                        } catch(ex) {}

                        // 复制flv到远程地址
                        await copyFile(flvpath, dstflvpath);
                        ctx.logger.info(`复制${flvpath}到${dstflvpath}结束`);
                        await unlink(flvpath);
                        ctx.logger.info(`删除${flvpath}结束`);

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

    _toImageMP4 = async (ctx, m4apath, mp4path) => {
        return new Promise((res, rej) => {
            const cmd = [
                '-r', '1',
                '-loop', '1',
                '-y', 
                '-i', config.up.background,
                '-i', m4apath,
                '-shortest',
                '-c:a', 'copy',
                '-c:v', 'libx264',
                '-b:v', '1k',
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
                ctx.logger.info(`生成ImageMp4结束,ffmpeg退出:code:${code}`);
                res();
            });
            p.on('error', (error) => {
                rej(error);
            });
        }).catch(ex => {
            ctx.logger.error(ex);
            PushApi.push('生成ImageMp4异常', `${ex}`);
        });
    }

    _upload = async (ctx, mp4path) => {
        return new Promise((res, rej) => {
            const cmd = [
                '-u', config.up.cookiepath,
                'upload', mp4path,
                '--tag', config.up.tags,
                '--line', 'ws',
                '--limit', '3'
            ];
            let p = spawn('biliup', cmd);
            p.stdout.on('data', (data) => {
                ctx.logger.info('stdout: ' + data.toString());
            });
            p.stderr.on('data', (data) => {
                ctx.logger.info('stderr: ' + data.toString());
            });
            p.on('close', (code) => {
                ctx.logger.info(`上传到B站结束,ffmpeg退出:code:${code}`);
                res();
            });
            p.on('error', (error) => {
                rej(error);
            });
        }).catch(ex => {
            ctx.logger.error(ex);
            PushApi.push('上传到B站异常', `${ex}`);
        });
    }
}