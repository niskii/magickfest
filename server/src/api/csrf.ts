import { csrfSync } from "csrf-sync";
import express from "express";
import { getDiscordEnvironment } from "../envs";
import logger from "../logger";

export const csrfAPI = express.Router();
const envs = getDiscordEnvironment();

const { generateToken } = csrfSync();

csrfAPI.get("/csrf-token", (req, res) => {
    const origin = req.get("origin");
    if (origin && new URL(origin).host == envs.DiscordURL.host) {
        req.session.cookie.sameSite = "none";
        // @ts-ignore
        req.session.cookie.partitioned = true;
        req.session.cookie.domain = undefined;
    }

    const token = { token: generateToken(req) }

    req.session.save(function (err) {
        logger.info("error saving session", err)
        res.json(token);
    });
});

export function isSocketConnectionRequestValid(receivedToken: any, storedToken: any) {
    return (
        typeof receivedToken === "string" &&
        typeof storedToken === "string" &&
        receivedToken === storedToken
    );
}
