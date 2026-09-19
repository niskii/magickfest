import rateLimit from "express-rate-limit";
import settings from "./settings.json";

const rateLimitConfig = rateLimit({
    windowMs: settings.rateWindowMs,
    limit: settings.rateLimit,
    legacyHeaders: false,
});

export default rateLimitConfig;
