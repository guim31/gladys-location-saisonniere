// -----------------------------------------------------------------------------
// Calendar-date helpers, in the container time zone. The Gladys supervisor
// injects TZ, the time zone of Gladys: the local days of this process are the
// days of the property (a host runs Gladys where the property is, or in the
// same time zone), the ones check-in and check-out hours are read in.
// -----------------------------------------------------------------------------

const pad = (number) => String(number).padStart(2, '0');

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` of a timestamp, read in the local time zone. */
export function localDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local `hour:minute` of a `YYYY-MM-DD` date, as a timestamp (DST-safe). */
export function localTime(dateString, hour = 0, minute = 0) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

/** `YYYY-MM-DD`, `days` calendar days after (or before) `dateString`. */
export function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  return localDate(new Date(year, month - 1, day + days).getTime());
}

/** Whole calendar days from `fromDate` to `toDate` (`YYYY-MM-DD`), DST-safe. */
export function daysBetween(fromDate, toDate) {
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = toDate.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** Offset of `timeZone` from UTC at `timestamp`, in milliseconds. */
function zoneOffset(timestamp, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(timestamp))
      .map(({ type, value }) => [type, value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(timestamp / 1000) * 1000;
}

/**
 * Timestamp of a wall-clock time in an IANA time zone (`TZID=Europe/Paris`).
 * An unknown zone (a Windows name such as "Romance Standard Time") gives
 * null: the caller reads the time in the local zone instead.
 * @param {{ year: number, month: number, day: number, hour: number, minute: number, second: number }} wall
 * @param {string} timeZone
 */
export function zonedTime(wall, timeZone) {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  try {
    // Two passes settle the offset on both sides of a DST change.
    const first = guess - zoneOffset(guess, timeZone);
    return guess - zoneOffset(first, timeZone);
  } catch {
    return null;
  }
}
