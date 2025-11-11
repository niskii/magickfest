import express from "express";
import path from "path";
import { Server } from "socket.io";
import { createReadStream, existsSync, readFileSync, writeFile } from "fs";
import { createServer } from "http";
import { Player } from "./player";
import { Playlist } from "./playlist";
import { imageMimeTypes } from "./mime-map";

import cors from "cors";
const socketStream = require("socket.io-stream");

const app = express();
app.use(cors);
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

const argv = require('minimist')(process.argv.slice(2));

console.log(argv)

const playlistFile = argv.playlist ? argv.playlist : "public/playlist.json"
const useSavedState = argv.usestate !== undefined
const loop = argv.loop !== undefined

const playlistStateFilePath = "temp/playlist_state_";
const playlist = new Playlist(readFileSync(playlistFile).toString());
const player = new Player(playlist, loop);

if (argv.setindex !== undefined || argv.starttime !== undefined) {
  const startTime = argv.starttime ? Date.now() - argv.starttime * 1000 : Date.now() 
  const setIndex = argv.setindex ? argv.setindex : 0
  player.setState(setIndex, startTime)
}

if (useSavedState) {
  player.events?.on("finished", () => {
    saveState();
  });
  
  let hasSavedState = false
  if (argv.setindex === undefined && argv.starttime === undefined)
    hasSavedState = loadState();
  if (!hasSavedState) {
    saveState();
  }
}

player.playAtState()

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
            if (err) console.log(err);
        },
    );
}

io.on("connection", (socket) => {
    console.log("a user connected");

    const sendNewSetAlert = () => {
        console.log("Sending new set!");
        socket.emit("newSet");
    };

    player.events?.on("finished", sendNewSetAlert);

    socket.on("disconnect", () => {
        console.log("a user disconnected");
        player.events?.off("finished", sendNewSetAlert);
    });

    socket.on("fetchSyncedChunk", (data, callback) => {
        const result = player.getCurrentReader(data.bitrate)?.getCurrentChunk();
        if (result?.chunk !== null) socket.emit("syncedChunk", result?.chunk);
        callback({
            status: result?.status,
        });
    });

    socket.on("fetchChunkFromPage", (data, callback) => {
        const result = player
            .getCurrentReader(data.bitrate)
            ?.getNextChunk(data.lastPage);
        if (result?.chunk !== null) 
          socket.emit("chunkFromPage", result?.chunk);
        callback({
          status: result?.status,
        });
    });

    socket.on("fetchSetInformation", () => {
        console.log("going to stream image");
        const imageStream = socketStream.createStream();
        const currentSet = playlist.getCurrentSet();
        const imageFile = currentSet.CoverFile;
        const imageMimeType = imageMimeTypes.get(path.extname(imageFile));

        socketStream(socket).emit("setInformation", imageStream, {
            title: currentSet.Title,
            author: currentSet.Author,
            fileMimeType: imageMimeType,
        });
        createReadStream(imageFile).pipe(imageStream);
    });
});

server.listen(8080, () => {
    console.log("server running at http://localhost:8080");
});
