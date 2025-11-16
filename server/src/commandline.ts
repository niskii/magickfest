import { parseTime } from "./time-parser";

const argv = require("minimist")(process.argv.slice(2));

const parsedForwardTime = parseTime(getOrDefault(argv.forward, "0"));
if (parsedForwardTime === null) {
  throw new Error("Invalid input for starttime", argv.forward);
}

let scheduledTime = Date.now();
if (isDefined(argv.scheduledstart)) {
  scheduledTime = Date.parse(argv.scheduledstart);
}

const playlistFile = getOrDefault(
  argv.playlist,
  process.env.SETS_LOCATION + "/playlist.json",
);
const useSavedState = isDefined(argv.usestate);
const isLooped = isDefined(argv.loop);
const setIndex = getOrDefault(argv.setindex, 0);
const forwarded = parsedForwardTime * 1000;
const isLoadOverriden = isDefined(argv.setindex) || isDefined(argv.forward);
const scheduledStart = scheduledTime;

export {
  playlistFile,
  useSavedState,
  isLooped,
  setIndex,
  forwarded,
  isLoadOverriden,
  scheduledStart,
};

function getOrDefault(variable: any, def: any) {
  if (variable !== undefined) return variable;
  return def;
}

function isDefined(variable: any) {
  return variable !== undefined;
}
