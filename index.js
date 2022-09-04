import { readdir } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const recordPath = '../video';
(async () => {
    const dirs = await readdir(recordPath);
    for (const dir of dirs) {
        console.log(dir);
        const files = await readdir(`${recordPath}/${dir}`);
        for (const file of files) {
            if (file.indexOf('.mp4') !== -1) {
                console.log(file);
            }
        }
    }
})();