import {parseTime} from "./time-parser"

const argv = require('minimist')(process.argv.slice(2));

const parsedTime = parseTime(getOrDefault(argv.starttime, '0'))
if (parsedTime === null) {
  throw new Error("Invalid input for starttime", argv.starttime)
}

const playlistFile = getOrDefault(argv.playlist, "public/playlist.json")
const useSavedState = isDefined(argv.usestate)
const isLooped = isDefined(argv.loop)
const setIndex = getOrDefault(argv.setindex, 0)
const startTime = Date.now() - parsedTime * 1000
const isLoadOverriden = isDefined(setIndex) || isDefined(startTime)

export {
  playlistFile,
  useSavedState,
  isLooped,
  setIndex,
  startTime,
  isLoadOverriden
}

function getOrDefault(variable: any, def: any) {
  if (variable !== undefined)
    return variable
  return def
}

function isDefined(variable: any) {
  return variable !== undefined
}

