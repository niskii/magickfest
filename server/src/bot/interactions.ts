import { PlaybackState } from "@shared/types/player-state";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    GuildMember,
    Interaction,
    InteractionReplyOptions,
    MessageFlags,
} from "discord.js";
import { existsSync } from "fs";
import * as path from "path";
import { getDiscordEnvironment } from "../envs";
import { parseTime } from "../parsing/time-parser";
import { Player } from "../player/player";
import { PlayerStateManager } from "../player/player-state-manager";
import { sendMessage } from "./actions";
import { client } from "./setup";

const envs = getDiscordEnvironment();

const publicCommands = ["np", "setlist"];

async function isAdmin(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const hasRole = member.roles.cache.has(envs.AdminRoleID);

    if (!hasRole) {
        await interaction.reply({
            content: `you are not authorized to run this command`,
            flags: MessageFlags.Ephemeral,
        });
    }

    return hasRole;
}

async function handleTimeParsing(interaction: ChatInputCommandInteraction) {
    let parsedTime = parseTime(interaction.options.getString("time"));

    if (parsedTime === null) {
        interaction.reply({
            content: `could not parse the input time!`,
            flags: MessageFlags.Ephemeral,
        });
        parsedTime = 0;
    } else {
        parsedTime *= 1000;
    }

    return parsedTime;
}

async function replyPlaybackState(
    player: Player,
    interaction: ChatInputCommandInteraction,
) {
    const state = player.getState().state;
    let content;
    switch (state) {
        case PlaybackState.Running:
            content = "magickfest is already running!";
            break;
        case PlaybackState.Stopped:
            content = "magickfest isn't running yet!";
            break;
        case PlaybackState.Paused:
            content = "magickfest is already paused!";
            break;

        default:
            break;
    }
    await interaction.reply({ content: content });
}

function fancySchmancyTimeConverter(time: number) {
    time = Math.round(time);
    return (
        Math.floor(time / 60)
            .toString()
            .padStart(2, "0") +
        ":" +
        Math.floor(time % 60)
            .toString()
            .padStart(2, "0")
    );
}

function fancySchmancyBarConverter(time: number, fullTime: number) {
    let finalMsg = "";
    let timestampPoint = time < fullTime / 15;
    let hasAppended = false;

    for (let i = 2; i < 17; i++) {
        if (timestampPoint && !hasAppended) {
            finalMsg += "o";
            hasAppended = true;
        }
        finalMsg += "⏤";
        timestampPoint = time < (fullTime / 15) * i;
    }

    if (timestampPoint && !hasAppended) finalMsg += "o";

    return finalMsg;
}

function handleSetInfo(info: String, noInfo: String) {
    return (info) ? info : noInfo;
}

export function configureInteractions(
    player: Player,
    playerStateManager: PlayerStateManager,
) {
    player.events?.on("newSet", async () => {
        const currentSet = player.getCurrentSet();
        await sendMessage(
            `# now playing: ${handleSetInfo(currentSet.Author, '[unknown author]')} - ${handleSetInfo(currentSet.Title, '[untitled]')}`,
        );
    });

    client.on("interactionCreate", async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        // Check if admin permissions are relevant once.
        if (
            !publicCommands.includes(commandName) &&
            !(await isAdmin(interaction))
        )
            return;

        try {
            switch (commandName) {
                case "np":
                    if (!player.isPlayerRunning()) return;

                    const currentSet = player.getCurrentSet();
                    const coverPath = path.resolve(currentSet.CoverFile!);
                    let attachment: AttachmentBuilder;

                    let reply: InteractionReplyOptions = {
                        content: "",
                        embeds: [
                            {
                                title: "MAGICKFEST 2026",
                                description: `# NOW PLAYING: ${handleSetInfo(currentSet.Author, '[unknown author]')} - ${handleSetInfo(currentSet.Title, '[untitled]')}\n${fancySchmancyBarConverter(player.getCurrentPositionSeconds(), currentSet.Seconds as number)}⠀ ${fancySchmancyTimeConverter(player.getCurrentPositionSeconds())}/${fancySchmancyTimeConverter(currentSet.Seconds as number)}`,
                                color: 2326507,
                                fields: [],
                                thumbnail: {
                                    url: "attachment://cover.png",
                                },
                            },
                        ],
                    };

                    if (existsSync(coverPath)) {
                        attachment = new AttachmentBuilder(coverPath, {
                            name: "cover.png",
                        });
                        reply.files = [attachment];
                    }

                    await interaction.reply(reply);
                    break;

                case "setlist":
                    if (!player.isPlayerRunning()) return;
                    let finalString = "";
                    let lastSetTime = Math.round(
                        player.getState().startTime / 1000,
                    );

                    player.getPlaylistSets().forEach((set) => {
                        finalString +=
                            "(<t:" +
                            lastSetTime +
                            ":t>-<t:" +
                            (lastSetTime + Math.round(set.Seconds as number)) +
                            ":t>) " +
                            handleSetInfo(set.Author, '[unknown author]') +
                            " - " +
                            handleSetInfo(set.Title, '[untitled]') +
                            "\n";
                        lastSetTime += Math.round(set.Seconds as number);
                    });

                    await interaction.reply({
                        content: `# setlist\n${finalString}`,
                    });

                    break;

                case "start":
                    if (!player.isPlayerRunning()) {
                        if (playerStateManager.hasLoaded) {
                            player.playAtState();
                        } else {
                            player.playAtForwarded();
                        }

                        await interaction.reply({
                            content: `starting magickfest!`,
                        });
                    } else {
                        replyPlaybackState(player, interaction);
                    }

                    break;

                case "pause":
                    if (player.isPlayerRunning()) {
                        player.pause();

                        await interaction.reply({
                            content: `pausing magickfest!`,
                        });
                    } else {
                        replyPlaybackState(player, interaction);
                    }

                    break;

                case "resume":
                    if (player.isPlayerPaused()) {
                        player.resume();

                        await interaction.reply({
                            content: `resuming magickfest!`,
                        });
                    } else {
                        replyPlaybackState(player, interaction);
                    }

                    break;

                case "playnext":
                    if (player.isPlayerRunning()) {
                        player.nextSet();
                        player.playAtStart();

                        await interaction.reply({
                            content: `playing next set!`,
                        });
                    } else {
                        replyPlaybackState(player, interaction);
                    }

                    break;

                case "seek":
                    if (player.isPlayerRunning()) {
                        const parsedTime = await handleTimeParsing(interaction);
                        player.setState(null, null, parsedTime);
                        player.playAtForwarded();

                        await interaction.reply({
                            content: `playing the current set at the given point of time!`,
                        });
                    } else {
                        replyPlaybackState(player, interaction);
                    }

                    break;

                case "playset":
                    const setIndex = interaction.options.getInteger("index");
                    const parsedTime = await handleTimeParsing(interaction);
                    player.setState(setIndex, null, parsedTime);
                    player.playAtForwarded();

                    await interaction.reply({
                        content: `playing a specific set!`,
                    });

                    break;

                default:
                    break;
            }
        } catch (err) {
            console.error(err);

            if (interaction.isRepliable()) {
                await interaction.reply({
                    content: "borked",
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    });
}
