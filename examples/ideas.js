const {GatewayIntents, Endpoints, TimeoutError, Client, LoggerFactory} = require('../disjs/index');
const fs = require('fs').promises;
const {argv} = require('process');

(async () => {
    const config = JSON.parse(await fs.readFile('./local/config.json'));
    const client = new Client({
        token: 'Bot ' + config.token,
        intents: GatewayIntents.MESSAGE_CONTENT | GatewayIntents.GUILD_MESSAGES,
        shard: true,
        loggerFactory: new LoggerFactory(),
    });
    if (argv[2] === 'sync') {
        console.log('Syncing...');
        const app = await client.rest.request(Endpoints.GET_CURRENT_APPLICATION()).then(response => response.json());
        await client.rest.request(Endpoints.BULK_OVERWRITE_GLOBAL_APPLICATION_COMMANDS(app.id), {json: [
            {
                type: 1,
                name: 'suggest',
                description: 'Suggest an idea',
                dm_permission: false,
            }
        ]});
        console.log('Synced');
        return;
    }
    // console.log(await client.rest.request(Endpoints.GET_CURRENT_USER()).then(r => r.json()));
    await client.run({prepare: (shard) => {
        shard.listen('READY', ({user}) => {
            console.log(`Logged as ${user.username}#${user.discriminator}!`);
        });
        shard.listen('INTERACTION_CREATE', async ({id, type, data, member, token}) => {
            switch (type) {
            case 2: {
                if (data.name === 'suggest') {
                    await client.rest.request(Endpoints.CREATE_INTERACTION_RESPONSE(id, token), {
                        json: {
                            type: 9,
                            data: {
                                custom_id: 'send_suggestion',
                                title: 'Suggestion',
                                components: [
                                    {
                                        type: 1,
                                        components: [
                                            {
                                                type: 4,
                                                custom_id: 'description',
                                                style: 2,
                                                label: 'Description',
                                                min_length: 10,
                                                max_length: 100,
                                                required: true,
                                            }
                                        ]
                                    }
                                ],
                            },
                        },
                    });
                }
                break;
            }
            case 5: {
                if (data.custom_id === 'send_suggestion') {
                    await client.rest.request(Endpoints.CREATE_MESSAGE(config.channel_id), {
                        json: {
                            embeds: [
                                {
                                    title: 'Suggestion #1',
                                    author: {name: member.user.username},
                                    fields: [{
                                        name: 'Reputation',
                                        value: '0 people reacted',
                                        inline: false,
                                    }],
                                }
                            ],
                            components: [
                                {
                                    type: 1,
                                    components: [{
                                        type: 3,
                                        custom_id: 'evaluate_suggestion',
                                        options: [
                                            {label: '1 star', value: 'star:1'},
                                            {label: '2 stars', value: 'star:2'},
                                            {label: '3 stars', value: 'star:3'},
                                            {label: '4 stars', value: 'star:4'},
                                            {label: '5 stars', value: 'star:5'},
                                        ],
                                        placeholder: 'Evaluate that suggestion...',
                                    }],
                                },
                            ],
                        },
                    });
                    await client.rest.request(Endpoints.CREATE_INTERACTION_RESPONSE(id, token), {
                        json: {type: 4, data: {content: 'Suggestion was sent.', flags: 64}},
                    });
                }
                break;
            }
            }
        });
        shard.listen('MESSAGE_CREATE', async (data) => {
            if (data.content === '!ping') {
                await client.rest.request(Endpoints.CREATE_MESSAGE(data.channel_id), {json: {content: 'pong!'}});
            }
        });
    }});
})().then(() => {}).catch(console.error);