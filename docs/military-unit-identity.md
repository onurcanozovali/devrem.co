# Military Unit Identity

## Domain rule

A devre relationship requires all of the following:

- the same `militaryPeriodYear`
- the same `militaryPeriodMonth`
- the same canonical military unit

`militaryCity`, `residenceCity`, and `departureCity` never establish devre membership. Residence and departure may rank or segment users only after exact devre membership has been established.

## Temporary fallback

The current private profile still captures the unit as free text in `militaryUnit`. New public projections expose this value as `militaryUnitName` and reserve nullable `militaryUnitId` for the controlled model. Legacy public documents containing `militaryUnit` remain readable during migration.

Until a controlled catalog exists, exact matching uses normalized free text only when both profiles have no `militaryUnitId` and both have a non-empty unit name. Normalization trims, collapses whitespace, and applies Turkish locale lowercase. This is a pre-production compatibility fallback, not a durable identity system. If either unit is unknown, the profiles are not exact devre matches. If an ID exists on only one profile, the profiles are not matched by name.

The period-only candidate query is capped, so it can miss a matching free-text unit in a large period cohort. Production-grade completeness requires server-side querying by canonical `militaryUnitId`.

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

- "Yeni bir devren geldi": same period and same canonical unit
- "Seninle aynı şehirden bir devren katıldı": exact devre plus same `residenceCity`
- "Seninle aynı yerden yola çıkacak bir devren katıldı": exact devre plus same `departureCity`

Same military city, residence city, or departure city without the same period and canonical unit must never produce a devre notification.