import { Logger, type ILogObj } from "tslog";
import "dotenv/config";

const logger: Logger<ILogObj> = new Logger({
    minLevel: parseInt(process.env.LOGLEVEL!),
});

export default logger;
