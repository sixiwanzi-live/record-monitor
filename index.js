import { readdir } from 'fs/promises';
import { spawn } from 'child_process';

const userMap = new Map();
userMap.set("22637261 - 嘉然今天吃什么", "ASOUL");

const recordPath = '../video';
(async () => {
    const dirs = await readdir(recordPath);
    for (const dir of dirs) {
        console.log(dir);
        if (dir.indexOf('archives') !== -1)
            continue;
        const files = await readdir(`${recordPath}/${dir}`);
        for (const file of files) {
            if (file.indexOf('.flv') !== -1) {
                console.log(file);
                const flv = `${recordPath}/${dir}/${file}`;
                const mp4 = `${recordPath}/${dir}/${file.replace('.flv', 'mp4')}`;
                try {
                    await new Promise((res, rej) => {
                        let cmd = [
                            '-i', flv,
                            '-c', 'copy',
                            '-movflags', 'faststart',
                            mp4
                        ];
                        let p = spawn('ffmpeg', cmd);
                        p.stdout.on('data', (data) => {
                            console.log('stdout: ' + data.toString());
                        });
                        p.stderr.on('data', (data) => {
                            console.log('stderr: ' + data.toString());
                        });
                        p.on('close', (code) => {
                            res(code);
                        });
                        p.on('error', (error) => {
                            console.log(error);
                            rej(error);
                        });
                    });
                    
                } catch (ex) {
                    console.log(ex);
                    break;
                }
            }
        }
    }
})();