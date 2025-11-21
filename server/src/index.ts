import settings from "config/settings.json";
globalThis.settings = settings;

import "dotenv/config";
import express from "express";
import { readFileSync } from "fs";
import https from "https";
import { Server } from "socket.io";
import authAPI, { isAuthorized } from "./api/auth";
import serviceAPI, { configureRouter } from "./api/service";
import { readCommands } from "./commandline";
import { Player } from "./player";
import { PlayerStateManager } from "./player-state-manager";
import { Playlist } from "./playlist";
import { setupAuthentication, socketSetup } from "./socket";

import connectSqlite3 from "connect-sqlite3";
import cors from "cors";
import session, { Store } from "express-session";

const commandLineOptions = readCommands();

const httpsOptions = {
  pfx: readFileSync("./security/newkey.pfx"),
  passphrase: process.env.PfxSecret,
};

const playlist = new Playlist(commandLineOptions.playlistFile);
const player = new Player(playlist, commandLineOptions.isLooped);
configureRouter(player);

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://localhost:5173",
      "http://localhost:80",
      "https://localhost:443",
    ],
    credentials: true,
    allowedHeaders: ["Access-Control-Allow-Origin"],
  }),
);

const SQLiteStore = connectSqlite3(session);

const sessionMiddleware = session({
  secret: process.env.SessionSecret!,
  resave: false,
  name: "s.id",
  saveUninitialized: false,
  store: new SQLiteStore({
    table: "sessions",
    db: "sessions.db",
    dir: "./temp",
  }) as Store,
  cookie: {
    maxAge: 1000 * 60 * 60,
  },
});

app.use(sessionMiddleware);
app.use("/api/auth", authAPI);
app.use(isAuthorized);
app.use("/api/service", serviceAPI);

app.get("/", (req, res) => {
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

setupAuthentication(io, sessionMiddleware);
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
