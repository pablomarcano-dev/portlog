# Operational update subject timestamps

Automatic Cargo Update and anchorage subject timestamps use `America/Caracas`, rendered as `DD.MM.YYYY HH:mm Hrs`. They round to the nearest ten minutes with midpoint upward: 06:02 becomes 06:00 and 06:05 becomes 06:10. Date, month and year rollover are handled before formatting.

The Cargo Update dialog initializes its date and time on the agency clock. Its body uses those exact values; only the automatic subject default is rounded. Once the operator edits either date or time, the subject uses the entered value exactly. The compose drawer continues to preserve manually edited subjects.

Shared helpers exported by `@portlog/schemas`:

- `getUpdateSubjectParts(instant, round = true)` returns agency calendar components, time and formatted subject stamp. Pass `false` to initialize editable fields without rounding their values.
- `formatUpdateSubjectTimestamp(instant)` returns the automatic rounded subject stamp.
- `roundUpdateSubjectWallTime(calendarDate, time)` rounds a calendar-day picker plus a 24-hour time without treating its date as a server-local instant.

Rounding is a subject-display operation. It does not change recorded SOF events, saved UTC timestamps, archived messages or manually entered times. No database migration is needed. Alongside/explicit operational update-mode controls are delivered separately.
