import { spawn } from 'child_process';
import { copyFile, unlink } from 'fs/promises';
import config from './config.js';
import TaskPool from './TaskPool.js';
import BiliApi from './api/BiliApi.js';
import ZimuApi from './api/ZimuApi.js';
import PushApi from './api/PushApi.js';

export default class BililiveService {

    constructor() {
        this.infoTaskPool = new TaskPool();
        this.infoTaskPool.run();

        this.diskTaskPool = new TaskPool();
        this.diskTaskPool.run();

        this.roomMap = new Map();
        this.od1Map = new Map();
        this.od1Map.set(1, '四禧丸子');
        this.od1Map.set(2, '四禧丸子');
        this.od1Map.set(3, '四禧丸子');
        this.od1Map.set(4, '四禧丸子');
        this.od1Map.set(9, 'EOE组合');
        this.od1Map.set(10, 'EOE组合');
        this.od1Map.set(11, 'EOE组合');
        this.od1Map.set(12, 'EOE组合');
        this.od1Map.set(13, 'EOE组合');
        this.od1Map.set(14, 'sp9/明前奶绿');
        this.od1Map.set(15, '星律动');
        this.od1Map.set(16, '星律动');
        this.od1Map.set(17, '星律动');
        this.od1Map.set(20, 'sp7/麻尤米mayumi');
        this.od1Map.set(22, 'ASOUL');
        this.od1Map.set(23, 'ASOUL');
        this.od1Map.set(24, 'ASOUL');
        this.od1Map.set(25, 'ASOUL');
        this.od1Map.set(26, 'ASOUL');
        this.od1Map.set(27, '星律动');
        this.od1Map.set(28, '星律动');
        this.od1Map.set(32, 'sp2/星瞳_Official');
        this.od1Map.set(33, '星律动');

        this.od2Map = new Map();
        this.od2Map.set(1, '四禧丸子');
        this.od2Map.set(2, '四禧丸子');
        this.od2Map.set(3, '四禧丸子');
        this.od2Map.set(4, '四禧丸子');
        this.od2Map.set(5, '量子少年');
        this.od2Map.set(6, '量子少年');
        this.od2Map.set(9, 'EOE组合');
        this.od2Map.set(10, 'EOE组合');
        this.od2Map.set(11, 'EOE组合');
        this.od2Map.set(12, 'EOE组合');
        this.od2Map.set(13, 'EOE组合');
        this.od2Map.set(14, 'sp9/明前奶绿');
        this.od2Map.set(15, '星律动');
        this.od2Map.set(16, '星律动');
        this.od2Map.set(17, '星律动');
        this.od2Map.set(18, '量子少年');
        this.od2Map.set(19, '量子少年');
        this.od2Map.set(22, 'ASOUL');
        this.od2Map.set(23, 'ASOUL');
        this.od2Map.set(24, 'ASOUL');
        this.od2Map.set(25, 'ASOUL');
        this.od2Map.set(26, 'ASOUL');
        this.od2Map.set(27, '星律动');
        this.od2Map.set(28, '星律动');
        this.od2Map.set(33, '星律动');
        this.od2Map.set(35, 'VirtuaReal-Part1/七海Nana7mi');
        this.od2Map.set(36, 'VirtuaReal-Part1/阿梓从小就很可爱');
        this.od2Map.set(37, 'VirtuaReal-Part1/小可学妹');
        this.od2Map.set(38, 'VirtuaReal-Part1/阿萨Aza');
        this.od2Map.set(46, '完美世界/露米Lumi_Official');
        this.od2Map.set(47, '完美世界/露娜Luna_Official');
        this.od2Map.set(48, '完美世界/永恒娘Official');
        this.od2Map.set(49, '完美世界/古堡龙姬');
        this.od2Map.set(50, '完美世界/dodo_Official');
    }

