import settings from "config/settings.json";
settings.application.playerNewSetTimeout = 0;
settings.application.playerUpdateInterval = 50;
globalThis.settings = settings;

import { PlaybackState } from "@shared/types/player-state";
import { beforeEach, expect, test } from "vitest";
import { Player } from "../../src/player/player.js";

let player: Player;

export default function sleep(milliseconds: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

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

test("player progresses", async () => {
    player.playAtStart();
    const sample = player.getCurrentPositionMilliseconds();
    await sleep(10);
    expect(sample).toBeLessThan(player.getCurrentPositionMilliseconds());
});
