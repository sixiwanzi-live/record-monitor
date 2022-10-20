import { stat } from 'fs/promises';
import { spawn } from 'child_process';
import moment from 'moment';
import config from './config.js';

export default class BlrecService {

    constructor() {
        this.busy = false;
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
            const date = this.openMap.has(roomId) ? moment(this.openMap.get(roomId)).format('YYYY.MM') : '年月未识别';
            ctx.logger.info(`房间号:${roomId}, 用户:${name}, 开播时间:${date}, 视频文件:${src}`);

            try {
                const rooms = config.blrec.whitelist.filter(item => item.rooms.includes(roomId));
                if (!rooms || rooms.length === 0) {
                    return;
                }
                const remoteDst = config.blrec.dst.datePrefix ? `${rooms[0].dir}:/${date}/${name}` : `${rooms[0].dir}:/${name}`;
                ctx.logger.info(`远程文件夹:${remoteDst}`);
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
                        if (this.busy) return;
                        this.busy = true;
                        clearInterval(timer);
                        // 上传转码后mp4
                        await new Promise((res, rej) => {
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
                                this.busy = false;
                                ctx.logger.info(`rclone上传结束:${dst}, code:${code}`);
                                res();
                            });
                            p.on('error', (error) => {
                                this.busy = false;
                                ctx.logger.error(`错误码:${error}`);                                
                                rej(error);
                            });
                        });
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
            const date = this.openMap.has(roomId) ? moment(this.openMap.get(roomId)).format('YYYY.MM') : '年月未识别';
            ctx.logger.info(`房间号:${roomId}, 用户:${name}, 开播时间:${date}, 视频文件:${src}`);

            try {
                const dst = src;
                const rooms = config.blrec.whitelist.filter(item => item.rooms.includes(roomId));
                if (!rooms || rooms.length === 0) {
                    return;
                }
                const remoteDst = config.blrec.dst.datePrefix ? `${rooms[0].dir}:/${date}/${name}` : `${rooms[0].dir}:/${name}`;
                ctx.logger.info(`远程文件夹:${remoteDst}`);
                // 确保文件存在
                const res = await stat(dst);
                if (res.size <= 0) {
                    throw '文件大小为0';
                }
                // 上传弹幕
                await new Promise((res, rej) => {
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
                        ctx.logger.info(`rclone上传结束:${dst}, code:${code}`);
                        res();
                    });
                    p.on('error', (error) => {
                        ctx.logger.error(`错误码:${error}`);       
                        rej(error);
                    });
                });
            } catch (ex) {
                ctx.logger.error(`Exception: ${ex}`);
                return ex;
            }
        } else if (type === 'LiveBeganEvent') {
            ctx.logger.info('开播webhook');
            const roomId = body.data.room_info.room_id;
            const name = body.data.user_info.name;
            const time = body.data.room_info.live_start_time;
            ctx.logger.info(`房间号:${roomId}, 用户:${name}, 开播时间:${moment(time).format("YYYY-MM-DD HH:MM:SS")}`);
            this.userMap.set(roomId, name);
            this.openMap.set(roomId, time);
        }
    }
}