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
    const sendNewSetAlert = () => {
        io.emit("newSet");
    };

    const sendChangedStateAlert = () => {
        io.emit("currentPlayerState", player.getState());
    };

    player.events.on("newSet", sendNewSetAlert);
    player.events.on("changedState", sendChangedStateAlert);

    io.on("connection", (socket) => {
        const req = socket.request as Request;

        if (req.session.user === undefined) {
            socket.disconnect();
            return;
        }

        logger.info("a user connected", req.session.user);
        userManager.setUser(req.session.user, socket);

        io.emit("numberOfUsers", userManager.getSize());

        socket.use((event, next) => {
            req.session.reload((err) => {
                if (err || req.session.user === undefined) {
                    logger.info("Undefined user", event);
                    socket.disconnect();
                }
            });

            next();
        });

        /**
         * Clean up when a user disconnects.
         */
        socket.on("disconnect", () => {
            const user = req.session.user;
            if (user === undefined) return;
            if (userManager.isConnected(user)) return;
            logger.info("a user disconnected", user);
            userManager.removeUser(user);
            io.emit("numberOfUsers", userManager.getSize());
        });

        socket.on("getPlayerState", () => {
            const user = req.session.user;
            if (user === undefined) return;
            if (!userManager.isConnected(user)) return;
            socket.emit("currentPlayerState", player.getState());
        });

        /**
         * Sends the current MediaPacket in the requested bitrate.
         */
        socket.on(
            "fetchSyncedChunk",
            async (data: { bitrate: Bitrate }, callback) => {
                const user = req.session.user;
                if (user === undefined) return;
                if (!userManager.isConnected(user)) return;

                if (!Number.isInteger(data.bitrate)) return;
                const result = await player.getCurrentChunk(data.bitrate);
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
         * Sends the next Packet in the requested bitrate.
         */
        socket.on(
            "fetchChunkFromPage",
            async (data: { bitrate: Bitrate; pageStart: number }, callback) => {
                const user = req.session.user;
                if (user === undefined) return;
                if (!userManager.isConnected(user)) return;
                if (
                    !Number.isInteger(data.bitrate) ||
                    !Number.isInteger(data.pageStart)
                )
                    return;
                const connectedUser = userManager.getUser(user);
                if (connectedUser === undefined) return;

                const result = await player.getNextChunk(
                    data.pageStart,
                    connectedUser.getBufferingBalancer().getPageSize(),
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
            const user = req.session.user;
            if (user === undefined) return;
            if (!userManager.isConnected(user)) return;
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
                    "setInformationStream",
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
