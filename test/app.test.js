// -----------------------------------------------------------------------------
// The integration against the SDK's fake Gladys: devices, states, the clock
// that fires the scene triggers, the widget, the scene action, the action of
// the configuration screen, a calendar that fails, and what the logs say.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { CHANNEL_HTTPS, CONFIG, HOUR, MINUTE, URLS, createWorld } from './helpers/world.js';
import { HEARTBEAT_MS } from '../src/app.js';

const STUDIO = 'ext:test-integration:property:1';

test('one device per configured property, without polling', async () => {
  const world = await createWorld({ create: false });
  const devices = world.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => [device.external_id, device.name, device.should_poll]),
    [
      ['ext:test-integration:property:1', 'Studio Example', false],
      ['ext:test-integration:property:2', 'Seaside Example', false],
      ['ext:test-integration:property:3', 'Logement 3', false],
    ],
  );
  // Nothing is published for a device Gladys does not have yet.
  assert.equal(world.fake.states.length, 0);
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  world.app.stop();
});

test('a created device receives every state at once, then only the changes', async () => {
  const world = await createWorld();
  assert.equal(world.state(1, 'occupied'), 1);
  assert.equal(world.state(1, 'turnover_today'), 1);
  assert.equal(world.state(1, 'arrival_soon'), 0);
  assert.equal(world.state(1, 'hours_to_check_in'), 7);
  assert.equal(world.state(1, 'days_to_check_in'), 0);
  assert.equal(world.state(1, 'nights_left'), 0);
  assert.equal(world.state(1, 'next_check_in'), 'ven. 13 nov., 16:00 · Booking.com');
  assert.equal(world.state(1, 'next_check_out'), 'ven. 13 nov., 11:00 · Airbnb');
  assert.equal(world.state(2, 'next_check_in'), 'Aucune réservation');
  assert.equal(world.state(2, 'hours_to_check_in'), 9999);
  // Times of a channel manager feed are kept; midnight takes the property hours.
  assert.equal(world.state(3, 'next_check_in'), 'sam. 14 nov., 17:00 · iCal');

  const count = world.fake.states.length;
  await world.advance(MINUTE);
  assert.equal(world.fake.states.length, count, 'nothing changed within the minute');
  await world.advance(HOUR);
  assert.equal(world.state(1, 'hours_to_check_in'), 6);
  assert.equal(world.fake.states.length, count + 2, 'the two hour counters (studio, chalet)');
  world.app.stop();
});

test('the clock fires check-out, check-in soon and check-in once each', async () => {
  const world = await createWorld();
  await world.advance(8 * HOUR); // 09:00 → 17:00
  assert.deepEqual(
    world.fake.sceneEvents.map((event) => [event.key, event.data.property, event.data.platform]),
    [
      ['check_out', STUDIO, 'Airbnb'],
      ['arrival_soon', STUDIO, 'Booking.com'],
      ['check_in', STUDIO, 'Booking.com'],
    ],
  );
  const checkIn = world.fake.sceneEvents[2].data;
  assert.deepEqual(checkIn, {
    property: STUDIO,
    property_name: 'Studio Example',
    platform: 'Booking.com',
    nights: 3,
    check_in: 'ven. 13 nov., 16:00',
    check_out: 'lun. 16 nov., 11:00',
    turnover: true,
    guest: null,
  });
  assert.equal(world.state(1, 'occupied'), 1);
  assert.equal(world.state(1, 'nights_left'), 3);
  // A refresh of the feeds fires nothing again.
  await world.app.refresh();
  await world.advance(MINUTE);
  assert.equal(world.fake.sceneEvents.length, 3);
  world.app.stop();
});

test('a device not created in Gladys fires no trigger', async () => {
  const world = await createWorld({ create: false });
  await world.advance(8 * HOUR);
  assert.deepEqual(world.fake.sceneEvents, []);
  world.app.stop();
});

test('guest details only when the user asked for them', async () => {
  const shown = await createWorld({
    config: { ...CONFIG, show_guest_details: true },
    now: Date.parse('2026-11-14T15:30:00Z'), // Saturday 16:30
  });
  await shown.advance(HOUR);
  const event = shown.fake.sceneEvents.find((candidate) => candidate.key === 'check_in');
  assert.equal(event.data.property_name, 'Logement 3');
  assert.equal(event.data.guest, 'Martin');
  const content = (await shown.fake.widgetGet('stays', { settings: {}, language: 'en' })).data
    .content;
  const items = content.components.find((component) => component.type === 'card-list').items;
  assert.ok(items.some((item) => item.description === 'Guest: Martin\nReservation code: 1001'));
  shown.app.stop();

  const hidden = await createWorld();
  const hiddenContent = (await hidden.fake.widgetGet('stays', { settings: {}, language: 'en' }))
    .data.content;
  assert.doesNotMatch(JSON.stringify(hiddenContent), /Martin|HMDDDD4444|1001/);
  hidden.app.stop();
});

