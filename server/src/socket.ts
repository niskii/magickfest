import path from "path";
import { Server } from "socket.io";
import { Player } from "./player";
import { imageMimeTypes } from "./mime-map";
import { createReadStream } from "fs";

const socketStream = require("socket.io-stream");

export function socketSetup (io: Server, player: Player) {
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
          const currentSet = player.getPlaylist().getCurrentSet();
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
}
