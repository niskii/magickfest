import settings from "config/settings.json";
globalThis.settings = settings;

import express from "express";
import router, { configureRouter } from "./api";
import https from "https";
import { Server } from "socket.io";
import { isAuthorized } from "./auth";
import { readFileSync } from "fs";
import { Player } from "./player";
import { Playlist } from "./playlist";
import { PlayerStateManager } from "./player-state-manager";
import { setupAuthentication, socketSetup } from "./socket";
import { readCommands } from "./commandline";

import cors from "cors";

const commandLineOptions = readCommands();

const httpsOptions = {
  key: readFileSync("./security/cert.key"),
  cert: readFileSync("./security/cert.pem"),
};

const playlist = new Playlist(commandLineOptions.playlistFile);
const player = new Player(playlist, commandLineOptions.isLooped);
configureRouter(player);

const app = express();
app.use(cors({ origin: ["http://localhost:80", "https://localhost:443"] }));
app.use(isAuthorized);
app.use(router);

app.get("/", (req, res) => {
  res.send("Hello!");
});

const server = https.createServer(httpsOptions, app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
  connectTimeout: 20000,
});

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

setupAuthentication(io);
socketSetup(io, player);

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