test('the widget: status, coming stays, one property, valid content', async () => {
  const world = await createWorld();
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const settings of [{}, { property: STUDIO }, { property: STUDIO, show_status: false }]) {
      const { data } = await world.fake.widgetGet('stays', { settings, language });
      assert.deepEqual(
        validateWidgetContent(data.content),
        [],
        `${language} ${JSON.stringify(settings)}`,
      );
    }
  }
  const { data } = await world.fake.widgetGet('stays', {
    settings: { property: STUDIO },
    language: 'en',
  });
  const [status, list] = data.content.components;
  assert.deepEqual(status.items, [
    {
      label: 'Studio Example',
      value: 'Occupied → Fri 13 Nov',
      icon: 'home',
      color: 'success',
    },
  ]);
  assert.deepEqual(list.items[0], {
    title: 'Tue 10 Nov → Fri 13 Nov',
    subtitle: '3 nights · Airbnb',
    badge: { text: 'Ongoing', color: 'success' },
  });
  assert.deepEqual(list.items[1].badge, { text: 'Turnover', color: 'warning' });
  const hidden = await world.fake.widgetGet('stays', {
    settings: { property: STUDIO, show_status: false },
    language: 'en',
  });
  assert.equal(hidden.data.content.components[0].type, 'card-list');
  // The name given in Gladys wins over the configured one.
  await world.fake.deviceUpdated({ ...world.deviceOf(1), name: 'Studio du port' });
  const renamed = await world.fake.widgetGet('stays', { settings: {}, language: 'fr' });
  assert.equal(renamed.data.content.components[0].items[0].label, 'Studio du port');
  assert.ok(world.fake.widgetRefreshes.length > 0);
  world.app.stop();
});

test('the next_stay scene action', async () => {
  const world = await createWorld();
  const ongoing = await world.fake.sceneAction('next_stay', { property: STUDIO });
  assert.deepEqual(ongoing.data.outputs, {
    found: true,
    property_name: 'Studio Example',
    occupied: true,
    check_in: 'mar. 10 nov., 16:00',
    check_out: 'ven. 13 nov., 11:00',
    nights: 3,
    days_to_check_in: 0,
    platform: 'Airbnb',
  });
  const none = await world.fake.sceneAction('next_stay', {
    property: 'ext:test-integration:property:2',
  });
  assert.equal(none.data.outputs.found, false);
  assert.equal(none.data.outputs.check_in, 'Aucune réservation');
  world.app.stop();
});

test('a calendar that fails: last stays kept, status and action say which property', async () => {
  let fail = false;
  const airbnb = await import('./helpers/world.js').then(({ feed }) => feed('duo-airbnb.ics'));
  const world = await createWorld({
    routes: {
      [URLS.airbnb]: () => (fail ? { status: 503 } : { body: airbnb }),
    },
  });
  fail = true;
  await world.app.refresh();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.fr, /Studio Example/);
  assert.deepEqual(Object.keys(world.fake.connectionStatus.message).sort(), [
    'de',
    'en',
    'es',
    'fr',
  ]);
  assert.equal(world.state(1, 'occupied'), 1, 'the stays of the last download are kept');
  const report = await world.fake.action('check_feeds', {});
  assert.match(
    report.data.message?.en ?? report.data.en,
    /Studio Example: 1 calendar\(s\) unreachable/,
  );
  assert.doesNotMatch(JSON.stringify(world.fake.connectionStatuses), /0123456789abcdef|S3CR3T/);
  fail = false;
  await world.app.refresh();
  assert.deepEqual(world.fake.connectionStatus, { connected: true });
  world.app.stop();
});

test('conditional downloads, webcal addresses', async () => {
  const world = await createWorld();
  await world.app.refresh();
  const channel = world.server.requests.filter((request) => request.url === CHANNEL_HTTPS);
  assert.equal(channel.length, 2);
  assert.ok(channel[1].headers['if-none-match'], 'the second download is conditional');
  world.app.stop();
});

test('no property: the configuration screen says what to do', async () => {
  const world = await createWorld({ config: {} });
  assert.equal(world.fake.discoveredDevices.length, 0);
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /Add a property/);
  world.app.stop();
});

test('a new configuration renames nothing and keeps the device ids', async () => {
  const world = await createWorld();
  await world.fake.configUpdated({ ...CONFIG, property_1_name: 'Renamed', language: 'en' });
  await world.app.idle();
  assert.equal(world.fake.discoveredDevices[0].external_id, STUDIO);
  assert.equal(world.fake.discoveredDevices[0].name, 'Renamed');
  world.app.stop();
});

test('an unchanged value is published again after the heartbeat', async (t) => {
  // The SDK dates its heartbeat with Date.now(): move that clock too.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-13T08:00:00.000Z') });
  const world = await createWorld();
  const id = `${STUDIO}:turnover_today`;
  const count = () =>
    world.fake.states.filter((state) => state.device_feature_external_id === id).length;
  const before = count();
  await world.advance(HOUR);
  assert.equal(count(), before, 'unchanged within the hour');
  // 6 h later, on Friday afternoon: still a turnover day, same value.
  t.mock.timers.setTime(Date.now() + HEARTBEAT_MS);
  await world.advance(5 * HOUR + MINUTE);
  assert.equal(count(), before + 1, 'the heartbeat re-sent the unchanged value');
  world.app.stop();
});
