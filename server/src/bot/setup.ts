import { Client, GatewayIntentBits, Interaction, Intents } from "discord.js";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildIntegrations]
});

const TOKEN = process.env.DiscordBotToken;

const ready = new Promise<void>((resolve) => {
    client.once("clientReady", async () => {
        console.log("bot is ready");
        resolve();
    });
});

client.login(TOKEN);

export { client, ready };