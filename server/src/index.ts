import express from "express";
import router, { configureRouter } from "./api";
import { existsSync, readFileSync, writeFile } from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { Player } from "./player";
import { Playlist } from "./playlist";
import { socketSetup } from "./socket";
import { isAuthorized } from "./auth";

import cors from "cors";
import * as commandline from "./commandline";

const playlistStateFilePath = "temp/playlist_state_";
const playlist = new Playlist(
  readFileSync(commandline.playlistFile).toString(),
);
const player = new Player(playlist, commandline.isLooped);
configureRouter(player);

const app = express();
app.use(cors({ origin: "http://localhost:80" }));
app.use(isAuthorized);
app.use(router);

app.listen(8000);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
  connectTimeout: 20000,
});

process.on("warning", (warning) => {
  console.log(warning.stack);
});

player.setState(commandline.setIndex, commandline.startTime);

if (commandline.useSavedState) {
  player.events?.on("finished", () => {
    saveState();
  });

  let hasSavedState = false;
  if (commandline.isLoadOverriden) hasSavedState = loadState();

  if (!hasSavedState) {
    saveState();
  }
}

player.playAtState();

function loadState() {
  const playlistStateFile =
    playlistStateFilePath + playlist.getHash() + ".json";
  if (!existsSync(playlistStateFile)) return false;
  const state = JSON.parse(readFileSync(playlistStateFile).toString());
  player.setState(state["setIndex"], state["startTime"]);
  return true;
}

function saveState() {
  const state = player.getState();
  console.log("Saving!", state);
  writeFile(
    playlistStateFilePath + state.id + ".json",
    JSON.stringify(state),
    (err) => {
      if (err) console.log("Saving error:", err);
    },
  );
}

socketSetup(io, player);

server.listen(8080, () => {
  console.log("server running at http://localhost:8080");
});
