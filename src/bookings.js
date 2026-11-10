// -----------------------------------------------------------------------------
// From the export calendars of a property to its stays, and from its stays to
// what Gladys shows: occupied now, next check-in and check-out, nights left…
//
// What the platforms export (checked on real, published exports, see
// test/fixtures/feeds):
//   - Airbnb: "Reserved" for its own bookings (the reservation code in the
//     DESCRIPTION), "Airbnb (Not available)" for everything else: dates the
//     host blocked AND bookings imported from the other platforms.
//   - Vrbo / Abritel (HomeAway): "Reserved - <first name>" and "Blocked".
//   - Booking.com: "CLOSED - Not available" for every event, bookings and
//     closed dates alike. Smoobu: "Not available" for its bookings, plus
//     "Check-in" / "Check-out" markers on some accounts.
// So three kinds: a sure booking, a sure block (ignored), and the
// "unavailable" events that may be either: counted as stays by default
// (`unavailable_events`), since that is all a Booking.com host gets.
//
// The same stay usually reaches several feeds (each platform imports the
// others to avoid double bookings): overlapping events are merged, a sure
// booking winning over the "unavailable" copies of it.
// -----------------------------------------------------------------------------

import { digest } from './url.js';
import { HOUR_MS, addDays, daysBetween, localDate, localTime } from './time.js';

export const KIND = { RESERVATION: 'reservation', UNAVAILABLE: 'unavailable', BLOCKED: 'blocked' };

// Values published when no check-in is known, above any real wait: a scene
// "less than 3 hours before the check-in" never fires on them.
export const NO_CHECK_IN_HOURS = 9999;
export const NO_CHECK_IN_DAYS = 999;

const MARKER = /^(check[\s-]?in|check[\s-]?out|arrivée|départ|anreise|abreise|llegada|salida)\b/i;
const BLOCKED = [
  /\(not available\)/i, // Airbnb (Not available)
  /^blocked\b/i,
  /^bloqu/i, // bloqué, bloqueado
  /^gesperrt/i,
  /closed period/i,
  /^owner\b/i,
  /^propriétaire/i,
  /maintenance/i,
];
const UNAVAILABLE = [
  /not available/i, // Booking.com, Smoobu
  /^closed\b/i,
  /unavailable/i,
  /indisponible/i,
  /nicht verfügbar/i,
  /no disponible/i,
];

/** What one event is, from its summary. `null`: not a stay at all (a marker). */
export function classify(summary) {
  const text = summary.trim();
  if (MARKER.test(text)) {
    return null;
  }
  if (BLOCKED.some((pattern) => pattern.test(text))) {
    return KIND.BLOCKED;
  }
  if (UNAVAILABLE.some((pattern) => pattern.test(text))) {
    return KIND.UNAVAILABLE;
  }
  // "Reserved", "Reservation 1234 - Name", a guest name from a channel
  // manager: a feed of a rental property lists bookings.
  return KIND.RESERVATION;
}

const PLATFORMS = [
  [/airbnb\./, 'Airbnb'],
  [/booking\.com$/, 'Booking.com'],
  [/abritel\./, 'Abritel'],
  [/(vrbo|homeaway)\./, 'Vrbo'],
  [/gites-de-france/, 'Gîtes de France'],
  [/clevacances/, 'Clévacances'],
  [/smoobu\./, 'Smoobu'],
  [/lodgify\./, 'Lodgify'],
  [/beds24\./, 'Beds24'],
  [/hostaway\./, 'Hostaway'],
  [/leboncoin\./, 'leboncoin'],
  [/google\./, 'Google'],
];

/** The platform of a feed, from its address, else from its PRODID. */
export function platformOf(url, prodId = '') {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // keep the PRODID
  }
  for (const [pattern, name] of PLATFORMS) {
    if (pattern.test(host)) {
      return name;
    }
  }
  const product = prodId.toLowerCase();
  if (product.includes('airbnb')) return 'Airbnb';
  if (product.includes('booking.com')) return 'Booking.com';
  if (product.includes('homeaway') || product.includes('vrbo')) return 'Vrbo';
  if (product.includes('smoobu')) return 'Smoobu';
  return 'iCal';
}

/**
 * Guest first name and reservation code, when the feed gives them. Personal
 * data: only shown when the user asked for it (`show_guest_details`).
 */
export function guestDetails(summary, description) {
  const code =
    /reservations\/details\/([A-Z0-9]{6,})/.exec(description)?.[1] ??
    /^Reservation\s+([A-Za-z0-9-]{3,})/i.exec(summary)?.[1];
  const guest =
    /^Reserved\s*[-:]\s*(.+)$/i.exec(summary)?.[1] ??
    /^Reservation\s+\S+\s*-\s*(.+)$/i.exec(summary)?.[1];
  return {
    ...(guest ? { guest: guest.trim().slice(0, 60) } : {}),
    ...(code ? { code } : {}),
  };
}

