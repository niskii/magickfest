import { Player } from "../player/player";
import { Playlist } from "../player/playlist";
import { PlayerStateManager } from "../player/player-state-manager";
import { client } from "./setup";
import { sendMessage } from "./actions";
import { Interaction, GuildMember } from "discord.js";
import { PlayerState } from "../types/player-state";

async function isAdmin(interaction: Interaction) {
    const member = interaction.member as GuildMember;
    const hasRole = member.roles.cache.has(process.env.AdminRoleID);

    if (!hasRole) {
        await interaction.reply({
            content: `you are not authorized to run this command`,
            ephemeral: true
        })
    }

    return hasRole;
}

async function isPlayerRunning(player: Player, interaction: Interaction, verboseOnTrue: boolean = false) {
    if (verboseOnTrue) {
        await interaction.reply({
            content: 'magickfest is already running!',
            ephemeral: false
        });
    } else {
        await interaction.reply({
            content: 'magickfest isn\'t running yet!',
            ephemeral: false
        });
    }

    return player.getState().state == PlayerState.Running
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
                    await interaction.reply({
                        content: `np: ${playlist.getCurrentSet().Author} - ${playlist.getCurrentSet().Title}`,
                        ephemeral: false
                    });
                };
            }

            if (commandName == "setlist") {
                if (await isPlayerRunning(player, interaction)) {
                    let finalString = '';
                    playlist.getSets().forEach((set) => {
                        finalString += set.Author + ' - ' + set.Title + '\n';
                    })

                    await interaction.reply({
                        content: `# setlist\n${finalString}`,
                        ephemeral: false
                    })
                };
            }

            if (commandName == "start") {
                if (!isPlayerRunning(player, interaction, true)) {
                    if (await isAdmin(interaction)) {
                        if (playerStateManager.hasLoaded) {
                            player.playAtState();
                        } else {
                            player.playAtForwarded();
                            playerStateManager.saveState();
                        }

                        await interaction.reply({
                            content: `starting magickfest!`,
                            ephemeral: false
                        })
                    }
                }
            }
        } catch (err) {
            console.error(err);

            if (interaction.isRepliable()) {
                await interaction.reply({
                    content: "borked",
                    ephemeral: true
                });
            }
        }
    });
}