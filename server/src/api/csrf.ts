import { csrfSync } from "csrf-sync";
import express from "express";

export const csrfAPI = express.Router();

const { generateToken } = csrfSync();

csrfAPI.get("/csrf-token", (req, res) => {
    res.json({ token: generateToken(req) });
});

export function isSocketConnectionRequestValid(receivedToken: any, storedToken: any) {
    return (
        typeof receivedToken === "string" &&
        typeof storedToken === "string" &&
        receivedToken === storedToken
    );
}
