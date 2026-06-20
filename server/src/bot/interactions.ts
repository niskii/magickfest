import { Player } from "../player/player";
import { Playlist } from "../player/playlist";
import { PlayerStateManager } from "../player/player-state-manager";
import { client } from "./setup";
import { sendMessage } from "./actions";
import { Interaction, GuildMember } from "discord.js";

function isAdmin(interaction: Interaction) {
    const member = interaction.member as GuildMember;
    return member.roles.cache.has("1444291444809404456");
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
                await interaction.reply({
                    content: `np: ${playlist.getCurrentSet().Author} - ${playlist.getCurrentSet().Title}`,
                    ephemeral: false
                });
            }

            if (commandName == "setlist") {
                let finalString = '';
                playlist.getSets().forEach((set) => {
                    finalString += set.Author + ' - ' + set.Title + '\n';
                })

                await interaction.reply({
                    content: `# setlist\n${finalString}`,
                    ephemeral: false
                })
            }

            if (commandName == "start") {
                if (!isAdmin(interaction)) {
                    await interaction.reply({
                        content: `you are not authorized to run this command`,
                        ephemeral: true
                    })
                } else {
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