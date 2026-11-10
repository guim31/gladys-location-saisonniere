# Holiday rental (iCal) for Gladys Assistant

The guest check-ins and check-outs of a holiday rental in [Gladys Assistant](https://gladysassistant.com), read
from the **iCal export calendars** every platform gives its listings: Airbnb, Booking.com, Vrbo / Abritel, Gîtes de
France, Clévacances, Smoobu, Lodgify, Beds24… No account, no partner API. Preheat before the guests arrive, turn the
heating off when they leave, set a lock code the day before, warn the cleaning team on a turnover day.

This is an **external integration** of type `device` (Gladys 5.1.0 or later): it runs in its own sandboxed container
and publishes one device per property. It plays the part of the
[Rental Control](https://github.com/tykeal/homeassistant-rental-control) custom integration of Home Assistant.

> **Developed without a real host account: feedback welcome** on the Gladys forum or in the issues. The formats were
> checked on real exports published on GitHub (Airbnb, Booking.com, Vrbo, Smoobu), anonymized in
> [`test/fixtures/feeds`](test/fixtures/feeds).

## Features

- **Up to three properties**, each with one or more iCal addresses (one per platform): the stays are merged, the
  copies a platform imports from the others removed.
- **One device per property**: occupied (yes / no), check-in soon (yes / no, lead time configurable), turnover today
  (yes / no), next check-in and next check-out (day, time, platform), hours and days before check-in, nights left.
- **Check-in and check-out hours** per property (16:00 / 11:00 by default); the times a channel manager exports are
  kept. Read in the time zone of Gladys, summer time included.
- **Bookings, not blocks**: Airbnb "Not available" and Vrbo "Blocked" dates are ignored; Booking.com and Smoobu,
  which export every booking as "Not available", are counted as stays (an option turns that off). Cancelled events
  and the "Check-in" / "Check-out" markers of some channel managers are dropped.
- **Scene triggers**: guest check-in, guest check-out, check-in soon (N hours before: preheat), with the property,
  platform, nights, dates and same-day turnover as variables.
- **Scene action** "Get the next stay", for a message.
- **Dashboard widget** "Rental stays": occupied or vacant now, then the coming stays.
- **Privacy**: guest first names and reservation codes are hidden unless the user turns them on; the iCal addresses
  never reach the logs.
- Texts and documentation in English, French, German and Spanish.

## Requirements

- Gladys Assistant **5.1.0** or later, with Internet access.
- The iCal export address of each property on each platform.

## Installation

In Gladys: **Integrations → Install from GitHub**, address `https://github.com/guim31/gladys-location-saisonniere`.
Fill the properties in the **Configuration** tab, then add the devices from the **Discovery** tab. The complete
guide, with where to find the iCal address on each platform, is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)).

## How it works

Every 30 minutes by default, each address is downloaded with a conditional request (`ETag`, `Last-Modified`) and read
by a small iCalendar reader (dates, UTC, `TZID` and floating times; no library). Each event is classified from its
summary: a booking ("Reserved", "Reserved - Name", "Reservation …"), a block ("Airbnb (Not available)", "Blocked",
"Closed period") or an ambiguous "Not available" (Booking.com, Smoobu). Overlapping events from several feeds are one
stay, a named booking winning over the "Not available" copies of it. A one-minute clock in the container then
publishes the states that changed (and every 6 hours the unchanged ones), and fires the scene triggers whose moment
just passed. The devices are published with `should_poll: false`: Gladys has nothing to poll.

## Limits

- Three properties, two address fields each (several addresses may share a field).
- The platforms refresh their exports on their own schedule, often every few hours.
- Early check-ins and late check-outs agreed with the guests are not in the exports.
- A date blocked on Airbnb and imported by Booking.com comes back from Booking.com as "Not available", counted as a
  stay unless the "Not available" option is set to ignore: export the booked dates only on Booking.com when possible.
- No stay is written to the Gladys calendar (the [ICS calendars](https://github.com/guim31/gladys-ics-calendar)
  integration can show the same feeds there).

## Development

```bash
npm install
npm test            # node --test, against the fake Gladys of the SDK, no network
npm run lint
npm run format:check
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [`CLAUDE.md`](CLAUDE.md) for the architecture and the pitfalls of the Gladys core.

## Credits

- The classification of the platform exports follows what
  [Rental Control](https://github.com/tykeal/homeassistant-rental-control) (Apache-2.0, Andrew Grimberg and
  contributors) documents: Booking.com's "CLOSED - Not available" for every event, Smoobu's "Check-in" markers.
- The fixtures are real exports published on GitHub, anonymized (identifiers, codes, names and phone digits
  replaced).
- The feed download and the address masking come from [gladys-ics-calendar](https://github.com/guim31/gladys-ics-calendar).

Not affiliated with Airbnb, Booking.com, Vrbo, Abritel, Gîtes de France or any platform named here.

## License

[Apache-2.0](LICENSE).
