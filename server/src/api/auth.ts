import axios from "axios";
import express, { NextFunction, Request, Response } from "express";
import { getDiscordEnvironment } from "../envs";

const router = express.Router();
const envs = getDiscordEnvironment();

export function isAuthorized(req: Request, res: Response, next: NextFunction) {
  console.log(req.session);
  if (req.session.user) next();
  else next("Not Authorized");
}

async function authenticate(code: string, redirect: boolean): Promise<string> {
  const formData = new URLSearchParams({
    client_id: envs.DiscordClientID,
    client_secret: envs.DiscordClientSecret,
    grant_type: "authorization_code",
    code: code.toString(),
  });

  if (redirect)
    formData.set("redirect_uri", "https://localhost:8080/api/auth/redirect");

  const authResponse = await axios.post(
    "https://discord.com/api/v10/oauth2/token",
    formData,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  if (authResponse.status !== 200) {
    throw new Error("Something went wrong with the authorization!");
  }

  return authResponse.data.access_token;
}

async function getGuildMember(accessToken: string): Promise<object> {
  const userResponse = await axios.get(
    `https://discord.com/api/v10/users/@me/guilds/${envs.DiscordGuildID}/member`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (userResponse.status === 404) {
    throw new Error("You are not an exclusive member!");
  }

  return userResponse.data;
}

router.get("/redirect", async (req, res) => {
  const { code } = req.query;

  if (code) {
    const accessToken = await authenticate(code.toString(), true);
    const userData = await getGuildMember(accessToken);

    // Certified tmw user!
    console.log(userData);
  }

  res.sendStatus(200);
});

router.post("/token", async (req, res) => {
  const body = JSON.parse(await req.body);
  const accessToken = await authenticate(body.code, false);

  res.send(accessToken);
});

router.get("/login", (req, res, next) => {
  console.log("here");

  req.session.regenerate(function (err) {
    if (err) next(err);

    const userSession = req.session;
    // store user information in session, typically a user id
    userSession.user = { Name: "me", Id: 1234, IsAdmin: true, token: null };

    // save the session before redirection to ensure page
    // load does not happen before session is saved
    req.session.save(function (err) {
      if (err) return next(`could not save session ${err}`);
      res.sendStatus(200);
      next();
    });
  });
});

export default router;
