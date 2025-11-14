import express from "express";
import router, { configureRouter } from "./api";
import { existsSync, readFileSync, writeFile } from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { Player } from "./player";
import { Playlist } from "./playlist";
import { setupAuthentication, socketSetup } from "./socket";
import { isAuthorized } from "./auth";
import https from "https";

import cors from "cors";
import * as commandline from "./commandline";
import { PlayerStateManager } from "./player-state-manager";

const httpsOptions = {
  key: readFileSync("./security/cert.key"),
  cert: readFileSync("./security/cert.pem"),
};

const playlist = new Playlist(
  readFileSync(commandline.playlistFile).toString(),
);
const player = new Player(playlist, commandline.isLooped);
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

server.listen(8080, () => {
  console.log("server running at http://localhost:8080");
});

process.on("warning", (warning) => {
  console.log(warning.stack);
});

player.setState(commandline.setIndex, null, commandline.forwarded);

const playerStateManager = new PlayerStateManager(
  player,
  commandline.useSavedState,
);

playerStateManager.setupAutoSave(commandline.isLoadOverriden);

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
  Math.max(1, commandline.scheduledStart - Date.now()),
);
