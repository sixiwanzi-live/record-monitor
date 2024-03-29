import { stat, unlink } from 'fs/promises';
import { spawn } from 'child_process';
import moment from 'moment';
import config from './config.js';

export default class BlrecService {

    constructor() {
        // this.busy = false;
        this.userMap = new Map();
        this.openMap = new Map();
    }

    webhook = async (ctx) => {
        const body = ctx.request.body;
        ctx.logger.info(body);

        const type = body.type;
        if (type === 'VideoPostprocessingCompletedEvent') {
            ctx.logger.info('视频处理完成webhook');
            const roomId = body.data.room_id;
            const src = body.data.path;
            const name = this.userMap.has(roomId) ? this.userMap.get(roomId) : '昵称未识别';
            const date = this.openMap.has(roomId) ? moment(this.openMap.get(roomId)).format('YYYY.MM') : '日期未识别';
            ctx.logger.info(`房间号:${roomId}, 用户:${name}, 开播时间:${date}, 视频文件:${src}`);

            try {
                const rooms = config.blrec.whitelist.filter(item => item.rooms.includes(roomId));
                if (!rooms || rooms.length === 0) {
                    return;
                }
                // 创建remoteDst
                const remoteDsts = rooms.map(room => {
                    let remoteDst = `${room.remote}:`;
                    if (room.hasNameDir) remoteDst = `${remoteDst}/${name}`;
                    if (room.hasDateDir) remoteDst = `${remoteDst}/${date}`;
                    ctx.logger.info(`远程文件夹:${remoteDst}`);
                    return remoteDst;
                });
                // 确保文件存在
                const res = await stat(src);
                if (res.size <= 0) {
                    throw '文件大小为0';
                }
                // 将会生成同名mp4文件
                const dst = src.replaceAll('.flv', '.mp4');

                await new Promise((res, rej) => {
                    let cmd = [
                        '-y',
                        '-i', src,
                        '-c', 'copy',
                        '-movflags', 'faststart',
                        dst
                    ];
                    let p = spawn('ffmpeg', cmd);
                    p.stdout.on('data', (data) => {
                        ctx.logger.info('stdout: ' + data.toString());
                    });
                    p.stderr.on('data', (data) => {
                        ctx.logger.info('stderr: ' + data.toString());
                    });
                    p.on('close', (code) => {
                        ctx.logger.info(`转码结束:${dst}, code:${code}`);
                        res();
                    });
                    p.on('error', (error) => {
                        ctx.logger.error(`错误码:${error}`);
                        rej(error);
                    });
                });
                await stat(dst);

                const timer = setInterval(async () => {
                    try {
                        // if (this.busy) return;
                        // this.busy = true;
                        clearInterval(timer);
                        // 上传转码后mp4
                        let tasks = remoteDsts.map(remoteDst => {
                            return new Promise((res, rej) => {
                                let cmd = [
                                    'copy', `${dst}`,
                                    `${remoteDst}`,
                                    '-P', '--bwlimit', `${config.blrec.limit.upload}M`
                                ];
                                let p = spawn('rclone', cmd);
                                p.stdout.on('data', (data) => {
                                    ctx.logger.info('stdout: ' + data.toString());
                                });
                                p.stderr.on('data', (data) => {
                                    ctx.logger.info('stderr: ' + data.toString());
                                });
                                p.on('close', (code) => {
                                    ctx.logger.info(`rclone上传结束:${dst}, ${remoteDst}, code:${code}`);
                                    if (code === 0) {
                                        res();
                                    } else {
                                        rej(code);
                                    }
                                });
                                p.on('error', (error) => {
                                    ctx.logger.error(`错误码:${error}`);                                
                                    rej(error);
                                });
                            });
                        });
                        await Promise.all(tasks);
                        if (config.blrec.autoRemove) {
                            // 如果上传成功，则删除blrec生成的所有原始文件
                            await unlink(src);
                            await unlink(`${src}.meta.json`);
                            await unlink(dst);
                        }
                        // this.busy = false;
                    } catch (ex) {
                        ctx.logger.error(`Exception: ${ex}`);
                    }
                }, 1000);
            } catch (ex) {
                ctx.logger.error(`Exception: ${ex}`);
                return ex;
            } 
        } else if (type === 'DanmakuFileCompletedEvent') {
            ctx.logger.info('弹幕完成webhook');
            const roomId = body.data.room_id;
            const src = body.data.path;
            const name = this.userMap.has(roomId) ? this.userMap.get(roomId) : '昵称未识别';
            const date = this.openMap.has(roomId) ? moment(this.openMap.get(roomId)).format('YYYY.MM') : '日期未识别';
            ctx.logger.info(`房间号:${roomId}, 用户:${name}, 开播时间:${date}, 视频文件:${src}`);

            try {
                const dst = src;
                const rooms = config.blrec.whitelist.filter(item => item.rooms.includes(roomId));
                if (!rooms || rooms.length === 0) {
                    return;
                }
                // 创建remoteDst
                const remoteDsts = rooms.map(room => {
                    let remoteDst = `${room.remote}:`;
                    if (room.hasNameDir) remoteDst = `${remoteDst}/${name}`;
                    if (room.hasDateDir) remoteDst = `${remoteDst}/${date}`;
                    ctx.logger.info(`远程文件夹:${remoteDst}`);
                    return remoteDst;
                });
                // 确保文件存在
                const res = await stat(dst);
                if (res.size <= 0) {
                    throw '文件大小为0';
                }
                // 上传弹幕
                let tasks = remoteDsts.map(remoteDst => {
                    return new Promise((res, rej) => {
                        let cmd = [
                            'copy', dst,
                            remoteDst
                        ];
                        let p = spawn('rclone', cmd);
                        p.stdout.on('data', (data) => {
                            ctx.logger.info('stdout: ' + data.toString());
                        });
                        p.stderr.on('data', (data) => {
                            ctx.logger.info('stderr: ' + data.toString());
                        });
                        p.on('close', (code) => {
                            ctx.logger.info(`rclone上传结束:${dst}, ${remoteDst}, code:${code}`);
                            if (code === 0) {
                                res();
                            } else {
                                rej();
                            }
                        });
                        p.on('error', (error) => {
                            ctx.logger.error(`错误码:${error}`);       
                            rej(error);
                        });
                    });
                });
                await Promise.all(tasks);
                if (config.blrec.autoRemove) {
                    await unlink(dst);
                }
            } catch (ex) {
                ctx.logger.error(`Exception: ${ex}`);
                return ex;
            }
        } else if (type === 'LiveBeganEvent') {
            ctx.logger.info('开播webhook');
            const roomId = body.data.room_info.room_id;
            const name = body.data.user_info.name;
            const timestamp = body.data.room_info.live_start_time * 1000;
            ctx.logger.info(`房间号:${roomId}, 用户:${name}, 开播时间:${moment(timestamp).format("YYYY-MM-DD HH:mm:ss")}`);
            this.userMap.set(roomId, name);
            this.openMap.set(roomId, timestamp);
        }
    }
}