const argv = require('minimist')(process.argv.slice(2));
const re = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/g

const playlistFile = getOrDefault(argv.playlist, "public/playlist.json")
const useSavedState = isDefined(argv.usestate)
const doesLoop = isDefined(argv.loop)
const setIndex = getOrDefault(argv.setindex, 0)
const startTime = Date.now() - parseTime(getOrDefault(argv.starttime, '0')) * 1000
const isLoadOverriden = isDefined(setIndex) || isDefined(startTime)

export {
  playlistFile,
  useSavedState,
  doesLoop,
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

function parseTime(time: any) {
  if (Number(time))
    return time
  else {
    let totaltime = 0
    const result = re.exec(String(time))
    if (result !== null) {
      if (result[3] !== undefined) {
        totaltime += Number(result[3])
        totaltime += Number(result[2]) * 60
        totaltime += Number(result[1]) * 60 * 60
      } else {
        totaltime += Number(result[2])
        totaltime += Number(result[1]) * 60
      }
    }

    return totaltime
  }
}
