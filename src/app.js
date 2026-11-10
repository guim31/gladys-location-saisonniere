// -----------------------------------------------------------------------------
// Wiring between the Gladys SDK and the bookings: the handlers, the download
// of the feeds, the one-minute clock that publishes the states and fires the
// scene triggers. Takes the SDK client as a parameter so the tests drive it
// with the SDK's fake Gladys.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { mergeStays, propertyStatus, staysOfFeed } from './bookings.js';
import { normalizeConfig, refreshMs } from './config.js';
import { buildDevice, buildStates, idsOf, propertyName } from './devices.js';
import { fetchFeed } from './fetcher.js';
import { parseCalendar } from './ical.js';
import { MESSAGES, allLanguages, formatDateTime, pick, TEXT } from './i18n.js';
import { ProblemLog } from './problems.js';
import { eventData, momentsBetween, nextStayOutputs } from './scenes.js';
import { maskUrl, normalizeFeedUrl } from './url.js';
import { STAYS_WIDGET, staysContent } from './widgets.js';

const logger = createLogger({ name: 'app' });

export const ACTIONS = { CHECK_FEEDS: 'check_feeds' };
export const SCENE_ACTION_KEYS = ['next_stay'];
export const WIDGET_KEYS = [STAYS_WIDGET];

export const TICK_MS = 60_000;
// A value that does not change is published again this often, so Gladys
// never shows "no recent value" (it does past 48 h).
export const HEARTBEAT_MS = 6 * 3_600_000;
// Longest gap between two ticks whose moments still fire (a tick delayed by
// a slow download); beyond, they are dropped.
export const MAX_CATCH_UP_MS = 10 * 60_000;

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: 'L’initialisation a échoué, consultez les journaux de l’intégration.',
  de: 'Die Initialisierung ist fehlgeschlagen, sieh dir die Logs der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {object} [deps] test seams
 * @param {typeof fetch} [deps.fetchImpl]
 * @param {() => number} [deps.now]
 * @param {boolean} [deps.timers] false: no clock nor periodic download (tests)
 * @param {string} [deps.userAgent]
 */
