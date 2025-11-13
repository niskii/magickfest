import express from "express";
import { Bitrate, Player } from "./player";
import { parseTime } from "./time-parser";
import { SetInfo } from "./models/set";

const router = express.Router();

export function configureRouter(player: Player) {
  router
    .route("/playposition")
    .get((_, res) => {
      res.json({
        position: player.getCurrentReader(Bitrate.High)?.getCurrentTimeMillis(),
      });
    })
    .post((req, res) => {
      const parsedTime = parseTime(req.query.time);
      if (parsedTime === null) {
        res.sendStatus(422);
        return;
      }
      player.setState(null, null, parsedTime * 1000);
      player.playAtForwarded();
      res.sendStatus(200);
    });

  router
    .route("/set")
    .get((_, res) => {
      const currentSet = player.getPlaylist().getCurrentSet();
      const set: SetInfo = {
        SetIndex: player.getPlaylist().getCurrentIndex(),
        Titel: currentSet.Title,
        Author: currentSet.Author,
      };
      res.json(set);
    })
    .post((req, res) => {
      const setIndex = Number(req.query.setindex);
      if (Number.isInteger(setIndex)) {
        try {
          player.setState(setIndex, null, null);
        } catch (error) {
          res.status(422).send("The index is out of bounds");
          return;
        }
        player.playAtStart();
        res.sendStatus(200);
      } else {
        res.sendStatus(400);
      }
    });

  router.route("/playnext").post((_, res) => {
    try {
      player.nextSet();
      player.playAtStart();
    } catch (error) {
      console.log(error);
      res.status(500).send("Error");
    }

    res.sendStatus(200);
  });
}

export default router;