/**
 * The stays of one feed.
 * @param {{ events: object[], prodId?: string }} calendar parsed feed (src/ical.js)
 * @param {{ url: string, checkInHour: number, checkOutHour: number }} source
 */
export function staysOfFeed(calendar, source) {
  const platform = platformOf(source.url, calendar.prodId);
  const stays = [];
  for (const event of calendar.events) {
    if (event.status === 'CANCELLED') {
      continue;
    }
    const kind = classify(event.summary);
    if (kind === null || kind === KIND.BLOCKED) {
      continue;
    }
    const startDate = event.start.date;
    let endDate = event.end?.date ?? addDays(startDate, 1);
    const checkIn = event.start.time ?? localTime(startDate, source.checkInHour);
    let checkOut = event.end?.time ?? localTime(endDate, source.checkOutHour);
    if (checkOut <= checkIn) {
      // DTEND missing, equal to DTSTART or before it: a one-night stay.
      endDate = addDays(startDate, 1);
      checkOut = localTime(endDate, source.checkOutHour);
    }
    stays.push({
      id: digest(event.uid || `${platform} ${startDate} ${endDate}`, 12),
      startDate,
      endDate,
      checkIn,
      checkOut,
      platform,
      kind,
      ...(kind === KIND.RESERVATION ? guestDetails(event.summary, event.description) : {}),
    });
  }
  return stays;
}

const overlaps = (a, b) => a.checkIn < b.checkOut && b.checkIn < a.checkOut;

function union(group) {
  const [first] = group;
  const merged = { ...first };
  for (const stay of group.slice(1)) {
    if (stay.checkIn < merged.checkIn) {
      merged.checkIn = stay.checkIn;
      merged.startDate = stay.startDate;
    }
    if (stay.checkOut > merged.checkOut) {
      merged.checkOut = stay.checkOut;
      merged.endDate = stay.endDate;
    }
    merged.guest ??= stay.guest;
    merged.code ??= stay.code;
  }
  return merged;
}

/** Overlapping stays as groups, in check-in order. */
function clusters(stays) {
  const sorted = [...stays].sort((a, b) => a.checkIn - b.checkIn || a.checkOut - b.checkOut);
  const groups = [];
  for (const stay of sorted) {
    const group = groups.at(-1);
    if (group && group.some((other) => overlaps(other, stay))) {
      group.push(stay);
    } else {
      groups.push([stay]);
    }
  }
  return groups;
}

/**
 * One list of stays out of the feeds of a property.
 * @param {object[]} stays the stays of every feed
 * @param {{ unavailable_events: string }} config
 */
export function mergeStays(stays, config) {
  const kept =
    config.unavailable_events === 'ignore'
      ? stays.filter((stay) => stay.kind === KIND.RESERVATION)
      : stays;
  const merged = [];
  for (const group of clusters(kept)) {
    const sure = group.filter((stay) => stay.kind === KIND.RESERVATION);
    if (sure.length === 0) {
      merged.push(union(group));
      continue;
    }
    // The "unavailable" copies of a booking go; two sure bookings still
    // overlapping are one stay listed twice (or a double booking): one stay.
    for (const subgroup of clusters(sure)) {
      merged.push(union(subgroup));
    }
  }
  return merged
    .map((stay) => ({ ...stay, nights: Math.max(1, daysBetween(stay.startDate, stay.endDate)) }))
    .sort((a, b) => a.checkIn - b.checkIn);
}

/**
 * What a property looks like at `now`.
 * @param {object[]} stays merged stays (mergeStays)
 * @param {number} now
 * @param {{ lead_hours: number }} config
 */
export function propertyStatus(stays, now, config) {
  const today = localDate(now);
  const current = stays.find((stay) => stay.checkIn <= now && now < stay.checkOut) ?? null;
  const next = stays.find((stay) => stay.checkIn > now) ?? null;
  const untilCheckIn = next ? next.checkIn - now : null;
  return {
    today,
    current,
    next,
    occupied: current !== null,
    arrivalSoon: untilCheckIn !== null && untilCheckIn <= config.lead_hours * HOUR_MS,
    turnoverToday:
      stays.some((stay) => stay.endDate === today) &&
      stays.some((stay) => stay.startDate === today),
    // Rounded up: "in 7 hours" until 6 h 59 are left, so "3 hours or less" means it.
    hoursToCheckIn: next ? Math.ceil(untilCheckIn / HOUR_MS) : NO_CHECK_IN_HOURS,
    daysToCheckIn: next ? Math.max(0, daysBetween(today, next.startDate)) : NO_CHECK_IN_DAYS,
    nightsLeft: current ? Math.max(0, daysBetween(today, current.endDate)) : 0,
    nextCheckOut: current ?? next,
    upcoming: stays.filter((stay) => stay.checkOut > now),
  };
}
