import connectSqlite3 from "connect-sqlite3";
import cors from "cors";
import { Express, Request } from "express";
import session, { Store } from "express-session";
import { Server } from "socket.io";
import authAPI, { isAuthorized } from "../api/auth";
import serviceAPI from "../api/service";
import { UserManager } from "src/user-manager";

export function setupMiddleware(
  app: Express,
  io: Server,
  userManager: UserManager,
) {
  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "https://localhost:5173",
        "http://localhost:80",
        "https://localhost:443",
      ],
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
      maxAge: 1000 * 60 * 60 * 24 * 5,
      sameSite: "none",
      secure: true,
      httpOnly: false,
    },
  });

  app.use(sessionMiddleware);
  app.use("/api/auth", authAPI);
  app.use(isAuthorized);
  app.use("/api/service", serviceAPI);

  io.engine.use(sessionMiddleware);
  io.use((socket, next) => {
    const req = socket.request as Request;
    const token = req.headers["authentication"];
    const user = req.session.user;
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
