import { UserType } from "src/user/user";

declare module "express-session" {
    interface SessionData {
        user: UserType;
    }
}

export { };
//# sourceMappingURL=index.d.ts.map
