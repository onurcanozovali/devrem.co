# Military Unit Identity

## Domain rule

A devre relationship requires all of the following:

- the same `militaryPeriodYear`
- the same `militaryPeriodMonth`
- the same canonical `militaryCity` code
- the same canonical military unit
- the same canonical `militaryType` value

In short: Devre = same military period + same military city + same military unit + same military type. `residenceCity` and `departureCity` may rank or segment users only after exact devre membership has been established.

## Temporary fallback

The current private profile still captures the unit as free text in `militaryUnit`. New public projections expose this value as `militaryUnitName` and reserve nullable `militaryUnitId` for the controlled model. Legacy public documents containing `militaryUnit` remain readable during migration.

Until a controlled catalog exists, unit matching uses normalized free text only when both profiles have no `militaryUnitId` and both have a non-empty unit name. Normalization trims, collapses whitespace, and applies Turkish locale lowercase. This is a pre-production compatibility fallback, not a durable identity system. It never relaxes the period, military city, or military type requirements. If either unit is unknown, the profiles are not exact devre matches. If an ID exists on only one profile, the profiles are not matched by name.

The base query uses period, military city, and military type. When the reference has a canonical unit ID, the query also filters by `militaryUnitId`. The temporary free-text fallback query remains capped, so it can miss a matching unit in a large base cohort. Production-grade completeness requires canonical unit IDs for all participating profiles.

## Controlled catalog recommendation

Create the catalog in a separate, data-validation phase. Do not populate it from user-entered values.

Suggested document path:

`militaryUnits/{unitId}`

Suggested fields:

- `unitId`: canonical stable identifier matching the document ID
- `name`: validated display name
- `cityCode`: province code used to group available choices
- `active`: whether the unit can be selected
- `aliases`: optional reviewed search aliases, never alternative identities

The profile flow should become `militaryCity` selection, catalog query by `cityCode` and `active`, then controlled unit selection. Profiles and public projections should persist both `militaryUnitId` and the selected `militaryUnitName` snapshot. Matching and Firestore queries must use `militaryUnitId`; the name is display-only.

A migration should preserve legacy free text separately until it can be reviewed or mapped. It must not silently assign IDs from fuzzy text similarity.

## Notification predicates

Push notifications are not implemented in this correction. Future notification preparation must reuse the exact devre predicate before applying secondary context:

- "Yeni bir devren geldi": same period, same military city, same canonical unit, and same military type
- "Seninle aynı şehirden bir devren katıldı": exact devre plus same `residenceCity`
- "Seninle aynı yerden yola çıkacak bir devren katıldı": exact devre plus same `departureCity`

No period, city, unit, or military-type subset may produce a notification containing the word "devre" unless all four exact identity conditions match.