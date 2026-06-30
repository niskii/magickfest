import { expect, test } from "bun:test";
import { Playlist } from "../../src/player/playlist.js";
import { beforeEach } from "node:test";

let playlist: Playlist;

beforeEach(() => {
  playlist = new Playlist("tests/data/playlist.json")
})

test("loads one set", () => {
  expect(playlist.getLength()).toBe(1)
});

test("are file paths correctly constructed", () => {
  const currentSet = playlist.getCurrentSet()
  const audioFiles = currentSet.AudioFiles
  expect(currentSet.CoverFile).toBe("tests/data/sets/1/cover.jpg")
  expect(audioFiles[0].File).toBe("tests\\data\\sets\\1\\1_128.opus")
  expect(audioFiles[1].File).toBe("tests\\data\\sets\\1\\1_96.opus")
  expect(audioFiles[2].File).toBe("tests\\data\\sets\\1\\1_64.opus")
});

test("playlist can't go out of bounds", () => {
  expect(() => playlist.nextSet()).toThrowError()
  expect(() => playlist.setCurrentSet(1)).toThrowError()
  expect(playlist.getCurrentIndex()).toBe(0)
})