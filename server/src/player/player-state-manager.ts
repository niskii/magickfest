import { existsSync, readFileSync, writeFile } from "fs";
import { Player } from "./player";
import logger from "src/logger";

const playlistStateFilePath = "temp/playlist_state_";

export class PlayerStateManager {
    #player: Player;
    hasLoaded: boolean = false;
    enabled: boolean;

    constructor(player: Player, enabled: boolean) {
        this.#player = player;
        this.enabled = enabled;
    }

    setupAutoSave(isLoadOverriden: boolean) {
        this.#player.events.on("newSet", () => {
            this.saveState();
        });

        if (!isLoadOverriden) this.hasLoaded = this.loadState();
    }

    loadState() {
        if (!this.enabled) return false;
        const playlistStateFile =
            playlistStateFilePath + this.#player.getState().id + ".json";
        if (!existsSync(playlistStateFile)) return false;
        const state = JSON.parse(readFileSync(playlistStateFile).toString());
        logger.info("Loaded", state);
        this.#player.setState(
            state["setIndex"],
            state["startTime"],
            state["forwarded"],
        );
        return true;
    }

    saveState() {
        if (!this.enabled) return;
        const state = this.#player.getState();
        logger.info("Saving!", state);
        writeFile(
            playlistStateFilePath + state.id + ".json",
            JSON.stringify(state),
            (err) => {
                if (err) logger.error("Saving error:", err);
            },
        );
    }
}
