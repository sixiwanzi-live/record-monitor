import { stat } from 'fs/promises';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import config from './config.js';

export default class BlrecService {

    constructor() {
        this.emitter = new EventEmitter();
        this.emitter.on("rclone", async (dst, remoteDst) => {
            try {
                // 上传转码后mp4
                await new Promise((res, rej) => {
                    let cmd = [
                        'copy', dst,
                        remoteDst,
                        '-P', '--bwlimit', '3M'
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
            }
        });
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
                const remoteDst = config.blrec.whitelist.filter(item => item.roomId === roomId)[0].remoteDst;
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
                this.emitter.emit("rclone", dst, remoteDst);
                
                // const xml = dst.replaceAll('.mp4', '.xml');
                // // 上传弹幕xml文件
                // await new Promise((res, rej) => {
                //     let cmd = [
                //         'copy', xml,
                //         remoteDst
                //     ];
                //     let p = spawn('rclone', cmd);
                //     p.stdout.on('data', (data) => {
                //         console.log('stdout: ' + data.toString());
                //     });
                //     p.stderr.on('data', (data) => {
                //         console.log('stderr: ' + data.toString());
                //     });
                //     p.on('close', (code) => {
                //         console.log(`rclone上传结束:${xml}, code:${code}`);
                //         res();
                //     });
                //     p.on('error', (error) => {
                //         console.log(error);
                //         rej(error);
                //     });
                // });
            } catch (ex) {
                console.log(ex);
                return ex;
            } 
        }
    }
}