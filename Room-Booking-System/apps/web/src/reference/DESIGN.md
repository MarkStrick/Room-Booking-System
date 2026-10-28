---
name: "CP SPACE — Mobile Reference"
description: "The adopted mobile visual system from Ui News/booking_room_kku."
colors:
  cp-blue: "#0776BC"
  cp-blue-dark: "#055A91"
  cp-sky: "#6CC7EF"
  white: "#ffffff"
  gray-50: "#f9fafb"
  gray-100: "#f3f4f6"
  gray-200: "#e5e7eb"
  gray-300: "#d1d5db"
  gray-400: "#9ca3af"
  gray-500: "#6b7280"
  gray-600: "#4b5563"
  gray-700: "#374151"
  gray-800: "#1f2937"
  gray-900: "#111827"
  red-50: "#fef2f2"
  red-100: "#fee2e2"
  red-200: "#fecaca"
  red-500: "#ef4444"
  red-600: "#dc2626"
  red-700: "#b91c1c"
  amber-50: "#fffbeb"
  amber-100: "#fef3c7"
  amber-500: "#f59e0b"
  amber-700: "#b45309"
  green-50: "#f0fdf4"
  green-100: "#dcfce7"
  green-200: "#bbf7d0"
  green-500: "#22c55e"
  green-700: "#15803d"
  blue-100: "#dbeafe"
  blue-500: "#3b82f6"
  blue-700: "#1d4ed8"
typography:
  display:
    fontFamily: "Sarabun, Noto Sans Thai, Inter, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 900
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Sarabun, Noto Sans Thai, Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "28px"
  body:
    fontFamily: "Sarabun, Noto Sans Thai, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  supporting:
    fontFamily: "Sarabun, Noto Sans Thai, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  label:
    fontFamily: "Sarabun, Noto Sans Thai, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  navigation:
    fontFamily: "Sarabun, Noto Sans Thai, Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "3.5": "14px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "7": "28px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.cp-blue}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.cp-blue-dark}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.cp-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  booking-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-900}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  room-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-900}"
    rounded: "{rounded.2xl}"
    width: "100%"
  brand-header:
    backgroundColor: "{colors.white}"
    height: "72px"
    padding: "0 16px"
  breadcrumb:
    backgroundColor: "rgb(249 250 251 / 0.8)"
    height: "44px"
    padding: "0 16px"
  bottom-navigation:
    backgroundColor: "{colors.white}"
    typography: "{typography.navigation}"
    height: "64px"
  amenity-chip:
    backgroundColor: "{colors.red-50}"
    textColor: "{colors.cp-blue}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  google-button:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-700}"
    rounded: "{rounded.xl}"
    padding: "14px 16px"
  login-panel:
    backgroundColor: "{colors.white}"
    padding: "28px 24px 32px"
---

> Historical reference only. The current visual system is documented in [apps/web/DESIGN.md](../../DESIGN.md), with its sidecar at `../../.impeccable/design.json`. The tokens and descriptions below record the earlier mobile reference and must not override the current system.


# Design System: CP SPACE — Mobile Reference

## Overview

This records the mobile interface adopted from `Ui News/booking_room_kku`. That source is the visual authority: preserve its composition, colors, typography, spacing, and component shapes at a 1:1 mobile priority. The default working mode is **Operate**: apply the existing system to real application behavior.

The interface uses Sarabun, a red university identity, white controls, pale gray surfaces, and compact supporting text. Search combines a workspace header, daily overview, red service banner, filters, room cards, and three bottom navigation items. This document covers the mobile reference subtree; desktop layout is maintained separately.

**Key Characteristics:**

- Source-led mobile composition and Thai-first typography.
- Red emphasis for actions and active navigation; gold accents in the service banner.
- Rounded cards, clear form labels, and scrollable screen content.
- Real room data and honest unavailable-image states.

## Colors

The frontmatter preserves the actual custom palette and reused Tailwind colors; it is the normative token list.

### Primary

- **KKU red:** primary actions, brand mark, active navigation, form icons, focus outlines, and the service banner.
- **KKU dark red:** primary-button hover and the lower end of the login gradient.
- **KKU gold:** the small sparkle accent in the service banner.

### Neutral

- **White:** headers, cards, booking fields, login panel, and bottom navigation.
- **Gray 50 / 100 / 200:** page backgrounds and search fields / subtle dividers and secondary fills / input borders and missing-photo backgrounds.
- **Gray 900 / 500 / 400:** main text / supporting text / quieter metadata, placeholder text, and inactive navigation.
- **Gray 600–800:** intermediate labels, controls, and secondary text; gray 300 supports small separators and hover borders.

### Status

Amber identifies pending requests, green approved requests, red rejected or no-show requests, blue completed or checked-in requests, and gray cancelled requests. Status badges pair tinted backgrounds with darker text and a small matching dot. Red 50 also provides the existing soft brand tint; amber 50 closes the overview gradient.

## Typography

