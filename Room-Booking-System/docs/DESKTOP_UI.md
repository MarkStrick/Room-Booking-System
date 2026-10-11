# Desktop UI adaptation

The active reference interface now uses a full-width application frame instead of a simulated phone. At 1024px and above it displays persistent, role-aware navigation. Mobile retains bottom navigation.

Desktop changes include a two-column room catalog (three columns at 1600px), labeled date/time search controls, a two-column room summary and booking form, wider booking/admin lists, usable legacy administration layouts, and a split login screen.

Validation: frontend TypeScript and production build passed. Impeccable detector returned no findings. Chromium viewport checks at 320, 390, 768, 1024, 1440, and 1920px found no horizontal page overflow. Search filters, empty results, navigation, and room selection worked. An isolated SQLite test server accepted a booking with HTTP 201 and displayed it in booking history. No live data was changed. Physical-device behavior and Google sign-in were not tested.

Screenshots are in preview/desktop-recreated-search.png, preview/desktop-recreated-booking.png, and preview/desktop-recreated-mobile.png.
