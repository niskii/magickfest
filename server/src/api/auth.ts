import express, { NextFunction, Request, Response } from "express";
import session from "express-session";
import axios from "axios";
import { getDiscordEnvironment } from "../envs";
import { User } from "src/user";

const router = express.Router();

export function isAuthorized(req: Request, res: Response, next: NextFunction) {
  console.log(req.session);
  if (req.session.user) next();
  else next("Not Authorized");
}

router.get("/redirect", async (req, res) => {
  const envs = getDiscordEnvironment();
  const { code } = req.query;

  if (code) {
    const formData = new URLSearchParams({
      client_id: envs.DiscordClientID,
      client_secret: envs.DiscordClientSecret,
      grant_type: "authorization_code",
      code: code.toString(),
      redirect_uri: "https://localhost:8080/api/auth/redirect",
    });

    const authResponse = await axios
      .post("https://discord.com/api/v10/oauth2/token", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      .catch((reason) => {
        console.log(reason);
      });

    if (authResponse === undefined) {
      res.status(500).send("Something went wrong with the authorization!");
      return;
    }

    const access = authResponse.data.access_token;
    const userResponse = await axios
      .get(
        `https://discord.com/api/v10/users/@me/guilds/${envs.DiscordGuildID}/member`,
        {
          headers: {
            Authorization: `Bearer ${access}`,
          },
        },
      )
      .catch((reason) => {
        if (reason.status !== 404) console.log(reason);
      });

    if (userResponse === undefined) {
      res.status(403).send("You are not an exclusive member!");
      return;
    }

    // Certified tmw user!
    console.log(userResponse.data);
  }

  res.sendStatus(200);
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
