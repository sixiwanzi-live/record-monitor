import { readdir } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const recordPath = '../video';
(async () => {
    const files = await readdir(recordPath);
    for (const file of files) {
        console.log(file);
    }
})();