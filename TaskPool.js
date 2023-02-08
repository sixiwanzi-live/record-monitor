export default class TaskPool {
    constructor() {
        this.pool = [];
    }

    push = (cb) => {
        this.pool.push(cb);
    }

    run = async () => {
        while (true) {
            while (this.pool.length > 0) {
                const cb = this.pool.shift();
                try {
                    await cb();
                } catch (ex) {
                    console.log(ex);
                }
            }
            await new Promise((res, rej) => {
                setTimeout(() => {
                    res();
                }, 1000);
            });
        }
    }
}