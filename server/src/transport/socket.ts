import { Bitrate, MediaType } from "shared/types/audio-transfer";
import { SocketSetInfo } from "shared/types/set";
import { Request } from "express";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import socketStream from "socket.io-stream";
import logger from "src/logger";
import { Player } from "../player/player";
import { imageMimeTypes } from "../types/mime-map";
import { UserManager } from "../user/user-manager";
import { UserType } from "src/user/user";

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

        function getVerifiedUser(callback: (user: UserType) => void) {
            const user = req.session.user;
            if (user === undefined) return;
            if (!userManager.isConnected(user)) return;
            callback(user);
        }

        async function sendSyncedChunk(user: UserType, type: MediaType, bitrate: Bitrate, callback: any) {
            if (!Number.isInteger(bitrate)) return;
            const result = await player.getCurrentChunk(type, bitrate);
            if (result !== undefined) {
                userManager.getUser(user)?.getBufferingBalancer().reset();
                if (type === "audio") {
                    socket.emit("syncedAudio", result.data);
                } else if (type === "video") {
                    socket.emit("syncedVideo", result.data);
                }
            }
            callback({
                status: result?.status,
            });
        }

        async function sendNextChunk(user: UserType, type: MediaType, pageStart: number, bitrate: Bitrate, callback: any) {
            if (
                !Number.isInteger(bitrate) ||
                !Number.isInteger(pageStart)
            )
                return;
            const connectedUser = userManager.getUser(user);
            if (connectedUser === undefined) return;

            const result = await player.getNextChunk(type,
                pageStart,
                connectedUser.getBufferingBalancer().getPageSize(),
                bitrate,
            );
            if (result !== undefined)
                if (type === "audio") {
                    socket.emit("nextAudioChunk", result.data);
                } else if (type === "video") {
                    socket.emit("nextVideoChunk", result.data);
                }
            callback({
                status: result?.status,
            });
        }

        /**
         * Clean up when a user disconnects.
         */
        socket.on("disconnect", () => {
            getVerifiedUser((user) => {
                logger.info("a user disconnected", user);
                userManager.removeUser(user);
                io.emit("numberOfUsers", userManager.getSize());
            })
        });

        socket.on("getPlayerState", () => {
            getVerifiedUser(() => {
                socket.emit("currentPlayerState", player.getState());
            });
        });

        /**
         * Sends the current MediaPacket in the requested bitrate.
         */
        socket.on(
            "fetchSyncedAudioChunk",
            (data: { bitrate: Bitrate }, callback) => {
                getVerifiedUser(async (user) => {
                    sendSyncedChunk(user, "audio", data.bitrate, callback)
                });
            },
        );

        /**
         * Sends the next Packet in the requested bitrate.
         */
        socket.on(
            "fetchNextAudioChunk",
            async (data: { bitrate: Bitrate; pageStart: number }, callback) => {
                getVerifiedUser(async (user) => {
                    sendNextChunk(user, "audio", data.pageStart, data.bitrate, callback)
                });
            },
        );

        /**
         * Sends the current MediaPacket in the requested bitrate.
         */
        socket.on(
            "fetchSyncedVideoChunk",
            (data: { bitrate: Bitrate }, callback) => {
                getVerifiedUser(async (user) => {
                    sendSyncedChunk(user, "video", data.bitrate, callback)
                });
            },
        );

        /**
         * Sends the next Packet in the requested bitrate.
         */
        socket.on(
            "fetchNextVideoChunk",
            async (data: { bitrate: Bitrate; pageStart: number }, callback) => {
                console.log("received", data.bitrate, data.pageStart)
                getVerifiedUser(async (user) => {
                    sendNextChunk(user, "video", data.pageStart, data.bitrate, callback)
                });
            },
        );        

        /**
         * Sends the set information and streams the cover image.
         */
        socket.on("fetchSetInformation", () => {
            getVerifiedUser(async (user) => {
                const currentSet = player.getCurrentSet();
                const imageFile = currentSet.CoverFile;

                const setInfo: SocketSetInfo = {
                    Title: currentSet.Title,
                    Author: currentSet.Author,
                    HasVideo: (currentSet.Video != undefined),
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
    });
}
