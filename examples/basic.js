const {GatewayIntents, Endpoints, Client, LoggerFactory, Logger, LoggerLevel} = require('../disjs/index');
const fs = require('fs').promises;

(async () => {
    const config = JSON.parse(await fs.readFile('./local/config.json'));
    const client = new Client({
        token: 'Bot ' + config.token,
        intents: GatewayIntents.MESSAGE_CONTENT | GatewayIntents.GUILD_MESSAGES,
        shard: true,
        loggerFactory: new LoggerFactory({
            level: (name) => {
                if (name.startsWith('disjs.')) {
                    return LoggerLevel.TRACE;
                }
                return null;
            }
        }),
    });
    // console.log(await client.rest.request(Endpoints.GET_CURRENT_USER()).then(r => r.json()));
    client.listen('MESSAGE_CREATE', async ({data, rest}) => {
        if (data.content === '!ping') {
            await rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: 'pong!'}});
        }
    });
    await client.run(); 
    console.log('Logged into bot.');
})().then(() => {}).catch(console.error);