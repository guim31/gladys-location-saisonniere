// -----------------------------------------------------------------------------
// One Gladys device per property. Its external id is built on the slot of
// the property in the configuration (1 to 3): renaming the property or
// changing its addresses keeps the device, its history and its scenes.
//
// Every feature is a sensor. The states are computed in the container (each
// minute and after each download) and pushed: nothing for the core to poll.
// -----------------------------------------------------------------------------

import { NO_CHECK_IN_DAYS, NO_CHECK_IN_HOURS } from './bookings.js';
import { NAMES, TEXT, defaultPropertyName, pick, stayPoint } from './i18n.js';

export const DEVICE_TYPE = 'property';

export const FEATURES = {
  OCCUPIED: 'occupied',
  ARRIVAL_SOON: 'arrival_soon',
  TURNOVER_TODAY: 'turnover_today',
  NEXT_CHECK_IN: 'next_check_in',
  NEXT_CHECK_OUT: 'next_check_out',
  HOURS_TO_CHECK_IN: 'hours_to_check_in',
  DAYS_TO_CHECK_IN: 'days_to_check_in',
  NIGHTS_LEFT: 'nights_left',
};

const BLUEPRINT = [
  { key: FEATURES.OCCUPIED, category: 'input', type: 'binary', min: 0, max: 1 },
  { key: FEATURES.ARRIVAL_SOON, category: 'input', type: 'binary', min: 0, max: 1 },
  { key: FEATURES.TURNOVER_TODAY, category: 'input', type: 'binary', min: 0, max: 1 },
  { key: FEATURES.NEXT_CHECK_IN, category: 'text', type: 'text', min: 0, max: 0 },
  { key: FEATURES.NEXT_CHECK_OUT, category: 'text', type: 'text', min: 0, max: 0 },
  {
    key: FEATURES.HOURS_TO_CHECK_IN,
    category: 'duration',
    type: 'integer',
    unit: 'hours',
    min: 0,
    max: NO_CHECK_IN_HOURS,
  },
  {
    key: FEATURES.DAYS_TO_CHECK_IN,
    category: 'duration',
    type: 'integer',
    unit: 'days',
    min: 0,
    max: NO_CHECK_IN_DAYS,
  },
  {
    key: FEATURES.NIGHTS_LEFT,
    category: 'duration',
    type: 'integer',
    unit: 'days',
    min: 0,
    max: 365,
  },
];

export function idsOf(gladys, slot) {
  return gladys.externalIds(DEVICE_TYPE, String(slot));
}

/** The name a property gets in Gladys at creation (then the user's). */
export function propertyName(property, language) {
  return property.name || defaultPropertyName(property.slot, language);
}

/** The discovered device of one configured property. */
export function buildDevice(gladys, property, config) {
  const ids = idsOf(gladys, property.slot);
  const names = pick(NAMES, config.language);
  return {
    name: propertyName(property, config.language),
    external_id: ids.device,
    should_poll: false,
    features: BLUEPRINT.map(({ key, ...feature }) => ({
      name: names[key],
      external_id: ids.feature(key),
      ...feature,
      read_only: true,
      has_feedback: false,
    })),
  };
}

/** The states of a property, as `publishChangedStates` takes them. */
export function buildStates(gladys, property, status, config) {
  const ids = idsOf(gladys, property.slot);
  const text = pick(TEXT, config.language);
  const point = (stay, edge) =>
    stay ? stayPoint(stay[edge], stay.platform, config.language) : text.noBooking;
  const values = {
    [FEATURES.OCCUPIED]: status.occupied ? 1 : 0,
    [FEATURES.ARRIVAL_SOON]: status.arrivalSoon ? 1 : 0,
    [FEATURES.TURNOVER_TODAY]: status.turnoverToday ? 1 : 0,
    [FEATURES.NEXT_CHECK_IN]: { text: point(status.next, 'checkIn') },
    [FEATURES.NEXT_CHECK_OUT]: { text: point(status.nextCheckOut, 'checkOut') },
    [FEATURES.HOURS_TO_CHECK_IN]: status.hoursToCheckIn,
    [FEATURES.DAYS_TO_CHECK_IN]: status.daysToCheckIn,
    [FEATURES.NIGHTS_LEFT]: status.nightsLeft,
  };
  return Object.entries(values).map(([key, value]) => {
    const externalId = ids.feature(key);
    return typeof value === 'object'
      ? { device_feature_external_id: externalId, text: value.text }
      : { device_feature_external_id: externalId, state: value };
  });
}
