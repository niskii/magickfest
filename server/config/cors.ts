import cors from "cors";
import config from "./config";

const corsConfig = cors({
    origin: config.origin,
    credentials: true,
    allowedHeaders: ["Access-Control-Allow-Origin"],
});

export default corsConfig;
