import settings from "config/settings.json";
import bodyParser from "body-parser";
import connect from "connect-session-sequelize";
import sequelize, { Sequelize } from "sequelize";
import cors from "cors";
import { Express, NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import { Server } from "socket.io";
import { UserManager } from "src/user/user-manager";
import authAPI, { isAuthorized } from "../api/auth";
import serviceAPI from "../api/service";

const limiter = rateLimit({
  windowMs: settings.rateWindowMs,
  limit: settings.rateLimit,
  legacyHeaders: false,
});

const SequelizeStore = connect(session.Store);
const db = new Sequelize({
  dialect: "sqlite",
  storage: settings.sesstionStorageLocation,
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
    checkExpirationInterval: settings.expireCheckMs,
    expiration: settings.sessionMaxAge,
  }),
  cookie: {
    maxAge: settings.sessionMaxAge,
    partitioned: false,
    sameSite: "lax",
    secure: true,
    httpOnly: true,
  },
});

db.sync();

export function setupMiddleware(
  app: Express,
  io: Server,
  userManager: UserManager,
) {
  app.use(limiter);
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: globalThis.settings.origins,
      credentials: true,
      allowedHeaders: ["Access-Control-Allow-Origin"],
    }),
  );
  app.use(helmet());
  app.use(bodyParser.json());
  app.use(sessionMiddleware);
  app.use("/api/auth", authAPI);
  app.use(isAuthorized);
  app.use("/api/service", serviceAPI);
  app.use(error);

  io.engine.use(helmet());
  io.engine.use(sessionMiddleware);
  io.use((socket, next) => {
    const req = socket.request as Request;
    const user = req.session.user;
    console.log("joining", req.session);
    if (user) {
      if (!userManager.isConnected(user)) {
        next();
      } else {
        next(new Error("already_connected"));
      }
    } else {
      next(new Error("unauthorized"));
    }
  });
}

function error(err: any, req: Request, res: Response, next: NextFunction) {
  if (err) {
    res.status(500).send(err.toString());
  }
  next();
}
