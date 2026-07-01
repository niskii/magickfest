import settings from "config/settings.json";
settings.playerNewSetTimeout = 0
globalThis.settings = settings;


import { PlaybackState } from "@shared/types/player-state";
import { expect, test } from "bun:test";
import { beforeEach } from "node:test";
import { Player } from "../../src/player/player.js";

let player: Player;

beforeEach(() => {
    try {
        player = new Player("./tests/data/playlist.json", false)
    } catch (error) {
        
    }
})

test("Created player is stopped", () => {
    expect(player.getState().state).toBe(PlaybackState.Stopped)
})

test("Finished player is stopped again", () => {
    player.playAtStart()
    expect(player.getState().state).toBe(PlaybackState.Running)

    setTimeout(() => {
        expect(player.getState().state).toBe(PlaybackState.Stopped)
    }, settings.playerNewSetTimeout + 1000)
})