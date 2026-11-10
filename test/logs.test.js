// -----------------------------------------------------------------------------
// What the logs show: at the info level, the life cycle, the scene triggers
// fired and the problems (one line when it starts, one when it ends), never a
// line per download or per minute. At any level, never an iCal address:
// it is the key to the calendar.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, MINUTE, URLS, createWorld, feed } from './helpers/world.js';

/** Capture what the SDK logger writes, at `level`, until `stop()`. */
function captureLogs(t, level = 'info') {
  const lines = [];
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  for (const stream of [process.stdout, process.stderr]) {
    t.mock.method(stream, 'write', (chunk) => {
      lines.push(...String(chunk).split('\n').filter(Boolean));
      return true;
    });
  }
  return {
    lines,
    stop() {
      t.mock.restoreAll();
      if (previous === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = previous;
      }
    },
  };
}

const SECRETS = /0123456789abcdef|S3CR3T|00000000-aaaa|12345678\.ics/;

test('normal downloads and minutes write nothing at the info level', async (t) => {
  const world = await createWorld();
  const logs = captureLogs(t);
  try {
    await world.app.refresh();
    await world.advance(30 * MINUTE); // 09:00 → 09:30, no check-in nor check-out
    await world.app.refresh();
  } finally {
    logs.stop();
    world.app.stop();
  }
  assert.deepEqual(logs.lines, []);
});

test('a failing calendar: one line when it fails, one when it is back, no address', async (t) => {
  let fail = false;
  const airbnb = feed('duo-airbnb.ics');
  const world = await createWorld({
    routes: { [URLS.airbnb]: () => (fail ? new TypeError('fetch failed') : { body: airbnb }) },
  });
  const logs = captureLogs(t);
  try {
    fail = true;
    await world.app.refresh();
    await world.app.refresh();
    await world.app.refresh();
    fail = false;
    await world.app.refresh();
  } finally {
    logs.stop();
    world.app.stop();
  }
  assert.equal(logs.lines.length, 2, logs.lines.join('\n'));
  assert.match(logs.lines[0], /WARN.*Studio Example \(https:\/\/www\.airbnb\.fr\/…\) unreachable/);
  assert.match(logs.lines[1], /INFO.*reachable again/);
  assert.doesNotMatch(logs.lines.join('\n'), SECRETS);
});

test('no address in the debug logs either', async (t) => {
  const logs = captureLogs(t, 'debug');
  try {
    const world = await createWorld();
    await world.advance(8 * HOUR);
    await world.fake.action('check_feeds', {});
    world.app.stop();
  } finally {
    logs.stop();
  }
  assert.ok(logs.lines.length > 0);
  assert.doesNotMatch(logs.lines.join('\n'), SECRETS);
  // The three moments of the day are logged once each.
  assert.equal(logs.lines.filter((line) => /sent to the scenes/.test(line)).length, 3);
});
