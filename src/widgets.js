// -----------------------------------------------------------------------------
// The `stays` dashboard widget: occupied or vacant now, then the coming stays
// of one property (or of all of them), check-in to check-out. Pre-localized
// from the request language (the core caches per language).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { FORMATS, TEXT, formatDate, pick } from './i18n.js';

export const STAYS_WIDGET = 'stays';
const MAX_ITEMS = 8;

function badgeOf(stay, status, text) {
  if (status.current === stay) {
    return { text: text.current, color: WIDGET_COLORS.SUCCESS };
  }
  if (stay.startDate === status.today) {
    return {
      text: status.turnoverToday ? text.turnover : text.today,
      color: WIDGET_COLORS.WARNING,
    };
  }
  return undefined;
}

function statusItem(property, text, language) {
  if (property.failing && !property.loaded) {
    return { label: property.name, value: text.unreachable, color: WIDGET_COLORS.DANGER };
  }
  const { status } = property;
  if (status.occupied) {
    return {
      label: property.name,
      value: `${text.occupiedUntil} → ${formatDate(status.current.checkOut, language)}`,
      icon: 'home',
      color: WIDGET_COLORS.SUCCESS,
    };
  }
  return {
    label: property.name,
    value: status.next
      ? `${text.vacant} · ${formatDate(status.next.checkIn, language)}`
      : text.vacant,
    icon: 'home',
    color: property.failing ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
  };
}

/**
 * @param {{ name: string, deviceExternalId: string, status: object, failing: boolean, loaded: boolean }[]} properties
 * @param {{ settings?: object, language?: string, showGuestDetails: boolean }} options
 */
export function staysContent(properties, { settings = {}, language, showGuestDetails }) {
  const lang = ['en', 'fr', 'de', 'es'].includes(language) ? language : 'en';
  const text = pick(TEXT, lang);
  const format = pick(FORMATS, lang);
  const chosen = settings.property
    ? properties.filter((property) => property.deviceExternalId === settings.property)
    : properties;
  const components = [];

  if (settings.show_status !== false && chosen.length > 0) {
    components.push({
      type: 'status',
      items: chosen.slice(0, 10).map((property) => statusItem(property, text, lang)),
    });
  }

  const stays = chosen
    .flatMap((property) => property.status.upcoming.map((stay) => ({ stay, property })))
    .sort((a, b) => a.stay.checkIn - b.stay.checkIn)
    .slice(0, MAX_ITEMS);
  if (stays.length === 0) {
    components.push({ type: 'text', variant: 'caption', text: text.empty });
    return { ttl_seconds: 600, components };
  }
  components.push({
    type: 'card-list',
    display: 'list',
    items: stays.map(({ stay, property }) => {
      const details = showGuestDetails
        ? [stay.guest && format.guest(stay.guest), stay.code && format.code(stay.code)].filter(
            Boolean,
          )
        : [];
      const badge = badgeOf(stay, property.status, text);
      return {
        title: `${formatDate(stay.checkIn, lang)} → ${formatDate(stay.checkOut, lang)}`,
        subtitle: [
          chosen.length > 1 ? property.name : null,
          format.nights(stay.nights),
          stay.platform,
        ]
          .filter(Boolean)
          .join(' · '),
        ...(badge ? { badge } : {}),
        ...(details.length > 0 ? { description: details.join('\n') } : {}),
      };
    }),
  });
  return { ttl_seconds: 600, components };
}
