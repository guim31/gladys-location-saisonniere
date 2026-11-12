// -----------------------------------------------------------------------------
// Configuration (manifest `config_schema`). DEFAULT_CONFIG mirrors the
// `default` values of the manifest (checked by test/manifest.test.js); the
// normalizer turns what the form sends (strings, blanks, `undefined`) into
// values the rest of the code can trust.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Properties the form declares: `property_<n>_name`, `property_<n>_url_1`,
// `property_<n>_url_2`, `property_<n>_check_in`, `property_<n>_check_out`.
export const PROPERTY_COUNT = 3;

// Choices of the `select` fields, as the manifest declares them (strings).
export const CHECK_IN_HOURS = ['12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];
export const CHECK_OUT_HOURS = ['7', '8', '9', '10', '11', '12', '13', '14'];
export const REFRESH_MINUTES = ['15', '30', '60', '180'];
// What to do with the "Not available" events that may be bookings
// (Booking.com, Smoobu: see src/bookings.js).
export const UNAVAILABLE_EVENTS = ['stay', 'ignore'];

export const DEFAULT_CONFIG = {
  property_1_check_in: '16',
  property_1_check_out: '11',
  property_2_check_in: '16',
  property_2_check_out: '11',
  property_3_check_in: '16',
  property_3_check_out: '11',
  lead_hours: 3,
  unavailable_events: 'stay',
  show_guest_details: false,
  refresh_minutes: '30',
  language: 'fr',
};

// Bounds of the `number` fields (integers: the Gladys form renders them
// without `step`, see CLAUDE.md).
export const LEAD_HOURS = { min: 0, max: 72 };

function integerIn(value, { min, max }, fallback) {
  const number = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
  if (value === '' || typeof number !== 'number' || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function oneOf(value, choices, fallback) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return choices.includes(text) ? text : fallback;
}

function textOf(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** The addresses of one field: several may be pasted, separated by blanks or commas. */
export function splitUrls(value) {
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(/[\s,;]+/)
    .map((url) => url.trim())
    .filter(Boolean);
}

/**
 * The properties the user filled: a slot counts once it has an address.
 * @returns {{ slot: number, name: string, urls: string[], checkInHour: number, checkOutHour: number }[]}
 */
function parseProperties(raw) {
  const properties = [];
  for (let slot = 1; slot <= PROPERTY_COUNT; slot += 1) {
    const urls = [
      ...new Set([
        ...splitUrls(raw[`property_${slot}_url_1`]),
        ...splitUrls(raw[`property_${slot}_url_2`]),
      ]),
    ];
    if (urls.length === 0) {
      continue;
    }
    properties.push({
      slot,
      name: textOf(raw[`property_${slot}_name`]),
      urls,
      checkInHour: Number(
        oneOf(
          raw[`property_${slot}_check_in`],
          CHECK_IN_HOURS,
          DEFAULT_CONFIG[`property_${slot}_check_in`],
        ),
      ),
      checkOutHour: Number(
        oneOf(
          raw[`property_${slot}_check_out`],
          CHECK_OUT_HOURS,
          DEFAULT_CONFIG[`property_${slot}_check_out`],
        ),
      ),
    });
  }
  return properties;
}

/**
 * Merge the config with the defaults and coerce every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  return {
    properties: parseProperties(raw ?? {}),
    lead_hours: integerIn(raw?.lead_hours, LEAD_HOURS, DEFAULT_CONFIG.lead_hours),
    unavailable_events: oneOf(
      raw?.unavailable_events,
      UNAVAILABLE_EVENTS,
      DEFAULT_CONFIG.unavailable_events,
    ),
    show_guest_details: raw?.show_guest_details === true || raw?.show_guest_details === 'true',
    refresh_minutes: oneOf(raw?.refresh_minutes, REFRESH_MINUTES, DEFAULT_CONFIG.refresh_minutes),
    language: oneOf(raw?.language, LANGUAGES, DEFAULT_CONFIG.language),
  };
}

/** Refresh period of the feeds, in milliseconds. */
export function refreshMs(config) {
  return Number(config.refresh_minutes) * 60_000;
}
