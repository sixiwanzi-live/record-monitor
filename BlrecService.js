import { stat, rename } from 'fs/promises';
import { spawn, exec } from 'child_process';
import config from './config.js';
import BiliApi from './BiliApi.js';

export default class BlrecService {

    constructor() {
        this.busy = false;
        this.userMap = new Map();
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
            if (!this.userMap.has(roomId)) {
                console.log(`Room(${roomId})找不到用户名`);
                return; 
            }

            try {
                const rooms = config.blrec.whitelist1.filter(item => item.rooms.includes(roomId));
                // const rooms = config.blrec.whitelist.filter(item => item.roomId === roomId);
                if (!rooms || rooms.length === 0) {
                    return;
                }
                // const remoteDst = rooms[0].remoteDst;
                const remoteDst = `${rooms[0].dir}:/${this.userMap.get(roomId)}`;
                console.log(`远程文件夹为:${remoteDst}`);
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
                                console.log('stdout: ' + data.toString());
                            });
                            p.stderr.on('data', (data) => {
                                console.log('stderr: ' + data.toString());
                            });
                            p.on('close', (code) => {
                                this.busy = false;
                                console.log(`rclone上传结束:${dst}, code:${code}`);
                                res();
                            });
                            p.on('error', (error) => {
                                this.busy = false;
                                console.log(error);
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
            if (!this.userMap.has(roomId)) {
                console.log(`Room(${roomId})找不到用户名`);
                return; 
            }

            try {
                const dst = src;
                const rooms = config.blrec.whitelist1.filter(item => item.rooms.includes(roomId));
                // const rooms = config.blrec.whitelist.filter(item => item.roomId === roomId);
                if (!rooms || rooms.length === 0) {
                    return;
                }
                const remoteDst = `${rooms[0].dir}:/${this.userMap.get(roomId)}`;
                // const remoteDst = rooms[0].remoteDst;
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
        } else if (type === 'VideoFileCompletedEvent') {
            console.log('视频结束webhook');
            const roomId = body.data.room_id;
            console.log(`房间号:${roomId}`);
            if (!this.userMap.has(roomId)) {
                const roomInfo = await BiliApi.getRoomInfo(roomId);
                if (!roomInfo) {
                    throw `房间id(${roomId})所属uid没找到`;
                }
                const uid = roomInfo.uid;
                const userInfo = await BiliApi.getUserInfo(uid);
                if (!userInfo) {
                    throw `用户id(${uid})所属昵称没找到`;
                }
                console.log(`创建用户关联Room(${roomId}), User(${userInfo.name})`);
                this.userMap.set(roomId, userInfo.name);
            }
        }
    }
}