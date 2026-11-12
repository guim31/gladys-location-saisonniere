# Fixture feeds

Real export calendars, published on GitHub by their owners, then anonymized: event UIDs, Airbnb reservation codes,
phone digits, Vrbo first names, Smoobu ids and property name replaced. Dates and structure untouched.

| File                 | Platform    | Source                                |
| -------------------- | ----------- | ------------------------------------- |
| `airbnb-export.ics`  | Airbnb      | `giuliapiva/reservation-sync`, `ics/` |
| `booking-export.ics` | Booking.com | `giuliapiva/reservation-sync`, `ics/` |
| `vrbo-export.ics`    | Vrbo        | `sesgarites/web`, `verbo.ics`         |
| `smoobu-export.ics`  | Smoobu      | `dabbech/cms`, `.ical-cache/`         |

Written for the tests, in the format of the exports above:

- `duo-airbnb.ics` and `duo-booking.ics`: one property listed on Airbnb and Booking.com, each platform importing
  the other (a turnover on Friday 13 November 2026, a stay across the change to summer time).
- `channel-manager-times.ics`: a channel manager exporting times (`TZID`, UTC, midnight), a cancelled stay, a
  "Check-in" marker and a "Closed period".
