import express from "express";
import { parseTime } from "../parsing/time-parser";
import { Player } from "../player/player";

const router = express.Router();

export function configureRouter(player: Player) {
  router.route("/*splat").post((req, res, next) => {
    if (req.session.user?.IsAdmin) {
      console.log("Admin request:", req.session.user);
      next();
    } else {
      next("No access!");
    }
  });

  router
    .route("/playposition")
    .get((req, res) => {
      const position = player.getCurrentPositionMilliseconds();
      if (position && req.query.formatted === "true") {
        res.json({
          hours: Math.floor((position / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((position / (1000 * 60)) % 60),
          seconds: Math.floor((position / 1000) % 60),
          milliseconds: Math.floor(position % 1000),
        });
      } else {
        res.json({
          position: position,
        });
      }
    })
    .post((req, res) => {
      const parsedTime = parseTime(req.query.time);
      if (parsedTime === null) {
        throw new Error("could not part input.");
      }
      player.setState(null, null, parsedTime * 1000);
      player.playAtForwarded();
      res.sendStatus(200);
    });

  router
    .route("/set")
    .get((_, res) => {
      const currentSet = player.getPlaylist().getCurrentSet();
      const set = {
        SetIndex: player.getPlaylist().getCurrentIndex(),
        Titel: currentSet.Title,
        Author: currentSet.Author,
      };
      res.json(set);
    })
    .post((req, res) => {
      const setIndex = Number(req.query.setindex);
      if (Number.isInteger(setIndex)) {
        player.setState(setIndex, null, null);
        player.playAtStart();
        res.sendStatus(200);
      } else {
        throw new Error("Invalid input");
      }
    });

  router.route("/playnext").post((_, res) => {
    player.nextSet();
    player.playAtStart();
    res.sendStatus(200);
  });
}

export default router;
