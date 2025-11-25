import settings from "config/settings.json";
globalThis.settings = settings;

import "dotenv/config";
import express from "express";
import { readFileSync } from "fs";
import https from "https";
import { Server } from "socket.io";
import { configureRouter } from "./api/service";
import { readCommands } from "./commandline";
import { setupMiddleware } from "./api/middlewares";
import { Player } from "./player/player";
import { PlayerStateManager } from "./player/player-state-manager";
import { Playlist } from "./player/playlist";
import { socketSetup as setupSocket } from "./transport/socket";
import { UserManager } from "./user/user-manager";

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

const userManager = new UserManager();

setupMiddleware(app, io, userManager);
setupSocket(io, player, userManager);

server.listen(globalThis.settings.port, () => {
  console.log(`server running at https://localhost:${settings.port}`);
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
