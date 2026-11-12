// -----------------------------------------------------------------------------
// Texts produced by the container, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js).
// A `device` integration does not receive the user's language: the
// `language` setting chooses the names and the texts of the states.
// -----------------------------------------------------------------------------

export const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** Feature names: frozen once the device is created in Gladys. */
export const NAMES = {
  en: {
    occupied: 'Occupied',
    arrival_soon: 'Check-in soon',
    turnover_today: 'Turnover today',
    next_check_in: 'Next check-in',
    next_check_out: 'Next check-out',
    hours_to_check_in: 'Hours before check-in',
    days_to_check_in: 'Days before check-in',
    nights_left: 'Nights left',
  },
  fr: {
    occupied: 'Occupé',
    arrival_soon: 'Arrivée imminente',
    turnover_today: 'À préparer aujourd’hui',
    next_check_in: 'Prochaine arrivée',
    next_check_out: 'Prochain départ',
    hours_to_check_in: 'Heures avant l’arrivée',
    days_to_check_in: 'Jours avant l’arrivée',
    nights_left: 'Nuits restantes',
  },
  de: {
    occupied: 'Belegt',
    arrival_soon: 'Anreise bald',
    turnover_today: 'Wechsel heute',
    next_check_in: 'Nächste Anreise',
    next_check_out: 'Nächste Abreise',
    hours_to_check_in: 'Stunden bis zur Anreise',
    days_to_check_in: 'Tage bis zur Anreise',
    nights_left: 'Verbleibende Nächte',
  },
  es: {
    occupied: 'Ocupado',
    arrival_soon: 'Llegada próxima',
    turnover_today: 'Cambio de huéspedes hoy',
    next_check_in: 'Próxima llegada',
    next_check_out: 'Próxima salida',
    hours_to_check_in: 'Horas antes de la llegada',
    days_to_check_in: 'Días antes de la llegada',
    nights_left: 'Noches restantes',
  },
};

/** Short texts of the states, widgets and scene outputs. */
export const TEXT = {
  en: {
    property: 'Property',
    noBooking: 'No booking',
    current: 'Ongoing',
    today: 'Today',
    turnover: 'Turnover',
    vacant: 'Vacant',
    occupiedUntil: 'Occupied',
    nextArrival: 'Next check-in',
    empty: 'No upcoming stay',
    unreachable: 'Calendar unreachable',
  },
  fr: {
    property: 'Logement',
    noBooking: 'Aucune réservation',
    current: 'En cours',
    today: 'Aujourd’hui',
    turnover: 'Rotation',
    vacant: 'Libre',
    occupiedUntil: 'Occupé',
    nextArrival: 'Prochaine arrivée',
    empty: 'Aucun séjour à venir',
    unreachable: 'Calendrier injoignable',
  },
  de: {
    property: 'Unterkunft',
    noBooking: 'Keine Buchung',
    current: 'Laufend',
    today: 'Heute',
    turnover: 'Wechsel',
    vacant: 'Frei',
    occupiedUntil: 'Belegt',
    nextArrival: 'Nächste Anreise',
    empty: 'Kein Aufenthalt geplant',
    unreachable: 'Kalender unerreichbar',
  },
  es: {
    property: 'Alojamiento',
    noBooking: 'Sin reservas',
    current: 'En curso',
    today: 'Hoy',
    turnover: 'Cambio',
    vacant: 'Libre',
    occupiedUntil: 'Ocupado',
    nextArrival: 'Próxima llegada',
    empty: 'Ninguna estancia próxima',
    unreachable: 'Calendario inaccesible',
  },
};

/** Texts with a value: functions, one per language. */
export const FORMATS = {
  en: {
    nights: (count) => (count === 1 ? '1 night' : `${count} nights`),
    guest: (name) => `Guest: ${name}`,
    code: (code) => `Reservation code: ${code}`,
  },
  fr: {
    nights: (count) => (count === 1 ? '1 nuit' : `${count} nuits`),
    guest: (name) => `Voyageur : ${name}`,
    code: (code) => `Code de réservation : ${code}`,
  },
  de: {
    nights: (count) => (count === 1 ? '1 Nacht' : `${count} Nächte`),
    guest: (name) => `Gast: ${name}`,
    code: (code) => `Buchungscode: ${code}`,
  },
  es: {
    nights: (count) => (count === 1 ? '1 noche' : `${count} noches`),
    guest: (name) => `Huésped: ${name}`,
    code: (code) => `Código de reserva: ${code}`,
  },
};

/** Messages of the configuration screen and of the action. */
export const MESSAGES = {
  noProperty: {
    en: 'Add a property and the iCal export address of its calendar.',
    fr: 'Ajoutez un logement et l’adresse d’export iCal de son calendrier.',
    de: 'Füge eine Unterkunft und die iCal-Exportadresse ihres Kalenders hinzu.',
    es: 'Añada un alojamiento y la dirección de exportación iCal de su calendario.',
  },
  unreachable: {
    en: (names) => `Calendar unreachable for: ${names}. Check the iCal address.`,
    fr: (names) => `Calendrier injoignable pour : ${names}. Vérifiez l’adresse iCal.`,
    de: (names) => `Kalender nicht erreichbar für: ${names}. Prüfe die iCal-Adresse.`,
    es: (names) => `Calendario inaccesible para: ${names}. Compruebe la dirección iCal.`,
  },
  report: {
    en: (name, stays, next) => `${name}: ${stays} upcoming stay(s), next check-in ${next}.`,
    fr: (name, stays, next) => `${name} : ${stays} séjour(s) à venir, prochaine arrivée ${next}.`,
    de: (name, stays, next) =>
      `${name}: ${stays} kommende(r) Aufenthalt(e), nächste Anreise ${next}.`,
    es: (name, stays, next) => `${name}: ${stays} estancia(s) próxima(s), próxima llegada ${next}.`,
  },
  reportError: {
    en: (name, count) => `${name}: ${count} calendar(s) unreachable.`,
    fr: (name, count) => `${name} : ${count} calendrier(s) injoignable(s).`,
    de: (name, count) => `${name}: ${count} Kalender nicht erreichbar.`,
    es: (name, count) => `${name}: ${count} calendario(s) inaccesible(s).`,
  },
};

export function pick(table, language) {
  return table[language] ?? table.en;
}

/** One value per language: `{ en, fr, de, es }`. */
export function allLanguages(render) {
  return Object.fromEntries(Object.keys(LOCALES).map((language) => [language, render(language)]));
}

/** Default name of a property without one: "Property 2". */
export function defaultPropertyName(slot, language) {
  return `${pick(TEXT, language).property} ${slot}`;
}

/** "Fri 14 Nov, 16:00", in the local time zone. */
export function formatDateTime(timestamp, language) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

/** "Fri 14 Nov". */
export function formatDate(timestamp, language) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp));
}

/** Text of a check-in or check-out: "Fri 14 Nov, 16:00 · Airbnb". */
export function stayPoint(timestamp, platform, language) {
  return `${formatDateTime(timestamp, language)} · ${platform}`;
}
