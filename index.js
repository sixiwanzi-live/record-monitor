import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import koaBody from 'koa-body';
import config from './config.js';
import BlrecService from './BlrecService.js';

(async () => {
    const app = new Koa({ proxy: true });
    const router = new Router();

    app.context.blrecService = new BlrecService();
    
    /**
     * hello
     */
    router.get('/hello', ctx => {
        ctx.body = 'hello';
    });

    /**
     * webhook
     */
    router.post('/blrec/webhook', async ctx => {
        ctx.body = await ctx.blrecService.webhook(ctx);
    });

    app.use(koaBody({ 
        jsonLimit: config.web.bodyLimit
    }));
    
    app.use(cors());
    app.use(router.routes());

    app.listen(config.web.port);
})();
