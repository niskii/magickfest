import { Bitrate } from "@shared/types/audio-transfer";
import { SocketSetInfo } from "@shared/types/set";
import { Request } from "express";
import { createReadStream } from "fs";
import path from "path";
import { Server } from "socket.io";
import socketStream from "socket.io-stream";
import { Player } from "../player/player";
import { imageMimeTypes } from "../types/mime-map";
import { UserManager } from "../user/user-manager";

export function socketSetup(
  io: Server,
  player: Player,
  userManager: UserManager,
) {
  io.on("connection", (socket) => {
    const req = socket.request as Request;
    const user = req.session.user;
    console.log("a user connected", user);
    userManager.setUser(user!);

    const sendNewSetAlert = () => {
      socket.emit("newSet");
    };

    const sendChangedStateAlert = () => {
      socket.emit("changedState");
    };

    player.events?.on("newSet", sendNewSetAlert);
    player.events?.on("changedState", sendChangedStateAlert);

    socket.on("disconnect", () => {
      userManager.removeUser(user!);
      console.log("a user disconnected");
      player.events?.off("newSet", sendNewSetAlert);
      player.events?.off("changedState", sendChangedStateAlert);
    });

    socket.on("fetchSyncedChunk", (data: { bitrate: Bitrate }, callback) => {
      const result = player.getCurrentReader(data.bitrate)?.getCurrentChunk();
      if (result !== undefined) socket.emit("syncedChunk", result.data);
      callback({
        status: result?.status,
      });
    });

    socket.on(
      "fetchChunkFromPage",
      (data: { bitrate: Bitrate; lastPage: number }, callback) => {
        const result = player
          .getCurrentReader(data.bitrate)
          ?.getNextChunk(data.lastPage);
        if (result !== undefined) socket.emit("chunkFromPage", result.data);
        callback({
          status: result?.status,
        });
      },
    );

    socket.on("fetchSetInformation", () => {
      const imageStream = socketStream.createStream();
      const currentSet = player.getPlaylist().getCurrentSet();
      const imageFile = currentSet.CoverFile;
      const imageMimeType = imageMimeTypes.get(path.extname(imageFile));

      const setInfo: SocketSetInfo = {
        Title: currentSet.Title,
        Author: currentSet.Author,
        ImageMimeType: imageMimeType,
      };

      socketStream(socket).emit("setInformation", imageStream, setInfo);
      createReadStream(imageFile).pipe(imageStream);
    });
  });
}
