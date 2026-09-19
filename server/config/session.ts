import connect from "connect-session-sequelize";
import session from "express-session";
import sequelize, { Sequelize } from "sequelize";
import settings from "./settings.json";

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

const sessionConfig = session({
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

export default sessionConfig;
