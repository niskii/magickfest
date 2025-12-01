import bodyParser from "body-parser";
import connectSqlite3 from "connect-sqlite3";
import cors from "cors";
import { Express, NextFunction, Request, Response } from "express";
import session, { Store } from "express-session";
import helmet from "helmet";
import { Server } from "socket.io";
import { UserManager } from "src/user/user-manager";
import authAPI, { isAuthorized } from "../api/auth";
import serviceAPI from "../api/service";

export function setupMiddleware(
  app: Express,
  io: Server,
  userManager: UserManager,
) {
  app.use(
    cors({
      origin: globalThis.settings.origins,
      credentials: true,
      allowedHeaders: ["Access-Control-Allow-Origin"],
    }),
  );

  const SQLiteStore = connectSqlite3(session);

  const sessionMiddleware = session({
    secret: process.env.SessionSecret!,
    resave: false,
    name: "s.id",

    saveUninitialized: false,
    store: new SQLiteStore({
      table: "sessions",
      db: "sessions.db",
      dir: "./temp",
    }) as Store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 10,
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    },
  });

  app.disable("x-powered-by");
  app.use(helmet);
  app.use(bodyParser.json());
  app.use(sessionMiddleware);
  app.use("/api/auth", authAPI);
  app.use(isAuthorized);
  app.use("/api/service", serviceAPI);
  app.use(error);

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
