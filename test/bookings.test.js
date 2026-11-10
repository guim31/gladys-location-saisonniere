// -----------------------------------------------------------------------------
// From the feeds to the stays and the status of a property: classification of
// the real exports, merge of a property listed on two platforms, check-in and
// check-out hours, summer time, the "Not available" choice.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, NOW, URLS, feed } from './helpers/world.js';
import { parseCalendar } from '../src/ical.js';
import {
  KIND,
  NO_CHECK_IN_DAYS,
  NO_CHECK_IN_HOURS,
  classify,
  guestDetails,
  mergeStays,
  platformOf,
  propertyStatus,
  staysOfFeed,
} from '../src/bookings.js';

const HOURS = { checkInHour: 16, checkOutHour: 11 };
const CONFIG = { unavailable_events: 'stay', lead_hours: 3 };

const staysOf = (name, url, hours = HOURS) =>
  staysOfFeed(parseCalendar(feed(name)), { url, ...hours });

const duo = (config = CONFIG) =>
  mergeStays(
    [...staysOf('duo-airbnb.ics', URLS.airbnb), ...staysOf('duo-booking.ics', URLS.booking)],
    config,
  );

test('the summaries of the real exports are classified', () => {
  assert.equal(classify('Reserved'), KIND.RESERVATION);
  assert.equal(classify('Reserved - Alice'), KIND.RESERVATION);
  assert.equal(classify('Reservation 1001 - Martin'), KIND.RESERVATION);
  assert.equal(classify('Airbnb (Not available)'), KIND.BLOCKED);
  assert.equal(classify('Blocked'), KIND.BLOCKED);
  assert.equal(classify('Closed period'), KIND.BLOCKED);
  assert.equal(classify('CLOSED - Not available'), KIND.UNAVAILABLE);
  assert.equal(classify('Not available'), KIND.UNAVAILABLE);
  assert.equal(classify('Indisponible'), KIND.UNAVAILABLE);
  assert.equal(classify('Check-in'), null);
  assert.equal(classify('Check-out'), null);
});

test('the platform comes from the address, else from the PRODID', () => {
  assert.equal(platformOf(URLS.airbnb), 'Airbnb');
  assert.equal(platformOf(URLS.booking), 'Booking.com');
  assert.equal(platformOf(URLS.vrbo), 'Vrbo');
  assert.equal(platformOf('https://www.abritel.fr/icalendar/x.ics'), 'Abritel');
  assert.equal(platformOf('https://example.org/x.ics', 'login.smoobu.com'), 'Smoobu');
  assert.equal(platformOf('https://example.org/x.ics'), 'iCal');
});

test('Airbnb export: reservations at the property hours, blocks ignored', () => {
  const stays = staysOf('airbnb-export.ics', URLS.airbnb);
  assert.equal(stays.length, 3);
  assert.deepEqual(
    stays.map((stay) => [stay.startDate, stay.endDate, stay.kind, stay.platform, stay.code]),
    [
      ['2027-07-02', '2027-07-10', KIND.RESERVATION, 'Airbnb', 'HMAAAA1111'],
      ['2027-07-18', '2027-07-22', KIND.RESERVATION, 'Airbnb', 'HMBBBB2222'],
      ['2027-07-22', '2027-07-31', KIND.RESERVATION, 'Airbnb', 'HMCCCC3333'],
    ],
  );
  // 2 July 2027, 16:00 in Paris (summer time) is 14:00 UTC.
  assert.equal(stays[0].checkIn, Date.parse('2027-07-02T14:00:00Z'));
  assert.equal(stays[0].checkOut, Date.parse('2027-07-10T09:00:00Z'));
});

test('Vrbo export: first names kept apart, "Blocked" ignored', () => {
  const stays = staysOf('vrbo-export.ics', URLS.vrbo);
  assert.equal(stays.length, 6);
  assert.deepEqual(
    stays.map((stay) => stay.guest),
    ['Alice', 'Bruno', 'Chloé', 'David', 'Emma', 'Farid'],
  );
  // Back-to-back stays (2 and 9 August) stay two stays.
  const merged = mergeStays(stays, CONFIG);
  assert.equal(merged.length, 6);
});

test('Booking.com and Smoobu exports: "Not available" counted as stays, or ignored', () => {
  const smoobu = staysOf('smoobu-export.ics', 'https://login.smoobu.com/ical/x.ics');
  assert.equal(smoobu.length, 10);
  assert.ok(smoobu.every((stay) => stay.kind === KIND.UNAVAILABLE && stay.platform === 'Smoobu'));
  assert.equal(mergeStays(smoobu, CONFIG).length, 10);
  assert.equal(mergeStays(smoobu, { ...CONFIG, unavailable_events: 'ignore' }).length, 0);
  const booking = staysOf('booking-export.ics', URLS.booking);
  assert.deepEqual(
    booking.map((stay) => [stay.startDate, stay.endDate, stay.nights ?? null]),
    [['2027-07-31', '2027-08-07', null]],
  );
});

