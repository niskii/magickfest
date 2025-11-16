import { NextFunction, Request, Response } from "express";
import { createReadStream } from "fs";
import path from "path";
import { Server } from "socket.io";
import { imageMimeTypes } from "./types/mime-map";
import { Player } from "./player";
import { SocketSetInfo } from "@shared/types/set";
import { Bitrate } from "@shared/types/audio-transfer";
import socketStream from "socket.io-stream";

const connectedUsers = new Set<string>();

export function setupAuthentication(io: Server) {
  io.engine.use(
    (
      req: Request & { user: string; _query: Record<string, string> },
      res: Response,
      next: NextFunction,
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
    },
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
      console.log("going to stream image");
      const imageStream = socketStream.createStream();
      const currentSet = player.getPlaylist().getCurrentSet();
      const imageFile = process.env.SETS_LOCATION + currentSet.CoverFile;
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