export function registerHandlers(gladys, deps = {}) {
  const now = deps.now ?? Date.now;
  const useTimers = deps.timers !== false;
  let config = normalizeConfig();
  /** @type {Map<string, { etag?: string, lastModified?: string, stays: object[] | null, error: string | null }>} by property slot and address */
  const feeds = new Map();
  /** @type {Map<number, { property: object, stays: object[], status: object, failing: boolean, loaded: boolean }>} */
  let properties = new Map();
  let lastTick = null;
  let tickTimer = null;
  let refreshTimer = null;
  let stopped = false;
  let running = Promise.resolve();
  let lastConnection = null;
  const problems = new ProblemLog(logger);

  const feedKey = (slot, url) => `${slot} ${url}`;

  function rebuildProperties() {
    const next = new Map();
    for (const property of config.properties) {
      next.set(property.slot, {
        property,
        stays: [],
        status: propertyStatus([], now(), config),
        failing: false,
        loaded: false,
      });
    }
    properties = next;
    // Forget the feeds no property uses any more.
    const used = new Set(
      config.properties.flatMap((property) =>
        property.urls.map((url) => feedKey(property.slot, url)),
      ),
    );
    for (const key of feeds.keys()) {
      if (!used.has(key)) {
        feeds.delete(key);
      }
    }
  }

  /** The name the user gave the device in Gladys, else the configured one. */
  function nameOf(property) {
    const { device } = idsOf(gladys, property.slot);
    return (
      gladys.devices?.find((created) => created.external_id === device)?.name ??
      propertyName(property, config.language)
    );
  }

  const isCreated = (slot) => {
    const { device } = idsOf(gladys, slot);
    return (gladys.devices ?? []).some((created) => created.external_id === device);
  };

  async function downloadFeed(property, url) {
    const key = feedKey(property.slot, url);
    const cache = feeds.get(key) ?? { stays: null, error: null };
    feeds.set(key, cache);
    const label = `${propertyName(property, 'en')} (${maskUrl(url)})`;
    const normalized = normalizeFeedUrl(url);
    try {
      if (!normalized) {
        throw Object.assign(new Error('invalid_url'), { code: 'invalid_url' });
      }
      const result = await fetchFeed(normalized, {
        etag: cache.calendar ? cache.etag : undefined,
        lastModified: cache.calendar ? cache.lastModified : undefined,
        fetchImpl: deps.fetchImpl,
        userAgent: deps.userAgent,
      });
      if (!result.notModified) {
        cache.calendar = parseCalendar(result.text);
        cache.etag = result.etag;
        cache.lastModified = result.lastModified;
      }
      // Computed again on every refresh, 304 included: the check-in and
      // check-out hours of the property may have changed meanwhile.
      cache.stays = staysOfFeed(cache.calendar, { url: normalized.url, ...property });
      cache.error = null;
      problems.recover(key, `Calendar of ${label} reachable again`);
      logger.debug(`${label}: ${cache.stays.length} stay(s)`);
    } catch (err) {
      cache.error = err.code ?? 'error';
      problems.fail(key, `Calendar of ${label} unreachable: ${cache.error}`);
    }
  }

  async function refreshAll() {
    // In parallel: one address that never answers (30 s timeout) must not
    // hold the others, nor the 60 s of the "Check the calendars now" action.
    await Promise.all(
      config.properties.flatMap((property) =>
        property.urls.map((url) => downloadFeed(property, url)),
      ),
    );
    for (const property of config.properties) {
      const state = properties.get(property.slot);
      if (!state) {
        continue;
      }
      const results = property.urls.map((url) => feeds.get(feedKey(property.slot, url)));
      state.failing = results.some((feed) => feed?.error);
      state.loaded = results.some((feed) => feed?.stays);
      state.stays = mergeStays(
        results.flatMap((feed) => feed?.stays ?? []),
        config,
      );
    }
    await publishConnection();
    await tick({ refreshWidget: true });
  }

  async function publishConnection() {
    let connected = true;
    let message;
    if (config.properties.length === 0) {
      connected = false;
      message = MESSAGES.noProperty;
    } else {
      const failing = [...properties.values()].filter((state) => state.failing);
      if (failing.length > 0) {
        connected = false;
        const names = failing.map((state) => nameOf(state.property)).join(', ');
        message = allLanguages((language) => MESSAGES.unreachable[language](names));
      }
    }
    const key = JSON.stringify([connected, message]);
    if (key === lastConnection) {
      return;
    }
    try {
      await gladys.setConnectionStatus(connected, message);
      lastConnection = key;
    } catch (err) {
      logger.debug(`Connection status not sent: ${err.message}`);
    }
  }

  /**
   * The clock: states of every created device (only the changes, plus a
   * heartbeat), and the scene triggers whose moment just passed.
   */
  async function tick({ refreshWidget = false } = {}) {
    const at = now();
    // The moments passed since the last tick, within a bounded window: after
    // an outage, a check-in of last week must not start a scene now.
    const from = Math.max(lastTick ?? at, at - MAX_CATCH_UP_MS);
    lastTick = at;
    let changed = refreshWidget;
    const states = [];
    const moments = [];
    for (const state of properties.values()) {
      const previous = state.status;
      state.status = propertyStatus(state.stays, at, config);
      if (
        previous.occupied !== state.status.occupied ||
        previous.today !== state.status.today ||
        previous.next?.id !== state.status.next?.id
      ) {
        changed = true;
      }
      if (!isCreated(state.property.slot)) {
        continue;
      }
      states.push(...buildStates(gladys, state.property, state.status, config));
      for (const moment of momentsBetween(state.stays, from, at, config)) {
        moments.push({ state, moment });
      }
    }
    try {
      if (states.length > 0) {
        await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      }
      problems.recover('states', 'States published again');
    } catch (err) {
      problems.fail('states', `States not published: ${err.message}`);
    }
    // After the states: a scene started by "check-in" that tests "Occupied"
    // reads the new value.
    for (const { state, moment } of moments) {
      await fire(state, moment);
    }
    if (changed) {
      gladys.requestWidgetRefresh(STAYS_WIDGET);
    }
  }

  async function fire(state, moment) {
    const { device } = idsOf(gladys, state.property.slot);
    const name = nameOf(state.property);
    try {
      await gladys.publishSceneEvent(
        moment.key,
        eventData({
          deviceExternalId: device,
          name,
          stay: moment.stay,
          stays: state.stays,
          config,
        }),
      );
      logger.debug(`${moment.key} of ${name} sent to the scenes`);
    } catch (err) {
      logger.warn(`Scene trigger ${moment.key} not sent: ${err.message}`);
    }
  }

  /** Serializes the downloads: a timer, the action and a new config never overlap. */
  function queue(fn) {
    running = running.then(fn).catch((err) => logger.error('Refresh failed', err));
    return running;
  }

  function schedule() {
    clearInterval(tickTimer);
    clearInterval(refreshTimer);
    if (!useTimers || stopped) {
      return;
    }
    tickTimer = setInterval(() => queue(() => tick()), TICK_MS);
    refreshTimer = setInterval(() => queue(refreshAll), refreshMs(config));
    tickTimer.unref?.();
    refreshTimer.unref?.();
  }

  async function publishDevices() {
    await gladys.publishDiscoveredDevices(
      config.properties.map((property) => buildDevice(gladys, property, config)),
    );
  }

  /** Every state of one device, unconditionally (it was just created, or polled). */
  async function publishAll(device) {
    const state = [...properties.values()].find(
      (candidate) => idsOf(gladys, candidate.property.slot).device === device.external_id,
    );
    if (!state) {
      return;
    }
    state.status = propertyStatus(state.stays, now(), config);
    gladys.forgetPublishedStates(device.external_id);
    await gladys.publishChangedStates(buildStates(gladys, state.property, state.status, config), {
      heartbeat: HEARTBEAT_MS,
    });
  }

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      rebuildProperties();
      lastConnection = null;
      await publishDevices();
      schedule();
      await queue(refreshAll);
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys.setConnectionStatus(false, INIT_FAILED).catch(() => {});
    }
  });

  gladys.on('disconnected', () => {
    lastTick = null;
    clearInterval(tickTimer);
    clearInterval(refreshTimer);
  });

  gladys.onConfigUpdated(async (newConfig) => {
    config = normalizeConfig(newConfig);
    logger.info(`Configuration updated: ${config.properties.length} property(ies)`);
    rebuildProperties();
    await publishDevices();
    schedule();
    await queue(refreshAll);
  });

  gladys.onScanRequest(async () => {
    await publishDevices();
  });

  gladys.onDeviceCreated(async (device) => {
    await queue(async () => {
      await publishAll(device);
      gladys.requestWidgetRefresh(STAYS_WIDGET);
    });
  });
  gladys.onDeviceUpdated(async () => gladys.requestWidgetRefresh(STAYS_WIDGET));
  gladys.onDeviceDeleted(async () => gladys.requestWidgetRefresh(STAYS_WIDGET));

  // Fallback: the devices are published with `should_poll: false`, the clock
  // above pushes their states; a poll still answers with every state.
  gladys.onPoll(async (device) => {
    await queue(() => publishAll(device));
  });

  gladys.onAction(ACTIONS.CHECK_FEEDS, async () => {
    logger.info('Action check_feeds');
    await queue(refreshAll);
    if (config.properties.length === 0) {
      return MESSAGES.noProperty;
    }
    return allLanguages((language) =>
      [...properties.values()]
        .map((state) => {
          const name = nameOf(state.property);
          const errors = state.property.urls.filter(
            (url) => feeds.get(feedKey(state.property.slot, url))?.error,
          ).length;
          if (errors > 0) {
            return MESSAGES.reportError[language](name, errors);
          }
          const next = state.status.next
            ? formatDateTime(state.status.next.checkIn, language)
            : pick(TEXT, language).noBooking.toLowerCase();
          return MESSAGES.report[language](name, state.status.upcoming.length, next);
        })
        .join(' '),
    );
  });

  gladys.onSceneAction('next_stay', async (fields) => {
    const state = [...properties.values()].find(
      (candidate) => idsOf(gladys, candidate.property.slot).device === fields.property,
    );
    if (state) {
      state.status = propertyStatus(state.stays, now(), config);
    }
    return nextStayOutputs(
      state ? { status: state.status, name: nameOf(state.property) } : null,
      config,
    );
  });

  gladys.onWidgetGet(STAYS_WIDGET, async ({ settings, language }) =>
    staysContent(
      [...properties.values()].map((state) => ({
        name: nameOf(state.property),
        deviceExternalId: idsOf(gladys, state.property.slot).device,
        status: propertyStatus(state.stays, now(), config),
        failing: state.failing,
        loaded: state.loaded,
      })),
      { settings, language, showGuestDetails: config.show_guest_details },
    ),
  );

  return {
    /** Resolves once the work in progress is over (tests). */
    idle: () => running,
    /** Runs the one-minute clock once (tests). */
    tick: () => queue(() => tick()),
    /** Downloads every feed again (tests). */
    refresh: () => queue(refreshAll),
    stop() {
      stopped = true;
      clearInterval(tickTimer);
      clearInterval(refreshTimer);
    },
  };
}
