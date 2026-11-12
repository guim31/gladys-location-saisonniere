# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Up to three rental properties, each read from one or more iCal export
  calendars (Airbnb, Booking.com, Vrbo / Abritel, Gîtes de France, Smoobu and
  other channel managers), with their check-in and check-out hours. The stays
  of several platforms are merged, their copies removed.
- One device per property: occupied, check-in soon, turnover today, next
  check-in, next check-out, hours and days before check-in, nights left.
- Bookings told apart from blocked dates; an option for the "Not available"
  dates of Booking.com and Smoobu, counted as stays by default.
- Scene triggers: guest check-in, guest check-out, check-in soon (a lead time
  in hours, to preheat).
- Scene action "Get the next stay".
- Dashboard widget "Rental stays": occupied or vacant now, then the coming
  stays.
- Guest names and reservation codes hidden unless the user turns them on.
- "Check the calendars now" action in the configuration screen.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-location-saisonniere/commits/main
