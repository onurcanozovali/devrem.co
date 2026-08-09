# Phase 4A: Devre Discovery

## Public/private profile boundary

`users/{uid}` remains the owner-only private profile and continues to contain fields such as last name, birth year, and reporting date. Discovery never queries this collection.

`publicProfiles/{uid}` is an authenticated-read projection written only by trusted Admin SDK code. It contains exactly:

- `firstName`
- `residenceCity`
- `departureCity`
- `militaryCity`
- `militaryPeriodYear`
- `militaryPeriodMonth`
- `militaryType`
- `militaryUnit`
- `photoPath`
- `updatedAt`

Client create, update, and delete access to `publicProfiles` is denied by Firestore Rules. The `syncPublicProfile` Firestore trigger transactionally rereads the latest private document, validates it, projects only the fields above, and removes the projection if the private profile is deleted or no longer valid. Rereading the latest document prevents a delayed or retried trigger event from restoring stale profile data.

Account deletion also removes the avatar and public projection explicitly before deleting private Firestore data and the Auth user. The trigger's subsequent deletion is idempotent.

## Query strategy

Discovery always derives its base group from the current profile. The query requires military period year, military period month, and destination city. Every request is bounded to 40 documents and no realtime population listener is created. The current user and any invalid projection are excluded locally.

Quick segments filter this bounded pool locally without another network request: `Tümü`, `Benim Şehrimden`, and `Benimle Yola Çıkanlar`. When residence and departure city are identical, the duplicate departure segment is omitted.

Candidates are ranked by same known normalized unit, then same departure city, then same residence city. Missing units are neutral. First name and document ID provide deterministic tie breakers. Result rows show at most two matching reasons in that same order.

The single required equality-filter shape is declared in `firestore.indexes.json`.

## Development seed data

The Admin-only seed creates exactly 12 deterministic public profiles for the current test context: unit/departure matches, departure-only matches, residence-only matches, general group members, wrong-destination and wrong-period exclusions, and the current-user exclusion. Four profiles receive generated synthetic avatars. It never runs from application startup and does not create Auth users or private profile documents.

Set Application Default Credentials for the intended development project, then define these PowerShell variables with values matching the test user's profile:

```powershell
$env:DEVREM_DISCOVERY_SEED_ENV = "development"
$env:DEVREM_DISCOVERY_PROJECT_ID = "your-development-project"
$env:DEVREM_DISCOVERY_SEED_CONFIRM = "seed:your-development-project"
$env:DEVREM_DISCOVERY_STORAGE_BUCKET = "your-development-bucket"
$env:DEVREM_DISCOVERY_CURRENT_UID = "test-user-uid"
$env:DEVREM_DISCOVERY_RESIDENCE_CITY = "34"
$env:DEVREM_DISCOVERY_DEPARTURE_CITY = "6"
$env:DEVREM_DISCOVERY_MILITARY_CITY = "43"
$env:DEVREM_DISCOVERY_PERIOD_YEAR = "2027"
$env:DEVREM_DISCOVERY_PERIOD_MONTH = "2"
$env:DEVREM_DISCOVERY_UNIT = "1. Piyade Tugayı"
pnpm --dir functions run seed:discovery
```

Rerunning the command updates the same seed IDs. It refuses deterministic-ID collisions and production-looking project IDs. The marker is Admin-only under `_developmentSeeds/discovery`. Clear the data after testing:

```powershell
pnpm --dir functions run clear:discovery-seed
```

Cleanup deletes seeded public documents and avatars, then rebuilds the current user's projection from the latest authoritative private profile. The same commands may target emulators by setting the standard Firestore and Storage emulator host variables. Never commit credentials or point this tooling at production.

## Existing-user backfill

The trusted trigger covers new profiles and all future private profile or photo-path updates. Because `residenceCity` was added to the projection, rerun the idempotent Admin SDK backfill for existing pre-production profiles after deploying the updated function:

```text
pnpm --dir functions run backfill:public-profiles
```

Run this command once from an authenticated administrative environment with Application Default Credentials and the intended Firebase project selected. Do not commit credentials. The command scans private profiles in pages of 400, synchronizes the latest version of each profile in bounded transaction groups, and removes stale projections for invalid/incomplete profiles.

The backfill is intentionally not run automatically during deploy and must not be pointed at production without reviewing the selected project first.

## Deployment

Deploy the Firestore Rules, indexes, account deletion function, and projection trigger:

```text
pnpm exec firebase deploy --only firestore:rules,firestore:indexes,functions:syncPublicProfile,functions:deleteAccount
```

No Storage Rules change is required. Existing authenticated avatar reads remain sufficient for discovery. No native dependency or Expo configuration changed, so this phase does not require a new EAS development build.