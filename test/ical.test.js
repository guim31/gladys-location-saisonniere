// -----------------------------------------------------------------------------
// The iCalendar reader, on the real exports of the platforms (anonymized, see
// test/fixtures/feeds/README.md) and on the date-time forms of the channel
// managers: UTC, TZID, floating, midnight read as a date.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feed } from './helpers/world.js';
import { parseCalendar, parseLine, parsePoint, unescapeText } from '../src/ical.js';

test('reads an Airbnb export: dates, folded description, summary', () => {
  const calendar = parseCalendar(feed('airbnb-export.ics'));
  assert.match(calendar.prodId, /Airbnb/);
  assert.equal(calendar.events.length, 6);
  const [first] = calendar.events;
  assert.deepEqual(first.start, { date: '2027-07-02', time: null });
  assert.deepEqual(first.end, { date: '2027-07-10', time: null });
  assert.equal(first.summary, 'Reserved');
  // The folded line is joined back, `\n` becomes a line break.
  assert.equal(
    first.description,
    'Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMAAAA1111\nPhone Number (Last 4 Digits): 0101',
  );
  assert.equal(
    calendar.events.filter((event) => event.summary === 'Airbnb (Not available)').length,
    3,
  );
});

test('reads the Booking.com, Vrbo and Smoobu exports', () => {
  const booking = parseCalendar(feed('booking-export.ics'));
  assert.match(booking.prodId, /booking\.com/);
  assert.deepEqual(
    booking.events.map((event) => [event.summary, event.start.date, event.end.date]),
    [['CLOSED - Not available', '2027-07-31', '2027-08-07']],
  );
  const vrbo = parseCalendar(feed('vrbo-export.ics'));
  assert.equal(vrbo.events.length, 14);
  assert.equal(vrbo.events.filter((event) => event.summary.startsWith('Reserved - ')).length, 6);
  const smoobu = parseCalendar(feed('smoobu-export.ics'));
  assert.equal(smoobu.name, 'Smoobu: Villa Example');
  assert.equal(smoobu.events.length, 10);
});

test('reads date-times in UTC, in a TZID and as midnight dates', () => {
  process.env.TZ = 'Europe/Paris';
  const { events } = parseCalendar(feed('channel-manager-times.ics'));
  const byUid = Object.fromEntries(events.map((event) => [event.uid, event]));
  // TZID=Europe/Paris 17:00 in November is 16:00 UTC.
  assert.equal(byUid['stay-1001@channel.example'].start.time, Date.parse('2026-11-14T16:00:00Z'));
  assert.equal(byUid['stay-1001@channel.example'].start.date, '2026-11-14');
  assert.equal(byUid['stay-1002@channel.example'].start.time, Date.parse('2026-11-20T15:00:00Z'));
  // Midnight means "the day": the property hours will apply.
  assert.deepEqual(byUid['stay-1003@channel.example'].start, { date: '2026-11-25', time: null });
  assert.equal(byUid['stay-1004@channel.example'].status, 'CANCELLED');
  assert.equal(byUid['stay-1005@channel.example'].end, null);
});

test('a TZID across the change to summer time, an unknown TZID, a floating time', () => {
  process.env.TZ = 'Europe/Paris';
  const at = (value, params = {}) => parsePoint({ value, params });
  // 29 March 2026 is the first day of summer time in Paris: +02:00.
  assert.equal(
    at('20260329T150000', { TZID: 'Europe/Paris' }).time,
    Date.parse('2026-03-29T13:00:00Z'),
  );
  assert.equal(
    at('20260328T150000', { TZID: 'Europe/Paris' }).time,
    Date.parse('2026-03-28T14:00:00Z'),
  );
  assert.equal(
    at('20261114T150000', { TZID: 'America/New_York' }).time,
    Date.parse('2026-11-14T20:00:00Z'),
  );
  // A Windows zone name Node does not know: read as local time.
  assert.equal(
    at('20261114T150000', { TZID: 'Romance Standard Time' }).time,
    Date.parse('2026-11-14T14:00:00Z'),
  );
  assert.equal(at('20261114T150000').time, Date.parse('2026-11-14T14:00:00Z'));
  assert.equal(at('2026-11-14'), null);
});

test('skips the properties of nested components and unescapes the text', () => {
  const { events } = parseCalendar(
    [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20261201',
      'DTEND;VALUE=DATE:20261203',
      'SUMMARY:Reserved - Zoé\\, Paul',
      'BEGIN:VALARM',
      'SUMMARY:Alarm',
      'END:VALARM',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:no start',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].summary, 'Reserved - Zoé, Paul');
  assert.equal(unescapeText('a\\nb\\;c\\\\'), 'a\nb;c\\');
  assert.deepEqual(parseLine('DTSTART;TZID="Europe/Paris":20261201T100000'), {
    name: 'DTSTART',
    params: { TZID: 'Europe/Paris' },
    value: '20261201T100000',
  });
});
