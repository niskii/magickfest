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
  return userRoles.includes(envs.DiscordAdminRole);
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

  if (redirect) formData.set("redirect_uri", envs.DiscordRedirectUrl);

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

function saveUserSession(user: User, req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate(function (err) {
      if (err) reject(err);

      // Discord embed cookie options
      // as referenced https://discord.com/developers/docs/activities/development-guides/networking
      const origin = req.get("origin");
      if (origin && new URL(origin).host == envs.DiscordURL.host) {
        req.session.cookie.sameSite = "none";
        // @ts-ignore
        req.session.cookie.partitioned = true;
      }

      req.session.user = user;
      req.session.save(function (err) {
        if (err) reject(`could not save session ${err}`);
        resolve();
      });
    });
  });
}

router.get("/redirect", async (req, res) => {
  const { code } = req.query;

  if (code) {
    const accessToken = await authenticate(code.toString(), true);
    const guildUserData = await getGuildMember(accessToken);

    const user = createUserFromGuildMemberObject(guildUserData);
    await saveUserSession(user, req);
    res.redirect(process.env.ClientRedirectUrl!);
  }
});

router.post("/token", async (req, res) => {
  const body = req.body;
  const accessToken = await authenticate(body.code, false);
  res.json({ access_token: accessToken });
});

router.post("/startsession", async (req, res) => {
  const guildUserData = await getGuildMember(req.body.access_token);
  const user = createUserFromGuildMemberObject(guildUserData);
  await saveUserSession(user, req);
  res.sendStatus(200);
});

router.get("/login", (req, res, next) => {
  res.redirect(
    `https://discord.com/oauth2/authorize?client_id=${envs.DiscordClientID}&response_type=code&redirect_uri=https%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth%2Fredirect&scope=identify+guilds.members.read`,
  );
});

export default router;
