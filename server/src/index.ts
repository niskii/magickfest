import settings from "config/settings.json";
globalThis.settings = settings;

import "dotenv/config";
import express from "express";
import { readFileSync } from "fs";
import https from "https";
import { Server } from "socket.io";
import { configureRouter } from "./api/service";
import { readCommands } from "./commandline";
import { setupMiddleware as setupMiddlewares } from "./middlewares";
import { Player } from "./player";
import { PlayerStateManager } from "./player-state-manager";
import { Playlist } from "./playlist";
import { socketSetup as setupSocket } from "./socket";

const commandLineOptions = readCommands();

const httpsOptions = {
  pfx: readFileSync("./security/newkey.pfx"),
  passphrase: process.env.PfxSecret,
};

const playlist = new Playlist(commandLineOptions.playlistFile);
const player = new Player(playlist, commandLineOptions.isLooped);
configureRouter(player);

const app = express();
app.get("/", (_, res) => {
  res.send("Hello!");
});

const server = https.createServer(httpsOptions, app);
const io = new Server(server, {
  cors: {
    origin: "https://localhost:5173",
    credentials: true,
  },
  connectTimeout: 20000,
});

setupMiddlewares(app, io);
setupSocket(io, player);

server.listen(globalThis.settings.port, () => {
  console.log("server running at http://localhost:8080");
});

process.on("warning", (warning) => {
  console.log(warning.stack);
});

player.setState(
  commandLineOptions.setIndex,
  null,
  commandLineOptions.forwarded,
);

const playerStateManager = new PlayerStateManager(
  player,
  commandLineOptions.useSavedState,
);

playerStateManager.setupAutoSave(commandLineOptions.isLoadOverriden);

setTimeout(
  () => {
    if (playerStateManager.hasLoaded) {
      player.playAtState();
    } else {
      player.playAtForwarded();
      playerStateManager.saveState();
    }
  },
  Math.max(1, commandLineOptions.scheduledStart - Date.now()),
);
