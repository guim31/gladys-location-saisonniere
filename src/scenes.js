// -----------------------------------------------------------------------------
// Scene triggers (manifest `scene_triggers`) and the scene action
// (`scene_actions`). The triggers are moments, fired once when the clock
// passes them: the check-in time, the check-out time, and the check-in minus
// the lead time ("preheat N hours before"). The device states hold the rest
// (occupied, turnover today…) for the scenes that need a condition.
// -----------------------------------------------------------------------------

import { NO_CHECK_IN_DAYS } from './bookings.js';
import { pick, TEXT, formatDateTime } from './i18n.js';
import { HOUR_MS } from './time.js';

export const TRIGGERS = {
  CHECK_IN: 'check_in',
  CHECK_OUT: 'check_out',
  ARRIVAL_SOON: 'arrival_soon',
};

export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);

/**
 * The moments passed between `from` (excluded) and `to` (included), for the
 * stays of one property.
 * @returns {{ key: string, stay: object, at: number }[]}
 */
export function momentsBetween(stays, from, to, config) {
  const moments = [];
  const passed = (at) => at > from && at <= to;
  for (const stay of stays) {
    const soonAt = stay.checkIn - config.lead_hours * HOUR_MS;
    if (config.lead_hours > 0 && passed(soonAt)) {
      moments.push({ key: TRIGGERS.ARRIVAL_SOON, stay, at: soonAt });
    }
    if (passed(stay.checkIn)) {
      moments.push({ key: TRIGGERS.CHECK_IN, stay, at: stay.checkIn });
    }
    if (passed(stay.checkOut)) {
      moments.push({ key: TRIGGERS.CHECK_OUT, stay, at: stay.checkOut });
    }
  }
  return moments.sort((a, b) => a.at - b.at);
}

/**
 * The flat `data` of a trigger: `property` is the filter (the device chosen
 * in the scene editor), the other keys are the variables of the manifest.
 */
export function eventData({ deviceExternalId, name, stay, stays, config }) {
  const turnover =
    stays.some((other) => other !== stay && other.startDate === stay.endDate) ||
    stays.some((other) => other !== stay && other.endDate === stay.startDate);
  return {
    property: deviceExternalId,
    property_name: name,
    platform: stay.platform,
    nights: stay.nights,
    check_in: formatDateTime(stay.checkIn, config.language),
    check_out: formatDateTime(stay.checkOut, config.language),
    turnover,
    guest: config.show_guest_details ? (stay.guest ?? null) : null,
  };
}

/**
 * The `next_stay` scene action: the ongoing or next stay of one property,
 * for a message ("Next check-in Fri 14 Nov, 16:00, 2 nights").
 * @param {{ status: object, name: string } | null} property state of the property
 */
export function nextStayOutputs(property, config) {
  const text = pick(TEXT, config.language);
  const stay = property?.status.current ?? property?.status.next ?? null;
  if (!stay) {
    return {
      found: false,
      property_name: property?.name ?? '',
      occupied: false,
      check_in: text.noBooking,
      check_out: text.noBooking,
      nights: 0,
      days_to_check_in: NO_CHECK_IN_DAYS,
      platform: '',
    };
  }
  return {
    found: true,
    property_name: property.name,
    occupied: property.status.occupied,
    check_in: formatDateTime(stay.checkIn, config.language),
    check_out: formatDateTime(stay.checkOut, config.language),
    nights: stay.nights,
    days_to_check_in: property.status.occupied ? 0 : property.status.daysToCheckIn,
    platform: stay.platform,
  };
}
