import settings from "config/settings.json";

const isDev = process.env.NODE_ENV == "development"
const hostname = process.env.ServerHostname || "localhost"
const port = process.env.port || "8080"
const externalHost = hostname + (isDev ? `:${port}` : "");

const config = {
    env: process.env.NODE_ENV || "development",
    hostname: hostname,
    port: port,
    protocol: isDev ? "https" : "http",
    origin: process.env.ClientHostname || settings.origin,
    externalHost: externalHost
};


export default config;
