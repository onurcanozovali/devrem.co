# Devrem

Product positioning: “Askere hazırlanmanın tek uygulaması.”

Devrem is a production-oriented mobile application for people preparing for compulsory military service in Türkiye. It should feel like a modern consumer utility and social app.

It is not a military simulation, military game, government application, or camouflage-heavy military-themed novelty app.

## Current Stack

Use the repository as the source of truth for exact versions.

The current architecture includes:

- Expo
- React Native
- TypeScript
- Expo Router
- React Native Firebase
- Firebase Authentication
- Cloud Firestore
- EAS development builds

## Architecture Rules

Preserve the existing architecture.

- Use strict TypeScript.
- Keep Expo Router route files thin.
- Put feature code under `src/features`.
- Keep Firebase implementation behind `src/services/firebase`.
- Do not put arbitrary Firebase implementation logic in UI components.
- Reuse existing providers, hooks, and services before creating alternatives.
- Reuse the existing theme and design tokens.
- Avoid duplicated constants and business logic.
- Do not perform broad refactors unless explicitly required.

Before implementing a task, inspect the current implementation and extend the existing architecture. Do not create parallel competing systems.

## Firebase Rules

Preserve the existing phone authentication, profile architecture, preparation checklist architecture, and Firestore ownership and security boundaries.

Never:

- Commit `.env.local`.
- Commit private credentials or service-account keys.
- Store OTP codes.
- Manually store Firebase authentication tokens.

Firestore Security Rules are authoritative.

When changing Firestore schema, explicitly consider:

- Schema impact
- Rules impact
- Migration and backward compatibility
- Index requirements

## Mobile Design Direction

Devrem should feel modern, fast, trustworthy, clean, native, consumer-oriented, and polished.

Avoid:

- Camouflage-heavy design and military clichés
- Excessive gradients or glassmorphism
- Enterprise or admin-dashboard appearance
- Excessive borders and cards
- Repetitive edit and delete icons
- Excessive modals or unnecessary bottom sheets
- Web-like interactions forced into mobile

Prefer clear hierarchy, generous touch targets, whitespace, contextual actions, progressive disclosure, immediate feedback, subtle motion, and simple screens.

Do not redesign an established screen unless explicitly requested.

## Interaction Quality

Responsiveness is a product requirement.

Network-backed interactions should generally:

- Provide immediate visual feedback.
- Use safe optimistic UI when appropriate.
- Persist asynchronously.
- Avoid race conditions and duplicate writes.
- Roll back cleanly on confirmed failure.

Typical UI animation timing is 150–250ms. Avoid animation that slows task completion.

## Performance

On highly interactive screens, inspect real bottlenecks such as provider rerenders, list rerenders, unstable callbacks, full-list state replacements, unnecessary network waits, and expensive derived state.

Do not add memoization everywhere without evidence.

## Accessibility

Maintain touch target sizes, accessibility labels, roles and states, screen-reader alternatives, safe-area handling, and keyboard behavior.

Long press and swipe must not be the only ways to access important actions.

## Dependencies

Avoid new dependencies unless they provide meaningful value. Especially avoid unnecessary native dependencies.

Before adding a native dependency:

- Explain why it is required.
- Confirm Expo compatibility.
- State whether a new EAS development build is required.

Do not claim that JavaScript- or TypeScript-only changes require a new build.

## Product Development Process

Devrem is developed incrementally in phases. Do not implement future phases automatically.

For each task:

1. Inspect existing code.
2. Understand the current architecture.
3. Implement only the requested scope.
4. Preserve working behavior.
5. Run relevant regression checks.
6. Explain important architectural decisions.
7. Stop at the phase boundary.

## Current Product Areas

Existing or planned areas include phone authentication, onboarding, preparation, home, matching and devre discovery, chat, and profile.

Do not implement future areas merely because they are mentioned here.

## Devre Identity

Devre = same military period + same military city + same military unit + same military type. Residence and departure city are secondary relevance signals only after exact devre membership is established.

Use canonical internal values and stable city/unit identifiers where available. Until every profile has a canonical `militaryUnitId`, normalized non-empty unit text may be used only as the documented temporary fallback; it never relaxes the other identity conditions.

## Preparation Feature

Preparation is not just a shopping list. It includes official processes, documents, travel preparation, money and communication preparation, personal tasks before leaving, and bag and material preparation.

The user owns their checklist. Do not silently restore a deliberately deleted item unless explicitly triggered by the product's restore behavior.

## Code Quality

Before finishing work, when relevant run:

- `pnpm typecheck`
- `pnpm lint`
- Relevant feature tests, such as `pnpm test:preparation`
- Expo dependency checks, such as `pnpm dlx expo-doctor`

Do not hide failing tests.

## Git Workflow

- Do not automatically merge pull requests.
- Do not commit directly to `main` for feature work.
- Keep commits scoped.
- Before committing, inspect the diff and ensure no credentials or local-only files are included.

## Completion Report

At the end of coding tasks, report:

- What changed
- Major implementation decisions
- Files and features affected
- Tests and checks run
- Known limitations
- Whether Firebase Console action is needed
- Whether Firestore Rules deployment is needed
- Whether a new EAS build is required

Do not overwhelm the report with trivial implementation details.
