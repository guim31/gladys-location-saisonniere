# Holiday rental (iCal)

The guest check-ins and check-outs of a holiday rental, read from the iCal export calendars the platforms give
every listing (Airbnb, Booking.com, Vrbo, Abritel, Gîtes de France, Smoobu and other channel managers): no account,
no partner API. Preheat before the guests arrive, turn the heating off when they leave, warn the cleaning team on a
turnover day.

Developed without a real host account: feedback welcome. The formats were checked on real, published exports.

## What you get

- One device per property (three at most), with:
  - **Occupied** (yes / no): a stay is under way, from its check-in time to its check-out time;
  - **Check-in soon** (yes / no): the next check-in is within the lead time of the options (3 hours by default);
  - **Turnover today** (yes / no): guests leave and others arrive on the same day;
  - **Next check-in** and **Next check-out**: day, time and platform, e.g. "Fri 13 Nov, 16:00 · Booking.com";
  - **Hours before check-in** (rounded up) and **Days before check-in**;
  - **Nights left** in the ongoing stay.
- Three scene triggers: guest check-in, guest check-out, check-in soon.
- A scene action that reads the ongoing or next stay, for a message.
- A dashboard widget: occupied or vacant now, then the coming stays.

## Configuration

For each property, in **Integrations → Holiday rental (iCal) → Configuration**:

- **Name**: the name of the device in Gladys (you can rename the device afterwards).
- **iCal address**: the export address (.ics) of the property calendar on one platform. **Other iCal address**:
  the same property on a second platform. Several addresses may also be pasted in one field, separated by a space.
  The stays of all the addresses are merged and the duplicates removed.
- **Check-in time** and **Check-out time** (16:00 and 11:00 by default): the platforms export days, not times.
  When a feed does give a time (some channel managers), that time is used.

Where to find the address:

- **Airbnb**: Calendar → the listing → Availability → Connect calendars → Export calendar.
- **Booking.com** (extranet): Rates & availability → Sync calendars → Export calendar. Booking.com writes every
  booked or closed date as "CLOSED - Not available": choose to export the booked dates only when the extranet
  offers it.
- **Vrbo / Abritel**: Calendar → Import and export → Export calendar.
- **Gîtes de France, Clévacances, Smoobu, Lodgify, Beds24…**: the "iCal export" or "calendar sync" page of the
  listing.

Options:

- **Lead time before check-in** (hours, 0 to 72): when "Check-in soon" turns on and its trigger fires. 0 turns it
  off.
- **"Not available" dates**: Booking.com and Smoobu export every booking as "Not available", exactly like a date you
  closed yourself. By default they count as stays (otherwise a Booking.com host would see no booking at all); choose
  "Ignore them" if all your bookings come from feeds that name them (Airbnb "Reserved", Vrbo "Reserved - …"). The
  blocks of Airbnb ("Airbnb (Not available)") and Vrbo ("Blocked") are always ignored: on Airbnb, they also hold the
  bookings imported from the other platforms, which their own feed brings.
- **Show guest names and codes**: off by default. When on, the first name (Vrbo) and the reservation code (Airbnb)
  some feeds carry appear in the widget and in the `guest` variable of the scenes.
- **Calendar refresh**: every 15, 30 (default) or 60 minutes, or every 3 hours. The platforms update their exports
  themselves every few hours at best: a faster pace does not see a booking sooner on their side.
- **Language of the names**: names of the features and texts of the states, set when the device is created.

Then open the **Discovery** tab and add each property to Gladys.

## Actions

**Check the calendars now** downloads every calendar again and sums up, per property, the number of coming stays and
the next check-in, or the calendars that could not be read.

## Scenes

Triggers (in the "Holiday rental (iCal)" category of the scene editor), each filterable by property:

- **Guest check-in**: the check-in time of a stay has come.
- **Guest check-out**: the check-out time has come: heating off, cleaning. Use a "Wait" action of the scene for the
  cleaning a few hours later.
- **Check-in soon**: the lead time before a check-in has come: preheat.

Variables of the three: property, platform, nights, check-in, check-out, same-day turnover (yes / no) and guest
(empty unless the option is on).

The device states also serve as conditions: "Hours before check-in" at 24 or less to set the code of a connected lock
the day before, "Occupied" at no to keep the heating in frost protection, "Turnover today" at yes to notify the
cleaning team in the morning. When no stay is known, "Hours before check-in" reads 9999 and "Days before check-in"
999, so that a threshold never fires on them.

Action: **Get the next stay** returns, for one property, the ongoing stay or else the next one: found (yes / no),
property, occupied now, check-in, check-out, nights, days before check-in, platform.

## Dashboard

Add the **Rental stays** widget: a status line per property (occupied until…, or vacant and the next check-in), then
up to eight coming stays with their dates, number of nights and platform; the ongoing stay and the arrivals of the day
are marked. Settings: one property (all if empty), and whether to show the occupied / vacant lines.

## Troubleshooting

- **The configuration screen says "Calendar unreachable"**: the address was mistyped, or the platform renewed it. Copy it
  again from the platform. "Check the calendars now" tells which property fails. The stays already read are kept meanwhile.
- **A stay is missing**: is it in the export of the platform? Some platforms only export the coming 12 months, and a
  Booking.com booking needs "Not available" dates counted as stays.
- **A date you blocked appears as a stay**: it reached a "Not available" feed (Booking.com imports the Airbnb
  blocks). Export the booked dates only on Booking.com, or choose "Ignore them".
- **The times are off by one hour or more**: the hours are read in the time zone of Gladys (Settings → System). The
  property and Gladys must be in the same time zone.

## Limits

- Three properties at most, two address fields each (several addresses may share a field).
- The platforms refresh their exports on their own schedule, often every few hours: a booking made a minute ago may
  appear later.
- Early check-ins and late check-outs agreed with the guests are not in the exports: the configured hours apply.
- No stay is added to the Gladys calendar: the ICS calendars integration can show the same feeds there.

## Privacy and security

The iCal addresses are secrets (whoever has them reads your calendar): they are stored by Gladys, used only to
download the calendars, and never written to the logs (only the host name is). Nothing is stored on disk.
Guest names and reservation codes stay hidden unless you turn the option on. Not affiliated with Airbnb, Booking.com,
Vrbo, Abritel or any platform named here.
