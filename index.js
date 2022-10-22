import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import koaBody from 'koa-body';
import logger from 'koa-logger';
import pino from 'pino';
import config from './config.js';
import BlrecService from './BlrecService.js';
import moment from 'moment';

(async () => {
    const app = new Koa({ proxy: true });
    const router = new Router();

    app.context.logger = pino({ transport: { target: 'pino-pretty' } });
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

    app.use(logger((str, args) => {
        let line = `${args[1]} ${args[2] || ''} ${args[3] || ''} ${args[4] || ''} ${args[5] || ''}`;
        line = line.trim();
        app.context.logger.info(line);
    }));
    
    app.use(cors());
    app.use(router.routes());

    app.listen(config.web.port);
})();
