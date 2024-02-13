# disjs

A low-level Discord JavaScript library, for Gateway and HTTP API.

## Example

```js
const {GatewayIntents, Endpoints, Client} = require('../disjs/index');

const main = (async () => {
    const client = new Client({
        token: 'Bot <token>',
        intents: GatewayIntents.MESSAGE_CONTENT | GatewayIntents.GUILD_MESSAGES,
        shard: true,
    });
    client.listen('READY', ({data: {user}}) => {
        console.log(`Logged as ${user.username}#${user.discriminator}!`);
    });
    client.listen('MESSAGE_CREATE', async ({rest, data}) => {
        if (data.content === '!ping') {
            await rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: 'pong!'}});
        }
    });
    await client.run();
    console.log('Bot is ran.');
});
main().then(() => {}).catch(console.error);
```