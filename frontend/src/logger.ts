import { Logger, type ILogObj } from "tslog";

const logger: Logger<ILogObj> = new Logger({
  minLevel: parseInt(import.meta.env.VITE_LOGLEVEL),
});

export default logger;
