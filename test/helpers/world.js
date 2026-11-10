// -----------------------------------------------------------------------------
// A test world: the SDK's fake Gladys, a fake web server serving the fixture
// feeds (with ETag / 304) and a settable clock. Times are read in
// Europe/Paris (the TZ the supervisor injects for a French instance).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

process.env.TZ = 'Europe/Paris';

// Friday 13 November 2026, 09:00 in Paris: the Airbnb guests leave at 11:00,
// the Booking.com guests arrive at 16:00 (fixtures duo-*.ics).
export const NOW = Date.parse('2026-11-13T08:00:00.000Z');
export const MINUTE = 60_000;
export const HOUR = 3_600_000;

/** A fixture feed, as text. */
export function feed(name) {
  return readFileSync(new URL(`../fixtures/feeds/${name}`, import.meta.url), 'utf8');
}

// Addresses as the platforms give them. The tokens are invented.
export const URLS = {
  airbnb: 'https://www.airbnb.fr/calendar/ical/12345678.ics?s=0123456789abcdef0123456789abcdef',
  booking: 'https://ical.booking.com/v1/export?t=00000000-aaaa-bbbb-cccc-000000000000',
  vrbo: 'http://www.vrbo.com/icalendar/0123456789abcdef0123456789abcdef.ics?nonTentative',
  channel: 'webcal://channel.example/ical/chalet.ics?key=S3CR3T-K3Y',
};
export const CHANNEL_HTTPS = 'https://channel.example/ical/chalet.ics?key=S3CR3T-K3Y';

export const ROUTES = {
  [URLS.airbnb]: feed('duo-airbnb.ics'),
  [URLS.booking]: feed('duo-booking.ics'),
  [URLS.vrbo]: feed('vrbo-export.ics'),
  [CHANNEL_HTTPS]: feed('channel-manager-times.ics'),
};

export const CONFIG = {
  property_1_name: 'Studio Example',
  property_1_url_1: URLS.airbnb,
  property_1_url_2: URLS.booking,
  property_2_name: 'Seaside Example',
  property_2_url_1: URLS.vrbo,
  property_3_url_1: URLS.channel,
  property_3_check_in: '15',
  property_3_check_out: '10',
};

/**
 * A fake web server: `routes` maps an address to a body string or a
 * function (request) → { status, body, headers } or an Error to throw.
 */
export function createServer(routes = {}) {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );
    requests.push({ url, headers });
    const route = routes[url];
    if (route === undefined) {
      return new Response('Not found', { status: 404 });
    }
    if (typeof route === 'function') {
      const answer = await route({ url, headers });
      if (answer instanceof Error) {
        throw answer;
      }
      return new Response(answer.body ?? null, {
        status: answer.status ?? 200,
        headers: answer.headers ?? {},
      });
    }
    const etag = `"${route.length}"`;
    if (headers['if-none-match'] === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    return new Response(route, { status: 200, headers: { etag, 'content-type': 'text/calendar' } });
  };
  return { routes, requests, fetchImpl };
}

/**
 * @param {object} [options]
 * @param {object} [options.config]
 * @param {object} [options.routes]
 * @param {number} [options.now]
 * @param {boolean} [options.create] create every discovered device in Gladys
 */
export async function createWorld(options = {}) {
  const clock = { now: options.now ?? NOW };
  const server = createServer({ ...ROUTES, ...(options.routes ?? {}) });
  const gladys = createFakeGladys({ config: options.config ?? CONFIG });
  const app = registerHandlers(gladys, {
    fetchImpl: server.fetchImpl,
    now: () => clock.now,
    timers: false,
  });
  await gladys.connect();
  await app.idle();
  const world = {
    gladys,
    fake: gladys.fake,
    app,
    server,
    clock,
    /** "Add to Gladys" on every discovered device. */
    async createAll() {
      for (const device of gladys.fake.discoveredDevices) {
        await gladys.fake.deviceCreated(structuredClone(device));
      }
      await app.idle();
    },
    /** Moves the clock minute by minute, like the container timer. */
    async advance(ms) {
      const end = clock.now + ms;
      while (clock.now < end) {
        clock.now = Math.min(end, clock.now + MINUTE);
        await app.tick();
      }
    },
    deviceOf(slot) {
      return gladys.fake.discoveredDevices.find((device) =>
        device.external_id.endsWith(`:property:${slot}`),
      );
    },
    state(slot, key) {
      return gladys.fake.lastState(`${world.deviceOf(slot).external_id}:${key}`);
    },
  };
  if (options.create !== false) {
    await world.createAll();
  }
  return world;
}
