import axios from "axios";
import express, { NextFunction, Request, Response } from "express";
import { getDiscordEnvironment } from "../envs";
import { User } from "src/user/user";

const router = express.Router();
const envs = getDiscordEnvironment();

function createUserFromGuildMemberObject(guildUserData: any): User {
  return {
    Id: guildUserData.user.id,
    Name: guildUserData.user.username,
    IsAdmin: isUserAdmin(guildUserData.roles),
  };
}

function isUserAdmin(userRoles: string[]) {
  return userRoles.includes("892525015147380767");
}

export function isAuthorized(req: Request, res: Response, next: NextFunction) {
  console.log(req.session.user);
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

function sessionHandler(
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

    const user = createUserFromGuildMemberObject(guildUserData);
    sessionHandler(user, req, res, next);
  }
});

router.post("/token", async (req, res) => {
  const body = req.body;
  const accessToken = await authenticate(body.code, false);
  res.json({ access_token: accessToken });
});

router.post("/startsession", async (req, res, next) => {
  const guildUserData = await getGuildMember(req.body.access_token);
  const user = createUserFromGuildMemberObject(guildUserData);
  sessionHandler(user, req, res, next);
});

router.get("/login", (req, res, next) => {
  res.redirect(
    `https://discord.com/oauth2/authorize?client_id=${envs.DiscordClientID}&response_type=code&redirect_uri=https%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth%2Fredirect&scope=identify+guilds.members.read`,
  );
});

export default router;