Use the incumbent font stack throughout. The daily overview is the display role; page headers use the title role; descriptions and most form controls use body; room metadata uses supporting; form labels and medium buttons use label.

Room names and the banner headline use 16px bold type with 24px line height. The login hero uses 24px bold type with 32px line height. The workspace eyebrow is 10px bold with 0.12em tracking; “Daily overview” is 11px bold with 0.16em tracking. Amenity chips and bottom labels use 11px. The shared baseline is 16px with 1.5 line height; the large booking-submit button inherits that baseline size.

## Layout

Mobile screens fill the available viewport (`100dvh`) with a column frame. Standard screen sections use 16px horizontal padding. The main brand row, breadcrumb, and bottom navigation use the heights in the frontmatter. Detail screens use a 56px back-button header. Content scrolls between persistent header and bottom action/navigation regions.

Search uses one room-card column with 12px gaps. The overview has 20px top and 16px bottom padding; its banner has 16px horizontal and 14px vertical padding. Search controls use 12px vertical padding, an 8px control gap, and 10px separation before the date/time row. Room photos are 144px high in results. Booking uses 16px section spacing, a 128px summary photo, and two equal time fields with a 12px gap.

At widths up to 359px, search time fields use an 80px width and 4px horizontal padding; the date field uses 6px horizontal padding. This keeps the full date visible at 320px while preserving the source's single-row controls.

Login centers its hero above a full-width white panel; the panel's top corners use the 24px radius while its bottom corners remain square. The document does not prescribe desktop columns or sidebar composition. Existing 640px modal treatment and the 1024px desktop boundary are recorded in the sidecar only to identify responsive scope.

## Elevation & Depth

White surfaces, pale fills, and 1px borders provide everyday separation. The service banner and primary button carry red-tinted shadows. Room cards gain a shadow and red-tinted border on hover. The account menu and login panel use stronger shadows. Photo overlays darken the lower image edge for white room-name text; capacity chips and the login icon panel use the source's subtle blur. Exact shadows, gradients, overlays, and motion expressions live in the sidecar.

## Shapes

Cards and the service banner use the 16px radius. Standard booking fields, medium/large buttons, and the Google button use 12px. Compact search date/time fields, filters, and small buttons use 8px. Amenity and status badges are pills. Login and the mobile dialog use 24px top corners. Cards clip their images and overlays to the outer silhouette.

## Components

- **Buttons:** medium primary/secondary buttons use the frontmatter padding. Large submit buttons use 14px vertical and 20px horizontal padding, full width, and 16px text. Primary hover uses dark red; secondary hover uses soft red. Disabled buttons use 40% opacity and an unavailable cursor. Shared button press scale is 0.97; the Google button uses 0.98.
- **Fields:** booking inputs use white fill and a gray 200 border. Search fields use gray 50 and turn white on focus. Focus changes the border to KKU red. Non-field controls inherit the scoped 2px red focus outline with a 2px offset.
- **Room cards:** full-width white cards with gray 100 borders, a photo or gray placeholder, lower-edge photo overlay, 12px body padding, and small amenity pills. Existing imagery comes from each real room; a missing or failed image shows the building icon and missing-photo text.
- **Navigation:** three evenly spaced icon/label items. Active items use KKU red and a 2.5px icon stroke; inactive items use gray 400 and a 2px stroke. Icons are 22px. Booking, checklist, notification, login, and access-denied screens omit bottom navigation as in the implementation. Account tools stay in the account menu.
- **Badges and filters:** status badges use 12px semibold text, 10px horizontal / 4px vertical padding, 6px gaps, and a 6px dot. Amenity pills use 11px medium text. Capacity filters use the compact radius and red selected state.
- **Login:** preserve the red-to-dark-red hero and rounded white panel. Google is the sole sign-in control; readiness, loading, and errors appear inside that panel. The source's demo-role shortcut is intentionally absent.
- **Feedback:** errors and busy states stay close to the relevant action; success is shown only after the application saves the operation. Attachment controls explicitly show their unavailable state.

The intentional data and sign-in differences are documented in [MOBILE_UI_GOOGLE_LOGIN.md](../../../../docs/MOBILE_UI_GOOGLE_LOGIN.md); keep that document as the behavior and setup reference.

## Do's and Don'ts

### Do:

- **Do** treat the confirmed source mobile interface as the visual authority.
- **Do** preserve the existing red palette, Sarabun hierarchy, rounded shapes, and mobile spacing.
- **Do** use real room data, missing-image placeholders, and visible busy/error states.
- **Do** compare mobile changes against `preview/reference-integration-mobile.png`, `preview/mobile-booking-form.png`, and `preview/google-only-login-mobile.png` in the repository root.

### Don't:

- **Don't** introduce a new visual identity or decorative raster assets for this adopted interface.
- **Don't** restore demo-role or password sign-in controls.
- **Don't** present simulated attachments or unsaved operations as successful actions.
- **Don't** apply these mobile composition rules as a promise to redesign the separately maintained desktop interface.
