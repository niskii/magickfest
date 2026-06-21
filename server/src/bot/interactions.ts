import { Player } from "../player/player";
import { Playlist } from "../player/playlist";
import { PlayerStateManager } from "../player/player-state-manager";
import { client } from "./setup";
import { sendMessage } from "./actions";
import { Interaction, GuildMember, MessageFlags, AttachmentBuilder } from "discord.js";
import { PlayerState } from "../types/player-state";
import * as path from "path";
import { openAsBlob, existsSync } from "fs";

async function isAdmin(interaction: Interaction) {
    const member = interaction.member as GuildMember;
    const hasRole = member.roles.cache.has(process.env.AdminRoleID);

    if (!hasRole) {
        await interaction.reply({
            content: `you are not authorized to run this command`,
            flags: MessageFlags.Ephemeral
        })
    }

    return hasRole;
}

async function isPlayerRunning(player: Player, interaction: Interaction, verboseOnTrue: boolean = false) {
    const isRunning = player.getState().state == PlayerState.Running;

    if (verboseOnTrue && isRunning) {
        await interaction.reply({
            content: 'magickfest is already running!'
        });
    }

    if (!verboseOnTrue && !isRunning) {
        await interaction.reply({
            content: 'magickfest isn\'t running yet!'
        });
    }

    return isRunning;
}

function fancySchmancyTimeConverter(time: number) {
    time = Math.round(time);
    return Math.floor(time / 60).toString().padStart(2, '0') + ':' + Math.floor(time % 60).toString().padStart(2, '0');
}

function fancySchmancyBarConverter(time: number, fullTime: number) {
    let finalMsg = '';
    let timestampPoint = time < (fullTime / 15);
    let hasAppended = false;

    for (let i = 2; i < 17; i++) {
        if (timestampPoint && !hasAppended) { finalMsg += 'o'; hasAppended = true; };
        finalMsg += '⏤';
        timestampPoint = time < ((fullTime / 15) * i);
    }

    if (timestampPoint && !hasAppended) finalMsg += 'o';

    return finalMsg;
}

export function configureInteractions(player: Player, playlist: Playlist, playerStateManager: PlayerStateManager) {
    player.events?.on("newSet", async () => {
        await sendMessage(`np: ${playlist.getCurrentSet().Author} - ${playlist.getCurrentSet().Title}`);
    })

    client.on("interactionCreate", async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        try {
            if (commandName == "np") {
                if (await isPlayerRunning(player, interaction)) {
                    const coverPath = path.join(__dirname, '../..', player.getPlaylist().getCurrentSet().CoverFile!);
                    let attachment;

                    if (existsSync(coverPath)) {
                        attachment = new AttachmentBuilder(coverPath, {
                            name: 'cover.png'
                        });
                    }

                    await interaction.reply({
                        content: '',
                        embeds: [
                            {
                                "title": "MAGICKFEST 2026",
                                "description": `# NOW PLAYING: ${player.getPlaylist().getCurrentSet().Author} - ${player.getPlaylist().getCurrentSet().Title}\n${fancySchmancyBarConverter(player.getCurrentPositionSeconds(), (player.getPlaylist().getCurrentSet().Seconds as number))}⠀ ${fancySchmancyTimeConverter(player.getCurrentPositionSeconds())}/${fancySchmancyTimeConverter(player.getPlaylist().getCurrentSet().Seconds as number)}`,
                                "color": 2326507,
                                "fields": [],
                                "thumbnail": {
                                    url: 'attachment://cover.png'
                                }
                            }
                        ],
                        files: [attachment]
                    });
                };
            }

            if (commandName == "setlist") {
                if (await isPlayerRunning(player, interaction)) {
                    let finalString = '';
                    let lastSetTime = Math.round(player.getState().startTime / 1000);

                    playlist.getSets().forEach((set) => {
                        finalString += '(<t:' + lastSetTime + ':t>-<t:' + (lastSetTime + Math.round(set.Seconds as number)) + ':t>) ' + set.Author + ' - ' + set.Title + '\n';
                        lastSetTime += Math.round(set.Seconds as number);
                    })

                    await interaction.reply({
                        content: `# setlist\n${finalString}`
                    })
                };
            }

            if (commandName == "start") {
                if (!(await isPlayerRunning(player, interaction, true))) {
                    if (await isAdmin(interaction)) {
                        if (playerStateManager.hasLoaded) {
                            player.playAtState();
                        } else {
                            player.playAtForwarded();
                            playerStateManager.saveState();
                        }

                        await interaction.reply({
                            content: `starting magickfest!`
                        })
                    }
                }
            }
        } catch (err) {
            console.error(err);

            if (interaction.isRepliable()) {
                await interaction.reply({
                    content: "borked",
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    });
}