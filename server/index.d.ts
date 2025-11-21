import { User } from "src/user";

declare module "express-session" {
  interface SessionData {
    user: User;
  }
}

export {};
//# sourceMappingURL=index.d.ts.map
