import { Bitrate } from "@shared/types/audio-transfer";
import { SocketSetInfo } from "@shared/types/set";
import { Request } from "express";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import socketStream from "socket.io-stream";
import logger from "src/logger";
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
        const user = req.session.user!;
        logger.info("a user connected", user);
        userManager.setUser(user!, socket);

        io.emit("numberOfUsers", userManager.getSize())

        const sendNewSetAlert = () => {
            socket.emit("newSet");
        };

        const sendChangedStateAlert = () => {
            socket.emit("currentPlayerState", player.getState());
        };

        player.events.on("newSet", sendNewSetAlert);
        player.events.on("changedState", sendChangedStateAlert);

        /**
         * Clean up when a user disconnects.
         */
        socket.on("disconnect", () => {
            logger.info("a user disconnected");
            userManager.removeUser(user!);
            player.events.off("newSet", sendNewSetAlert);
            player.events.off("changedState", sendChangedStateAlert);
            io.emit("numberOfUsers", userManager.getSize())
        });

        socket.on("getPlayerState", () => {
            socket.emit("currentPlayerState", player.getState());
        });

        /**
         * Sends the current AudioPacket in the requested bitrate.
         */
        socket.on(
            "fetchSyncedChunk",
            (data: { bitrate: Bitrate }, callback) => {
                const result = player.getCurrentChunk(data.bitrate);
                if (result !== undefined) {
                    userManager.getUser(user)?.getBufferingBalancer().reset();
                    socket.emit("syncedChunk", result.data);
                }
                callback({
                    status: result?.status,
                });
            },
        );

        /**
         * Sends the next AudioPacket in the requested bitrate.
         */
        socket.on(
            "fetchChunkFromPage",
            (data: { bitrate: Bitrate; pageStart: number }, callback) => {
                const result = player.getNextChunk(
                    data.pageStart,
                    userManager
                        .getUser(user)!
                        .getBufferingBalancer()
                        .getPageSize(),
                    data.bitrate,
                );
                if (result !== undefined)
                    socket.emit("chunkFromPage", result.data);
                callback({
                    status: result?.status,
                });
            },
        );

        /**
         * Sends the set information and streams the cover image.
         */
        socket.on("fetchSetInformation", () => {
            const currentSet = player.getCurrentSet();
            const imageFile = currentSet.CoverFile;

            const setInfo: SocketSetInfo = {
                Title: currentSet.Title,
                Author: currentSet.Author,
            };

            if (imageFile && fs.existsSync(imageFile)) {
                const imageStream = socketStream.createStream();
                const imageMimeType = imageMimeTypes.get(
                    path.extname(imageFile),
                );
                setInfo.ImageMimeType = imageMimeType;
                socketStream(socket).emit(
                    "setInformation",
                    imageStream,
                    setInfo,
                );
                fs.createReadStream(imageFile).pipe(imageStream);
            } else {
                socket.emit("setInformation", setInfo);
            }
        });
    });
}
