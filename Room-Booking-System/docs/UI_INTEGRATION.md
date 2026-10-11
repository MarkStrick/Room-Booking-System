# UI integration — 11 October 2026

Adapted the reference in `Ui News/booking_room_kku` into the existing React application. The reference supplies the mobile interaction patterns; the desktop composition is designed separately. The live API, role authorization, booking rules, and original data remain in use.

## Layouts

- Mobile: brand/account header, context row, daily overview, search and time controls, one-column room cards, bottom navigation, and a full-screen booking form. The menu drawer retains all role-specific administration tools.
- Desktop (above 1100px): persistent sidebar and compact workspace header; room results occupy the left pane while a sticky, independently scrollable search/time/filter rail occupies the right. Users can switch between horizontal room listings and a card grid. Booking history uses multiple columns; approvals use a table; help uses a split FAQ/conversation layout.
- Tablet: a compact intermediate layout with the existing sidebar, reflowed controls, and reduced content columns.

## Preserved identity and behavior

The primary remains `#a73b24`, alongside the existing warm background and KKU emblem. Per the updated brief, Sarabun replaces the previous text and heading fonts to match the reference. The original KKU login logo remains. Mobile and desktop share data and actions so resizing does not reset the active search or change authorization.

The follow-up refinement removes the duplicate search heading, carries the reference's overview banner and room-title overlays into mobile, and moves capacity and extra filters behind the search-row filter button. Date and time remain visible. Desktop keeps its separate two-pane composition and grid/list controls. Login uses the reference's colored identity area and white form panel, with a two-column composition on desktop and stacked panels on mobile; existing password and Google authentication remain in place.

Room covers use each room's existing `imageUrl`. Missing or failed images show a labeled placeholder rather than an unrelated photo. Status filters, quick help questions, notification counts, and inspection shortcuts use the existing application state and commands.

## Verification

- Web production build and TypeScript checks passed.
- All 23 existing domain/audit tests passed.
- Browser verification used the isolated, in-memory local API fixture; no production records were changed.
- Verified password sign-in, mobile and desktop room search and booking submission, booking history, approval, opening room inspections, FAQ responses, account navigation, and closing the mobile drawer when selecting the current route.
- Checked the main room, booking, help, approval, and room-management routes at widths 320, 390, 768, and 1366px. No page-level horizontal overflow was found. Grid/list switching was verified on desktop.
- The browser reported no warning/error logs during the final checks. Verification used an emulated Chromium viewport, not physical iOS/Android hardware.

Screenshots: `preview/ui-integration-desktop.jpg` and `preview/ui-integration-mobile.jpg`.

The primary presentation rules are in `apps/web/src/integrated-ui.css`, loaded after the incumbent styles. Shared room media is in `apps/web/src/components/RoomCover.tsx`.
