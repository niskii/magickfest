const re = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/g;

export function parseTime(time: any) {
  const asNumber = Number(time);
  if (!Number.isNaN(asNumber) && Number.isInteger(asNumber)) return asNumber;
  else {
    let totaltime = 0;
    const result = re.exec(String(time));
    if (result !== null) {
      if (result[3] !== undefined) {
        totaltime += Number(result[3]);
        totaltime += Number(result[2]) * 60;
        totaltime += Number(result[1]) * 60 * 60;
      } else {
        totaltime += Number(result[2]);
        totaltime += Number(result[1]) * 60;
      }
    } else {
      return null;
    }

    return totaltime;
  }
}
