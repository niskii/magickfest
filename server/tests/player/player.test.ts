import settings from "config/settings.json";
settings.playerNewSetTimeout = 0;
settings.playerUpdateInterval = 50;
globalThis.settings = settings;

import { PlaybackState } from "@shared/types/player-state";
import { sleepSync } from "bun";
import { beforeEach, expect, test } from "bun:test";
import { Player } from "../../src/player/player.js";

let player: Player;

beforeEach(() => {
    try {
        player = new Player("./tests/data/playlist.json", false);
    } catch (error) {}
});

test("Created player is stopped", () => {
    expect(player.getState().state).toBe(PlaybackState.Stopped);
});

test("Finished player is stopped again", async () => {
    player.playAtStart();
    expect(player.getState().state).toBe(PlaybackState.Running);
    await new Promise((resolve) => {
        setTimeout(() => {
            expect(player.getState().state).toBe(PlaybackState.Stopped);
            resolve(true);
        }, 100);
    });
});

test("player progresses", () => {
    player.playAtStart();
    const sample = player.getCurrentPositionMilliseconds();
    sleepSync(10);
    expect(sample).toBeLessThan(player.getCurrentPositionMilliseconds());
});