test('a property on Airbnb and Booking.com: one stay per booking, no duplicate', () => {
  const stays = duo();
  assert.deepEqual(
    stays.map((stay) => [stay.startDate, stay.endDate, stay.platform, stay.nights]),
    [
      // Airbnb reservation; its Booking.com "CLOSED" copy merged in.
      ['2026-11-10', '2026-11-13', 'Airbnb', 3],
      // Booking.com booking; its "Airbnb (Not available)" copy is a block.
      ['2026-11-13', '2026-11-16', 'Booking.com', 3],
      ['2026-11-21', '2026-11-23', 'Airbnb', 2],
      // 20-27 December: blocked on Airbnb only, not a stay.
      ['2027-03-26', '2027-03-29', 'Airbnb', 3],
    ],
  );
  // With the "Not available" dates ignored, the Booking.com booking is lost:
  // that is the warning of the option.
  assert.equal(duo({ ...CONFIG, unavailable_events: 'ignore' }).length, 3);
});

test('status on a turnover day: occupied until 11:00, the next guests at 16:00', () => {
  const stays = duo();
  const morning = propertyStatus(stays, NOW, CONFIG); // 09:00
  assert.equal(morning.occupied, true);
  assert.equal(morning.current.platform, 'Airbnb');
  assert.equal(morning.nightsLeft, 0);
  assert.equal(morning.turnoverToday, true);
  assert.equal(morning.next.platform, 'Booking.com');
  assert.equal(morning.hoursToCheckIn, 7);
  assert.equal(morning.daysToCheckIn, 0);
  assert.equal(morning.arrivalSoon, false);
  assert.equal(morning.nextCheckOut.endDate, '2026-11-13');

  const noon = propertyStatus(stays, NOW + 3 * HOUR, CONFIG); // 12:00
  assert.equal(noon.occupied, false);
  assert.equal(noon.nightsLeft, 0);
  assert.equal(noon.turnoverToday, true);
  assert.equal(noon.hoursToCheckIn, 4);
  assert.equal(noon.arrivalSoon, false);
  assert.equal(propertyStatus(stays, NOW + 4 * HOUR, CONFIG).arrivalSoon, true); // 13:00

  const evening = propertyStatus(stays, NOW + 10 * HOUR, CONFIG); // 19:00
  assert.equal(evening.occupied, true);
  assert.equal(evening.nightsLeft, 3);
  assert.equal(evening.next.startDate, '2026-11-21');
  assert.equal(evening.daysToCheckIn, 8);
  assert.equal(evening.nextCheckOut.endDate, '2026-11-16');

  // Saturday: no departure today any more.
  assert.equal(propertyStatus(stays, NOW + 24 * HOUR, CONFIG).turnoverToday, false);
});

test('hours before check-in across the change to summer time', () => {
  const stays = duo();
  // Friday 26 March 2027 09:00 (winter time) → check-in 16:00: 7 hours.
  assert.equal(propertyStatus(stays, Date.parse('2027-03-26T08:00:00Z'), CONFIG).hoursToCheckIn, 7);
  // Saturday 09:00 → check-out Monday 29 March 11:00 (summer time), 2 nights left.
  const saturday = propertyStatus(stays, Date.parse('2027-03-27T08:00:00Z'), CONFIG);
  assert.equal(saturday.nightsLeft, 2);
  assert.equal(saturday.current.checkOut, Date.parse('2027-03-29T09:00:00Z'));
});

test('no stay known: the "none" values, never a wait that would fire a scene', () => {
  const status = propertyStatus([], NOW, CONFIG);
  assert.equal(status.occupied, false);
  assert.equal(status.hoursToCheckIn, NO_CHECK_IN_HOURS);
  assert.equal(status.daysToCheckIn, NO_CHECK_IN_DAYS);
  assert.equal(status.arrivalSoon, false);
  assert.equal(status.nextCheckOut, null);
});

test('a missing or empty DTEND is one night', () => {
  const calendar = {
    events: [
      {
        uid: 'a',
        summary: 'Reserved',
        status: '',
        start: { date: '2026-12-01', time: null },
        end: null,
      },
      {
        uid: 'b',
        summary: 'Reserved',
        status: '',
        start: { date: '2026-12-05', time: null },
        end: { date: '2026-12-05', time: null },
      },
    ],
  };
  const stays = staysOfFeed(calendar, { url: URLS.airbnb, ...HOURS });
  assert.deepEqual(
    stays.map((stay) => [stay.startDate, stay.endDate]),
    [
      ['2026-12-01', '2026-12-02'],
      ['2026-12-05', '2026-12-06'],
    ],
  );
});

test('guest details: Airbnb code, Vrbo first name, channel manager reservation', () => {
  assert.deepEqual(
    guestDetails(
      'Reserved',
      'Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMAAAA1111',
    ),
    { code: 'HMAAAA1111' },
  );
  assert.deepEqual(guestDetails('Reserved - Alice', ''), { guest: 'Alice' });
  assert.deepEqual(guestDetails('Reservation 1001 - Martin', ''), {
    guest: 'Martin',
    code: '1001',
  });
  assert.deepEqual(guestDetails('Not available', ''), {});
});
