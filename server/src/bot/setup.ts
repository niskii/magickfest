import { Client, GatewayIntentBits } from "discord.js";
import { getDiscordEnvironment } from "../envs";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildIntegrations,
    ],
});

const TOKEN = getDiscordEnvironment().DiscordBotToken;

const ready = new Promise<void>((resolve) => {
    client.once("clientReady", async () => {
        console.log("bot is ready");
        resolve();
    });
});

client.login(TOKEN);

export { client, ready };
