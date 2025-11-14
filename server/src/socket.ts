import path from "path";
import { Server } from "socket.io";
import { Player } from "./player";
import { imageMimeTypes } from "./mime-map";
import { createReadStream } from "fs";
import { Request, NextFunction, Response } from "express";
import { isAuthorized } from "./auth";

const socketStream = require("socket.io-stream");
const connectedUsers = new Set<string>();

export function setupAuthentication(io: Server) {
  io.engine.use(
    (
      req: Request & { user: string; _query: Record<string, string> },
      res: Response,
      next: NextFunction
    ) => {
      const isHandshake = req._query.sid === undefined;
      console.log(isHandshake);
      if (isHandshake) {
        const token = req.headers["authentication"];
        if (token !== undefined) req.user = token.toString();
        if (!connectedUsers.has(req.user)) {
          next();
        }
      } else {
        next();
      }
    }
  );
}

export function socketSetup(io: Server, player: Player) {
  io.on("connection", (socket) => {
    const req = socket.request as Request & { user: string };
    console.log("a user connected", req.user);
    connectedUsers.add(req.user);

    const sendNewSetAlert = () => {
      socket.emit("newSet");
    };

    const sendChangedStateAlert = () => {
      socket.emit("changedState");
    };

    player.events?.on("newSet", sendNewSetAlert);
    player.events?.on("changedState", sendChangedStateAlert);

    socket.on("disconnect", () => {
      connectedUsers.delete(req.user);
      console.log("a user disconnected");
      player.events?.off("newSet", sendNewSetAlert);
      player.events?.off("changedState", sendChangedStateAlert);
    });

    socket.on("fetchSyncedChunk", (data, callback) => {
      const result = player.getCurrentReader(data.bitrate)?.getCurrentChunk();
      if (result?.data !== null) socket.emit("syncedChunk", result?.data);
      callback({
        status: result?.status,
      });
    });

    socket.on("fetchChunkFromPage", (data, callback) => {
      const result = player
        .getCurrentReader(data.bitrate)
        ?.getNextChunk(data.lastPage);
      if (result?.data !== null) socket.emit("chunkFromPage", result?.data);
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
