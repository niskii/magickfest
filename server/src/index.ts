import express from "express";
import { existsSync, readFileSync, writeFile } from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import { Player } from "./player";
import { Playlist } from "./playlist";

import cors from "cors";

const playlistStateFilePath = "temp/playlist_state_";

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

const hasSavedState = false;
if (!hasSavedState) {
  player.play();
  saveState();
}

player.events?.on("finished", () => {
  saveState();
});

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
      console.log(err);
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

  socket.on("fetchCurrent", (callback) => {
    console.log("received chunk request!");

    const result = player.getCurrentReader()?.getCurrentChunk();
    if (result?.chunk !== null) socket.emit("sync", result?.chunk);
    callback({
      status: result?.status,
    });
  });

  socket.on("fetchChunks", function (data, callback) {
    const result = player.getCurrentReader()?.getNextChunk(data.lastPage);
    if (result?.chunk !== null) socket.emit("fetch", result?.chunk);
    callback({
      status: result?.status,
    });
    // return socket.emit("nothing", chunk)
  });
});

server.listen(8080, () => {
  console.log("server running at http://localhost:8080");
});
