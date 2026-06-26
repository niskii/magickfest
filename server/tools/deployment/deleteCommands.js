import { REST, Routes } from "discord.js";
import "dotenv/config";

async function clearCommands() {
    const rest = new REST({ version: "10" }).setToken(
        process.env.DiscordBotToken,
    );

    const commandId = ""; // put command id here

    await rest.delete(
        Routes.applicationCommand(process.env.ClientId, commandId),
    );

    console.log("All global commands removed");
}

clearCommands().catch(console.error);