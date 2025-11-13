import { Request, NextFunction, Response } from "express";

export function isAuthorized(req: Request, res: Response, next: NextFunction) {
  if (true) {
    next();
  } else {
    res.sendStatus(401);
  }
}
