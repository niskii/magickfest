import { REST, Routes, SlashCommandBuilder } from "discord.js";
import "dotenv/config";

async function deployCommands() {
    const commands = [
    ];

    const rest = new REST({ version: "10" }).setToken(
        process.env.DiscordBotToken,
    );

    await rest.post(
        Routes.applicationCommands(process.env.ClientId),
        {
            body: new SlashCommandBuilder()
                .setName("example")
                .setDescription("example command")
                .toJSON(),
        }
    );

    console.log("commands deployed");
}

deployCommands().catch((error) => {
    console.error("failed to deploy commands ", error);
    process.exit(1);
});