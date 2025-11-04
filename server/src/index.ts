import express, { Request, Response } from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { readFileSync, createReadStream, writeFile, existsSync } from "fs";
import { Playlist } from "./playlist";
import { Player } from "./player";

const ss = require("socket.io-stream");
const cors = require("cors");

const playlistStateFilePath = 'temp/playlist_state_'

const app = express();
app.use(cors);
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

const playlist = new Playlist(readFileSync("public/playlist.json").toString());
const player = new Player(playlist);

const hasSavedState = false
if (!hasSavedState) {
  player.play();
  saveState()
}

player.events?.on('finished', () => {
  saveState()
})

function loadState() {
  const playlistStateFile = playlistStateFilePath + playlist.getHash() + ".json"
  if (!existsSync(playlistStateFile))
    return false;
  const state = JSON.parse(readFileSync(playlistStateFile).toString())
  player.setState(state['setIndex'], state['startTime'])
  return true;
}

function saveState() {
  const state = player.getState()
  console.log('Saving!', state)
  writeFile(playlistStateFilePath + state.id + ".json", JSON.stringify(state), (err) => {
    console.log(err)
  })
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

  socket.on("fetchCurrent", (callback) => {
    console.log("received chunk request!");

    const results = player.getCurrentReader()?.getCurrentChunk();
    if (results?.chunk !== null) socket.emit("chunk", results?.chunk);
    callback({
      status: results?.status,
    });
  });

  socket.on("fetchChunks", function (data, callback) {
    const result = player.getCurrentReader()?.getNextChunk(data.lastPage);
    if (result?.chunk !== null) socket.emit("chunk", result?.chunk);
    callback({
      status: result?.status,
    });
    // return socket.emit("nothing", chunk)
  });
});

server.listen(8080, () => {
  console.log("server running at http://localhost:8080");
});
