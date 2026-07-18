const re = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parses the input of the format H?H:MM:SS, M?M:SS or plain number.
 *
 * @param time input to parse
 * @returns the total time calculated in seconds
 */
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

// time in UTC, HH:MM
export function parseTimeOfDay(time: any) {
    const asNumber = Number(time);
    if (!Number.isNaN(asNumber) && Number.isInteger(asNumber)) return asNumber;
    else {
        const now = new Date();
        const result = re.exec(String(time));

        if (result !== null) {
            const targetTime = Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                Number(result[1]),
                Number(result[2]),
                0,
                0
            )

            return Math.round((targetTime - Date.now()) / 1000);
        } else {
            return null;
        }
    }
}
