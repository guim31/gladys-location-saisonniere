// -----------------------------------------------------------------------------
// A small iCalendar reader, enough for the export calendars of the rental
// platforms: VEVENTs with DTSTART / DTEND as dates (Airbnb, Booking.com, Vrbo,
// Abritel, Smoobu, Gîtes de France…) or as date-times (UTC, TZID or floating:
// some channel managers). Those feeds carry no recurrence: a VEVENT is a stay
// or a block, an RRULE is ignored (its first occurrence only), which keeps
// the image free of a calendar library.
// -----------------------------------------------------------------------------

import { localDate, zonedTime } from './time.js';

/** Lines of the document, folded lines joined back (RFC 5545 §3.1). */
function unfold(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

/** `NAME;PARAM=a;PARAM=b:value` → { name, params, value }. */
export function parseLine(line) {
  let quoted = false;
  let colon = -1;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ':' && !quoted) {
      colon = index;
      break;
    }
  }
  if (colon < 0) {
    return null;
  }
  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params = {};
  for (const param of rawParams) {
    const equal = param.indexOf('=');
    if (equal > 0) {
      params[param.slice(0, equal).toUpperCase()] = param.slice(equal + 1).replace(/^"|"$/g, '');
    }
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** TEXT value unescaped (`\n`, `\,`, `\;`, `\\`). */
export function unescapeText(value) {
  return value.replace(/\\([nN,;\\])/g, (_, char) => (char === 'n' || char === 'N' ? '\n' : char));
}

const DATE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;

/**
 * A DTSTART / DTEND value as a point of the local calendar: its local date,
 * and its instant when the feed gives a time. A midnight is read as a date
 * (some exports write `T000000` for "the day"): the property's check-in and
 * check-out hours then apply.
 * @returns {{ date: string, time: number | null } | null}
 */
export function parsePoint(property) {
  if (!property) {
    return null;
  }
  const value = property.value.trim();
  const dateMatch = DATE.exec(value);
  if (dateMatch) {
    return { date: `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`, time: null };
  }
  const match = DATE_TIME.exec(value);
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const wall = { year, month, day, hour, minute, second };
  let time;
  if (match[7] === 'Z') {
    time = Date.UTC(year, month - 1, day, hour, minute, second);
  } else if (property.params.TZID) {
    time = zonedTime(wall, property.params.TZID);
  }
  // Floating time, or a zone this runtime does not know: the local zone.
  time ??= new Date(year, month - 1, day, hour, minute, second).getTime();
  if (!Number.isFinite(time)) {
    return null;
  }
  const date = localDate(time);
  const local = new Date(time);
  if (local.getHours() === 0 && local.getMinutes() === 0) {
    return { date, time: null };
  }
  return { date, time };
}

/**
 * @param {string} text the iCalendar document
 * @returns {{ name: string, prodId: string, events: { uid: string, summary: string, description: string, status: string, start: { date: string, time: number | null }, end: { date: string, time: number | null } | null }[] }}
 */
export function parseCalendar(text) {
  const events = [];
  let name = '';
  let prodId = '';
  let current = null;
  let depth = 0;
  for (const line of unfold(text)) {
    const property = parseLine(line);
    if (!property) {
      continue;
    }
    if (property.name === 'BEGIN') {
      depth += 1;
      if (property.value.toUpperCase() === 'VEVENT') {
        current = { depth, props: {} };
      }
      continue;
    }
    if (property.name === 'END') {
      if (current && depth === current.depth) {
        const event = toEvent(current.props);
        if (event) {
          events.push(event);
        }
        current = null;
      }
      depth -= 1;
      continue;
    }
    if (current) {
      // Nested components (VALARM) have their own properties: skip them.
      if (depth === current.depth) {
        current.props[property.name] ??= property;
      }
    } else if (property.name === 'X-WR-CALNAME') {
      name = unescapeText(property.value).trim();
    } else if (property.name === 'PRODID') {
      prodId = property.value;
    }
  }
  return { name, prodId, events };
}

function toEvent(props) {
  const start = parsePoint(props.DTSTART);
  if (!start) {
    return null;
  }
  return {
    uid: props.UID?.value.trim() ?? '',
    summary: props.SUMMARY ? unescapeText(props.SUMMARY.value).trim() : '',
    description: props.DESCRIPTION ? unescapeText(props.DESCRIPTION.value).trim() : '',
    status: props.STATUS?.value.trim().toUpperCase() ?? '',
    start,
    end: parsePoint(props.DTEND),
  };
}
