# Landing page

The default URL and `#/home` render `src/features/LandingPage.tsx`. `#/login`
and `#/rooms` retain their existing behavior. The landing page remains visible
while the session loads, and signed-in visitors get a booking-history action.

The page inherits KKU burgundy (#a4233b), glass ink (#222735), muted text
(#596173), lavender (#e1ddec), blue (#d8e8ed), and light ground (#f5f3f7).
Thai typography uses the existing Sarabun / Noto Sans Thai stack. Desktop hero
type scales from 40–62px, with 39px at phone widths; headings use weight 600.
Panel radius is 24px, inside-photo radius 17px, and small controls 11–14px.
Translucent floating chrome uses a 16px blur when supported, with solid
fallbacks and a reduced-transparency override.

The meeting image is an existing illustration and is labeled accordingly.
The interactive 1–4 hour selector is an example, not live room availability.
Booking facts match core validation: 30 minutes to 4 hours per booking,
up to 15 days ahead, with opening hours and conflicts checked per room.

Motion consists of a single 850ms card arrival and a subtle 7px, 6s floating
notice. Content stays visible; reduced-motion disables animation and
transitions. The guide link respects reduced-motion when scrolling.

Layouts switch to one column below 800px, with compact phone spacing below
480px. Navigation, duration buttons, and action links retain keyboard focus.
Local verification covers desktop/phone renders, guide scrolling, duration
selection, and the room-search link. No publishing or account changes.
