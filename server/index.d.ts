import { User } from "src/user/user";

declare module "express-session" {
  interface SessionData {
    user: User;
  }
}

export {};
//# sourceMappingURL=index.d.ts.map