    webhook = async (ctx) => {
        const body = ctx.request.body;
        ctx.logger.info(body);

        const type = body.EventType;
        if (type === 'FileOpening') {
            ctx.logger.info('录制开始webhook'); 
            const filename = body.EventData.RelativePath.split('/')[2];
            const datetime = `${filename.substring(0, 4)}-${filename.substring(4, 6)}-${filename.substring(6, 8)} ${filename.substring(9, 11)}:${filename.substring(11, 13)}:${filename.substring(13, 15)}`;
            const roomId = body.EventData.RoomId;
            const name = body.EventData.Name;
            const title = body.EventData.Title.replaceAll('*', '_'); // 针对某些标题中含有*的情况，为了兼容windows系统文件，将*换成_

            this.infoTaskPool.push(async () => {
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

                // 重试n次
                for (let i = 0; i < config.web.retry; ++i) {
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
            });
        } else if (type === 'FileClosed') {
            ctx.logger.info('录制结束webhook');
            const roomId = body.EventData.RoomId;
            const name = body.EventData.Name;
            const title = body.EventData.Title;
            const duration = body.EventData.Duration;

            this.infoTaskPool.push(async () => {
                const clip = this.roomMap.get(roomId);
                if (!clip) {
                    ctx.logger.error(`房间(${roomId})找不到clip`);
                    return;
                }
                this.roomMap.set(roomId, null);

                const message = `${name},${title},${duration}s`;
                if (duration < config.rec.minInterval) {
                    // 如果录制时间过短，则删掉该clip在字幕库中的信息，但是录播文件不删除
                    ctx.logger.info(`时间过短:${message},不得低于${config.rec.minInterval}s`);
                    PushApi.push('时间过短', message);

                    // 重试10次
                    for (let i = 0; i < config.web.retry; ++i) {
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
                    if (this.od1Map.has(clip.authorId) || this.od2Map.has(clip.authorId)) {
                        for (let i = 0; i < config.web.retry; ++i) { // 重试10次
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
                if (!this.od1Map.has(clip.authorId) && !this.od2Map.has(clip.authorId)) return {};

                // 生成flv,mp4,xml,txt的源和目的文件路径
                const flvname = body.EventData.RelativePath.split('/')[2];
                const xmlname = flvname.replace('.flv', '.xml');
                const mp4name = flvname.replace('.flv', '.mp4');
                const m4aname = flvname.replace('.flv', '.m4a');
                const txtname = flvname.replace('.flv', '.txt');

                const liveflvpath = `${config.rec.live}/${body.EventData.RelativePath}`;
                const livexmlpath = liveflvpath.replace('.flv', '.xml');
                const livetxtpath = liveflvpath.replace('.flv', '.txt');

                const rootflvpath = `${config.rec.root}/${body.EventData.RelativePath}`;
                const rootxmlpath = rootflvpath.replace('.flv', '.xml');
                const rootmp4path = rootflvpath.replace('.flv', '.mp4');

                const dstm4apath = `${config.rec.m4a}/${m4aname}`;
                const dstimagemp4path = `${config.rec.imagemp4}/${mp4name}`;
                const dstflvpath = `${config.rec.flv}/${flvname}`;
                const dsttxtpath = `${config.rec.flv}/${txtname}`;
                const dstmp4path = `${config.rec.mp4}/${mp4name}`;
                const dstxmlpath = `${config.rec.mp4}/${xmlname}`;
                ctx.logger.info({liveflvpath, livexmlpath, dstm4apath, dstimagemp4path, dstflvpath, dstmp4path});

                ctx.logger.info('准备处理数据转换和迁移');
                this.diskTaskPool.push(async () => {
                    try {
                        // 复制flv到待转区
                        await copyFile(liveflvpath, dstflvpath);
                        ctx.logger.info(`复制${liveflvpath}到${dstflvpath}结束`);
                        // 复制xml到待转区
                        await copyFile(livexmlpath, dstxmlpath);
                        ctx.logger.info(`复制${livexmlpath}到${dstxmlpath}结束`);
                        // 复制txt到待转区，txt很可能不存在
                        try {
                            await copyFile(livetxtpath, dsttxtpath);
                            ctx.logger.info(`复制${livetxtpath}到${dsttxtpath}结束`);
                            await unlink(livetxtpath);
                            ctx.logger.info(`删除${livetxtpath}结束`);
                        } catch(ex) {}
                        
                        ctx.logger.info('开始flv转m4a');
                        await this._toM4A(ctx, dstflvpath, dstm4apath);

                        // 如果时间长度合适，就将音频文件生成一图流视频
                        // 并且将该视频上传到B站，利用B站生成智能字幕
                        if (duration >= config.rec.minInterval) {
                            try {
                                await this._toImageMP4(ctx, dstm4apath, dstimagemp4path);
                                const imageMp4Title = flvname.replace(`.flv`, ``).replace(`-${name}-`, `-${clip.authorId}-`);
                                await this._upload(ctx, dstimagemp4path, imageMp4Title);
                                ctx.logger.info(`上传视频${dstimagemp4path}结束`);
                            } catch (ex) {
                                // 就算上传失败，也不影响接下来的操作
                                ctx.logger.error(ex);
                            }
                        }

                        ctx.logger.info('开始flv转mp4');
                        await this._toMP4(ctx, dstflvpath, dstmp4path);
                        // 复制mp4到od1,od2和root区
                        // 时间长度够了才放
                        if (duration >= config.rec.minInterval) {
                            await copyFile(dstmp4path, rootmp4path);
                            ctx.logger.info(`复制${dstmp4path}到${rootmp4path}结束`);
                            if (this.od1Map.has(clip.authorId)) {
                                const od1Prefix = this.od1Map.get(clip.authorId);
                                const od1mp4path = `${config.rec.od1}/${od1Prefix}/${mp4name.substring(0, 4)}.${mp4name.substring(4, 6)}/${mp4name}`;
                                await copyFile(dstmp4path, od1mp4path);
                                ctx.logger.info(`复制${dstmp4path}到${od1mp4path}结束`);
                            }
                            if (this.od2Map.has(clip.authorId)) {
                                const od2Prefix = this.od2Map.get(clip.authorId);
                                const od2mp4path = `${config.rec.od2}/${od2Prefix}/${mp4name.substring(0, 4)}.${mp4name.substring(4, 6)}/${mp4name}`;
                                await copyFile(dstmp4path, od2mp4path);
                                ctx.logger.info(`复制${dstmp4path}到${od2mp4path}结束`);
                            }

                            // 复制xml到od1和od2和root区
                            await copyFile(dstxmlpath, rootxmlpath);
                            ctx.logger.info(`复制${dstxmlpath}到${rootxmlpath}结束`);
                            if (this.od1Map.has(clip.authorId)) {
                                const od1Prefix = this.od1Map.get(clip.authorId);
                                const od1xmlpath = `${config.rec.od1}/${od1Prefix}/${xmlname.substring(0, 4)}.${xmlname.substring(4, 6)}/${xmlname}`;
                                await copyFile(dstxmlpath, od1xmlpath);
                                ctx.logger.info(`复制${dstxmlpath}到${od1xmlpath}结束`);
                            }
                            if (this.od2Map.has(clip.authorId)) {
                                const od2Prefix = this.od2Map.get(clip.authorId);
                                const od2xmlpath = `${config.rec.od2}/${od2Prefix}/${xmlname.substring(0, 4)}.${xmlname.substring(4, 6)}/${xmlname}`;
                                await copyFile(dstxmlpath, od2xmlpath);
                                ctx.logger.info(`复制${dstxmlpath}到${od2xmlpath}结束`);
                            }
                        }

                        await unlink(livexmlpath);
                        ctx.logger.info(`删除${livexmlpath}结束`);
                        await unlink(liveflvpath);
                        ctx.logger.info(`删除${liveflvpath}结束`);
                    } catch (ex) {
                        ctx.logger.error(ex);
                    }
                });
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

    _upload = async (ctx, mp4path, title) => {
        return new Promise((res, rej) => {
            const cmd = [
                '-u', config.up.cookiepath,
                'upload', mp4path,
                '--title', title,
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