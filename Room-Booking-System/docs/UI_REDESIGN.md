# CP SPACE UI redesign verification

Updated 2026-10-24; build and test results were collected during the implementation pass. This record covers the university room-booking redesign and its design-system documentation.

## Scope and source authority

The redesign uses a solid CP blue workspace, Thai-first typography, searchable room cards, date/time and equipment fields, an explicit booking review state, booking status/history, and consistent staff screens. Public entry uses the same identity with a more spacious presentation. Backend, API, authentication, and schema changes were outside the redesign scope; no new dependency or production mock data was intended.

Current design authority: `apps/web/DESIGN.md` and `apps/web/.impeccable/design.json`. The earlier `apps/web/src/reference/DESIGN.md` and accompanying sidecar are marked historical. No PRODUCT.md was created: this was a source-based documentation pass, not a product-definition exercise.

Documentation evidence inspected directly:

- `apps/web/src/main.tsx`: shared stylesheet import order; glass stylesheet is no longer imported here.
- `apps/web/src/reference/design-system.css`: color/radius primitives, form/control styles, navigation, dialog depth, typography, responsive overrides, and focus treatment.
- `apps/web/src/reference/screens/search.css`: search layout, cards, filter controls, and responsive breakpoints.
- `apps/web/src/reference/components/ui.tsx`: button variants, status labels, native dialog behavior, and empty state.
- `apps/web/src/reference/reference.css` and `desktop.css`: inherited typography, layout, and reduced-motion behavior.
- `apps/web/src/reference/screens/BookingScreen.tsx`, `SearchScreen.tsx`, `HistoryScreen.tsx`, `AdminScreen.tsx`, and related screen source: sampled form labels, review states, filters, and semantic attributes.
- `apps/web/src/features/landing.css` and `apps/web/src/reference/screens/login.css`: public typography, CP identity, solid-surface overrides, and responsive compositions.

## Completed verification

The following commands completed during implementation:

| Check | Result |
| --- | --- |
| `node --import tsx --test tests/*.test.ts` | 58 tests passed, including `booking-ui.test.ts` |
| `npm run build` | Frontend and backend builds passed |
| Formatting | Prettier checks passed for the changed TS/TSX files; `git diff --check` passed |
| Lint | No lint script is configured |
| Bundle output | Vite emitted a non-fatal chunk-size warning above 500 kB |

The documenter wrote the design records but its final handoff was interrupted. The primary agent completed the documentation check: both sidecars parse as JSON, the design guide matches the shared source tokens, and the historical guide points to the current authority. No visual approval is implied.

## Verification limits

There is no current rendered visual pass. The prior localhost server was unavailable; starting the development server was denied with `listen EPERM`; the browser rejected local file preview under its protocol security rules. The detector could not run because its engine was missing and cache permissions blocked setup. The reviewer disposition was **recapture**, because current screenshots at all four requested widths were absent. Stale preview screenshots are not evidence for the redesigned source.

Source-level labels, focus rules, native dialogs, reduced-motion treatment, and responsive CSS do not establish full accessibility or end-to-end correctness. Small inherited controls and metadata, and residual legacy CSS, remain outside the shared design rules rather than becoming new standards.

## Static palette check

Calculated WCAG contrast from the authored tokens (not from rendered pages): primary blue on white 4.85:1; deep blue on soft blue 6.54:1; ink on white 15.72:1; muted text on the page surface 5.13:1; success on white 7.13:1; warning on white 7.09:1; danger on its pale fill 5.92:1. These pairs meet 4.5:1 for normal text. Inherited colors and full-page states still require rendered testing.

## Required live QA before visual sign-off

- Capture the current build at 375px, 768px, 1024px, and 1440px: public landing, login, room search, room detail/booking form, review, confirmation, history, staff approval, and management.
- Check Thai wrapping, long room names, date/time fields, equipment quantities, scrolling, fixed navigation, safe-area spacing, and absence of unintended horizontal page overflow.
- Verify keyboard-only operation, skip link, visible focus, native dialog initial focus and return focus, Escape/busy handling, form labels, feedback announcements, zoom, reduced motion, contrast, and target sizes.
- Exercise loading, empty, validation, unavailable/conflicting time, holiday, full-capacity, equipment shortage, submission failure/retry, pending approval, rejection, cancellation, and completed states using authorized test data.
- Verify student and staff access boundaries and complete the existing authenticated booking/approval flow against the real API in an appropriate test environment.
- Re-run the visual reviewer after capturing current screenshots. Do not describe this redesign as visually or accessibility approved until that evidence exists.
