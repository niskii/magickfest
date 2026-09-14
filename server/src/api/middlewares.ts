import bodyParser from "body-parser";
import settings from "config/settings.json";
import connect from "connect-session-sequelize";
import cors from "cors";
import { Express, NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import sequelize, { Sequelize } from "sequelize";
import { Server } from "socket.io";
import logger from "src/logger";
import { UserManager } from "src/user/user-manager";
import config from "../../config/config";
import authAPI, {
    createUserFromGuildMemberObject,
    getGuildMember,
    isAuthorized,
} from "../api/auth";
import { configureRouter, publicAPI, serviceAPI } from "../api/service";
import { Player } from "../player/player";

const limiter = rateLimit({
    windowMs: settings.rateWindowMs,
    limit: settings.rateLimit,
    legacyHeaders: false,
});

const SequelizeStore = connect(session.Store);
const db = new Sequelize({
    dialect: "sqlite",
    storage: settings.session.storageLocation,
    logging: false,
});

db.define("Session", {
    sid: {
        type: sequelize.STRING,
        primaryKey: true,
    },
    user: sequelize.JSON,
    expires: sequelize.DATE,
    data: sequelize.TEXT,
});

const sessionMiddleware = session({
    secret: process.env.SessionSecret!,
    resave: false,
    saveUninitialized: false,
    name: "sid",

    store: new SequelizeStore({
        extendDefaultFields: function (defaults, session) {
            return {
                user: session.user ? session.user : null,
                data: defaults.data,
                expires: defaults.expires,
            };
        },
        table: "Session",
        db: db,
        checkExpirationInterval: settings.session.expireCheckMs,
        expiration: settings.session.expiration,
    }),
    cookie: {
        maxAge: settings.session.maxAge,
        partitioned: false,
        sameSite: "lax",
        secure: true,
        httpOnly: true,
        domain: process.env.CookieDomain,
    },
});

db.sync();

export function setupMiddleware(
    app: Express,
    io: Server,
    userManager: UserManager,
    player: Player,
) {
    configureRouter(player);

    app.use(limiter);
    app.disable("x-powered-by");
    app.use(
        cors({
            origin: config.origin,
            credentials: true,
            allowedHeaders: ["Access-Control-Allow-Origin"],
        }),
    );
    app.use(helmet());
    app.use(bodyParser.json());
    app.use(sessionMiddleware);
    app.use("/api/auth", authAPI);
    app.use("/api/public", publicAPI);
    app.use(isAuthorized);
    app.use("/api/service", serviceAPI);
    app.use(error);

    io.engine.use(helmet());
    io.engine.use(sessionMiddleware);
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
