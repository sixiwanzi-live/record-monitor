import { stat, rename } from 'fs/promises';
import { spawn, exec } from 'child_process';
import config from './config.js';

export default class BlrecService {

    constructor() {
        this.busy = false;
    }

    webhook = async (ctx) => {
        const body = ctx.request.body;
        console.log(body);

        const type = body.type;
        if (type === 'VideoPostprocessingCompletedEvent') {
            console.log('视频完成webhook');
            const roomId = body.data.room_id;
            const src = body.data.path;
            console.log(`房间号:${roomId}, 视频文件:${src}`);

            try {
                const rooms = config.blrec.whitelist.filter(item => item.roomId === roomId);
                if (!rooms || rooms.length === 0) {
                    return;
                }
                const remoteDst = rooms[0].remoteDst;
                console.log(`远程文件夹为:${remoteDst}`);
                // 确保文件存在
                const res = await stat(src);
                if (res.size <= 0) {
                    throw '文件大小为0';
                }
                // 将会生成同名mp4文件
                const dst = src.replaceAll('/index.m3u8', '.mp4');

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
                        console.log('stdout: ' + data.toString());
                    });
                    p.stderr.on('data', (data) => {
                        console.log('stderr: ' + data.toString());
                    });
                    p.on('close', (code) => {
                        console.log(`转码结束:${dst}, code:${code}`);
                        res();
                    });
                    p.on('error', (error) => {
                        console.log(error);
                        rej(error);
                    });
                });
                await stat(dst);

                const timer = setInterval(async () => {
                    try {
                        if (this.busy) return;
                        this.busy = true;
                        // 上传转码后mp4
                        await new Promise((res, rej) => {
                            let cmd = [
                                'copy', `"${dst}"`,
                                `"${remoteDst}"`,
                                '-P', '--bwlimit', `${config.blrec.limit.upload}M`
                            ];
                            let p = spawn('rclone', cmd);
                            p.stdout.on('data', (data) => {
                                console.log('stdout: ' + data.toString());
                            });
                            p.stderr.on('data', (data) => {
                                console.log('stderr: ' + data.toString());
                            });
                            p.on('close', (code) => {
                                this.busy = false;
                                console.log(`rclone上传结束:${dst}, code:${code}`);
                                clearInterval(timer);
                                res();
                            });
                            p.on('error', (error) => {
                                this.busy = false;
                                console.log(error);
                                clearInterval(timer);
                                rej(error);
                            });
                        });
                    } catch (ex) {
                        console.log(ex);
                    }
                }, 1000);
            } catch (ex) {
                console.log(ex);
                return ex;
            } 
        } else if (type === 'DanmakuFileCompletedEvent') {
            console.log('弹幕完成webhook');
            const roomId = body.data.room_id;
            const src = body.data.path;
            console.log(`房间号:${roomId}, 弹幕文件:${src}`);

            try {
                const dst = src.replaceAll('/index.xml', '.xml');
                await rename(src, dst);
                const rooms = config.blrec.whitelist.filter(item => item.roomId === roomId);
                if (!rooms || rooms.length === 0) {
                    return;
                }
                const remoteDst = rooms[0].remoteDst;
                console.log(`远程文件夹为:${remoteDst}`);
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
                        console.log('stdout: ' + data.toString());
                    });
                    p.stderr.on('data', (data) => {
                        console.log('stderr: ' + data.toString());
                    });
                    p.on('close', (code) => {
                        console.log(`rclone上传结束:${dst}, code:${code}`);
                        res();
                    });
                    p.on('error', (error) => {
                        console.log(error);
                        rej(error);
                    });
                });
            } catch (ex) {
                console.log(ex);
                return ex;
            }
        }
    }
}