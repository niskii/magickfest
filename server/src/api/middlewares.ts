import bodyParser from "body-parser";
import { csrfSync } from "csrf-sync";
import { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { Server } from "socket.io";
import logger from "src/logger";
import { UserManager } from "src/user/user-manager";
import corsConfig from "../../config/cors";
import rateLimitConfig from "../../config/ratelimit";
import sessionConfig from "../../config/session";
import authAPI, {
    createUserFromGuildMemberObject,
    getGuildMember,
    isAuthorized,
} from "../api/auth";
import { configureRouter, publicAPI, serviceAPI } from "../api/service";
import { Player } from "../player/player";
import { csrfAPI, isSocketConnectionRequestValid } from "./csrf";

const { csrfSynchronisedProtection } = csrfSync();

export function setupMiddleware(
    app: Express,
    io: Server,
    userManager: UserManager,
    player: Player,
) {
    configureRouter(player);

    app.use(rateLimitConfig);
    app.disable("x-powered-by");
    app.use(corsConfig);
    app.use(helmet());
    app.use(bodyParser.json());
    app.use(sessionConfig);
    app.use("/api", csrfAPI);
    app.use(csrfSynchronisedProtection);

    app.use("/api/auth", authAPI);
    app.use("/api/public", publicAPI);
    app.use(isAuthorized);
    app.use("/api/service", serviceAPI);
    app.use(error);

    io.engine.use(helmet());
    io.engine.use(sessionConfig);
    io.use((socket, next) => {
        const req = socket.request as Request;
        const storedToken = req.session.csrfToken;
        const token = req.headers["csrftoken"];

        if (isSocketConnectionRequestValid(token, storedToken)) {
            next();
        } else {
            next(new Error("Invalid."));
        }
    });
    io.use(async (socket, next) => {
        const req = socket.request as Request;
        const user = req.session.user;

        logger.info("socket connecting with session id", req.session.id);
        if (user) {
            if (!userManager.isConnected(user)) {
                next();
            } else {
                userManager.getUser(user)!.getSocket().disconnect();
                next();
            }
        } else {
            const header = req.headers["authorization"];

            if (!header || !header.startsWith("Bearer ")) {
                return next(new Error("unauthorized"));
            }

            const accessToken: string = header.slice(7);
            if (accessToken == "undefined")
                return next(new Error("unauthorized"));

            getGuildMember(accessToken.toString())
                .then((guildUserData) => {
                    const validUser =
                        createUserFromGuildMemberObject(guildUserData);
                    req.session.user = validUser;
                    next();
                })
                .catch(() => {
                    logger.warn(
                        "User attempted to login with invalid token:",
                        accessToken,
                    );
                    next(new Error("invalid_token"));
                });
        }
    });
}

function error(err: any, req: Request, res: Response, next: NextFunction) {
    if (err) {
        res.status(500).send(err.toString());
    }
    next();
}
