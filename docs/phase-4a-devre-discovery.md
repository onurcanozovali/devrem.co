# Phase 4A: Devre Discovery

## Public/private profile boundary

`users/{uid}` remains the owner-only private profile and continues to contain fields such as last name, birth year, residence city, and reporting date. Discovery never queries this collection.

`publicProfiles/{uid}` is an authenticated-read projection written only by trusted Admin SDK code. It contains exactly:

- `firstName`
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

Discovery queries always require military period year and month. Destination and departure city equality filters are optional. Every request is bounded to 40 documents and no realtime population listener is created. The current user is excluded and candidates are ranked locally within that bounded set:

1. same destination city
2. same known normalized unit
3. same departure city
4. deterministic first-name and document-ID tie breakers

The four supported equality-filter shapes are declared in `firestore.indexes.json`.

## Existing-user backfill

The trusted trigger covers new profiles and all future private profile or photo-path updates. Existing pre-production profiles are synchronized with the idempotent Admin SDK backfill:

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