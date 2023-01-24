import { spawn } from 'child_process';

export const toM4A = async (flvpath, m4apath) => {
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