const {GatewayIntents, Endpoints, TimeoutError, Client, LoggerFactory} = require('../disjs/index');
const fs = require('fs').promises;

(async () => {
    const config = JSON.parse(await fs.readFile('./local/config.json'));
    const client = new Client({
        token: 'Bot ' + config.token,
        intents: GatewayIntents.MESSAGE_CONTENT | GatewayIntents.GUILD_MESSAGES,
        shard: true,
        loggerFactory: new LoggerFactory(),
    });
    // console.log(await client.rest.request(Endpoints.GET_CURRENT_USER()).then(r => r.json()));
    await client.run({prepare: (shard) => {
        shard.listen('READY', ({user}) => {
            console.log(`Logged as ${user.username}#${user.discriminator}!`);
        });
        shard.listen('MESSAGE_CREATE', async (data) => {
            if (data.content === '!sum') {
                await client.rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: 'OK. Let\'s sum. Type first number (you have 10 seconds):'}});
                let x = null;
                try {
                    x = await shard.waitForDispatch('MESSAGE_CREATE', {timeout: 10000, check: (d) => d.author.id == data.author.id});
                    // equivalent to:
                    // [, x] = await shard.waitFor('dispatch', {timeout: 10000, check: (t, d) => t === 'MESSAGE_CREATE' && d.author.id == data.author.id});
                } catch (err) {
                    if (err instanceof TimeoutError) {
                        await client.rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: 'Timed out.'}});
                        return;
                    }
                }
                if (isNaN(x = parseInt(x.content))) {
                    await client.rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: 'Not a number.'}});
                    return;
                }
                let y = null;
                try {
                    y = await shard.waitForDispatch('MESSAGE_CREATE', {timeout: 10000, check: (d) => d.author.id == data.author.id});
                    // equivalent to:
                    // [, y] = await shard.waitFor('dispatch', {timeout: 10000, check: (t, d) => t === 'MESSAGE_CREATE' && d.author.id == data.author.id});
                } catch (err) {
                    if (err instanceof TimeoutError) {
                        await client.rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: 'Timed out.'}});
                        return;
                    }
                }
                console.log(y);
                if (isNaN(y = parseInt(y.content))) {
                    await client.rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: 'Not a number.'}});
                    return;
                }
                await client.rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: `The sum of ${x} and ${y} is ${x + y}.`}});
            }
        });
    }});
})().then(() => {}).catch(console.error);