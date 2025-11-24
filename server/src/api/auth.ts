import axios from "axios";
import express, { NextFunction, Request, Response } from "express";
import { getDiscordEnvironment } from "../envs";
import { createUserFromGuildMemberObject, User } from "src/user";

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

  try {
    const authResponse = await axios.post(
      "https://discord.com/api/v10/oauth2/token",
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    return authResponse.data.access_token;
  } catch {
    throw new Error("Something went wrong with the authorization!");
  }
}

async function getGuildMember(accessToken: string): Promise<any> {
  try {
    const userResponse = await axios.get(
      `https://discord.com/api/v10/users/@me/guilds/${envs.DiscordGuildID}/member`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return userResponse.data;
  } catch {
    throw new Error("You are not an exclusive member!");
  }
}

function loginHandler(
  user: User,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.session.regenerate(function (err) {
    if (err) next(err);

    req.session.user = user;
    req.session.save(function (err) {
      if (err) return next(`could not save session ${err}`);
      res.sendStatus(200);
    });
  });
}

router.get("/redirect", async (req, res, next) => {
  const { code } = req.query;

  if (code) {
    const accessToken = await authenticate(code.toString(), true);
    const guildUserData = await getGuildMember(accessToken);

    // Certified tmw user!
    const user = createUserFromGuildMemberObject(guildUserData);
    console.log(user);

    loginHandler(user, req, res, next);
  }
});

router.post("/token", async (req, res) => {
  const body = JSON.parse(await req.body);
  const accessToken = await authenticate(body.code, false);

  res.send(accessToken);
});

router.get("/halp", (req, res, next) => {
  const user: User = { Id: 12444, Name: "ba", IsAdmin: true, Token: "2" };
  loginHandler(user, req, res, next);
});

router.get("/login", (req, res, next) => {
  res.redirect(
    "https://discord.com/oauth2/authorize?client_id=1441002323332829285&response_type=code&redirect_uri=https%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth%2Fredirect&scope=identify+guilds.members.read",
  );
});

export default router;
