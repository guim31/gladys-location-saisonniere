import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, refreshMs, splitUrls } from '../src/config.js';

test('defaults when nothing is configured', () => {
  assert.deepEqual(normalizeConfig(), {
    properties: [],
    lead_hours: 3,
    unavailable_events: 'stay',
    show_guest_details: false,
    refresh_minutes: '30',
    language: 'fr',
  });
  assert.equal(refreshMs(normalizeConfig()), 30 * 60_000);
});

test('a property counts once it has an address; several addresses per field', () => {
  const config = normalizeConfig({
    property_1_name: '  Studio   du port ',
    property_2_name: 'No address',
    property_3_url_1: 'https://a.example/1.ics, https://b.example/2.ics',
    property_3_url_2: 'https://b.example/2.ics\nhttps://c.example/3.ics',
    property_3_check_in: '15',
    property_3_check_out: 'noon',
  });
  assert.deepEqual(config.properties, [
    {
      slot: 3,
      name: '',
      urls: ['https://a.example/1.ics', 'https://b.example/2.ics', 'https://c.example/3.ics'],
      checkInHour: 15,
      checkOutHour: 11,
    },
  ]);
  assert.deepEqual(splitUrls(undefined), []);
});

test('numbers, choices and booleans as the form sends them', () => {
  const config = normalizeConfig({
    lead_hours: '200',
    unavailable_events: 'ignore',
    show_guest_details: 'true',
    refresh_minutes: 5,
    language: 'xx',
  });
  assert.equal(config.lead_hours, 72);
  assert.equal(config.unavailable_events, 'ignore');
  assert.equal(config.show_guest_details, true);
  assert.equal(config.refresh_minutes, '30');
  assert.equal(config.language, 'fr');
  assert.equal(normalizeConfig({ lead_hours: '' }).lead_hours, 3);
  assert.equal(normalizeConfig({ lead_hours: '2,4' }).lead_hours, 2);
});
