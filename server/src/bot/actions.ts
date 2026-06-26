import { MessagePayload } from "discord.js";
import { client, ready } from "./setup";

const CHANNEL_ID = "1431036238474776708";

const sendMessage = async(message: string) => {
    await ready;

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        throw new Error("Channel not found or not text-based");
    }

    channel.send(message);
}

export { sendMessage }