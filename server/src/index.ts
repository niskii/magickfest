import settings from "config/settings.json";
globalThis.settings = settings;

import "dotenv/config";
import express from "express";
import { readFileSync } from "fs";
import http from "http";
import https from "https";
import { Server } from "socket.io";
import config from "../config/config";
import { setupMiddleware } from "./api/middlewares";
import { configureInteractions } from "./bot/interactions";
import { readCommands } from "./commandline";
import { Player } from "./player/player";
import { PlayerStateManager } from "./player/player-state-manager";
import { socketSetup as setupSocket } from "./transport/socket";
import { UserManager } from "./user/user-manager";

console.log("starting server!");

const commandLineOptions = readCommands();

const player = new Player(
    commandLineOptions.playlistFile,
    commandLineOptions.isLooped,
);

const app = express();

let server;

if (config.env == 'development') {
    app.set("X-Forwarded-For", false)
    const httpsOptions = {
        pfx: readFileSync(process.env.PfxPath!),
        passphrase: process.env.PfxSecret,
    };

    server = https.createServer(httpsOptions, app);

} else {
    app.set("trust proxy", 1)
    server = http.createServer(app)
}

const io = new Server(server, {
    cors: {
        origin: config.origin,
        credentials: true,
    },

    perMessageDeflate: false,
    
    connectTimeout: settings.socket.connectTimeout,
    pingInterval: settings.socket.pingInterval,
    pingTimeout: settings.socket.pingTimeout
});

const userManager = new UserManager();

setupMiddleware(app, io, userManager, player);
setupSocket(io, player, userManager);

server.listen(config.port, () => {
    console.log(
        `server running at ${config.protocol}://${config.externalHost}`,
    );
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
configureInteractions(player);
player.playAtForwarded();