---
name: "CP SPACE — Clear Booking Workspace"
description: "Thai university room booking with CP blue actions, solid surfaces, and readable operational layouts."
colors:
  cp-blue: "#0776bc"
  cp-blue-dark: "#055a91"
  cp-blue-soft: "#eaf4fb"
  surface: "#fff"
  surface-muted: "#f6f8fa"
  ink: "#182431"
  text-secondary: "#3f4e5d"
  text-muted: "#5d6b79"
  border: "#dce2e8"
  field-border: "#bcc7d1"
  success: "#166534"
  warning: "#92400e"
  danger: "#b42332"
typography:
  display:
    fontFamily: "Sarabun, Noto Sans Thai, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(40px, 4.5vw, 62px)"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.035em"
  headline:
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.45
  title:
    fontSize: "20px"
    fontWeight: 600
  body:
    fontFamily: "Sarabun, Noto Sans Thai, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  supporting:
    fontSize: "14px"
    lineHeight: 1.8
  label:
    fontSize: "14px"
    fontWeight: 600
  status:
    fontSize: "12px"
    fontWeight: 600
rounded:
  control: "8px"
  panel: "12px"
spacing:
  compact: "8px"
  small: "12px"
  standard: "16px"
  panel: "20px"
  section: "24px"
  desktop: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cp-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.cp-blue-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  navigation-active:
    backgroundColor: "{colors.cp-blue-soft}"
    textColor: "{colors.cp-blue-dark}"
    rounded: "{rounded.control}"
---

# Design System: CP SPACE — Clear Booking Workspace

## Overview

**Creative North Star: "Clear Booking Workspace"**

A calm, practical university workspace uses CP blue to make actions and selections easy to find. Solid white panels, cool neutral backgrounds, fine borders, and Thai-first typography support repeated booking and staff tasks without decorative chrome competing with the content.

The application favors compact operational layouts; the public landing page uses larger headings, room photography, and more generous spacing. Both share CP identity and restrained surfaces. This document records the implemented source, not a claim of completed visual or accessibility verification. `src/reference/design-system.css` is the shared material authority, imported after the base and desktop styles by `src/main.tsx`; `src/reference/screens/search.css`, shared UI components, and landing/login styles supply surface-specific details. The older `src/reference/DESIGN.md` is historical.

**Key Characteristics:**

- CP blue actions and selection, with neutral operational surfaces.
- Sarabun-first Thai typography with clear headings and supporting text.
- Bordered panels, compact records, and readable form controls.
- Responsive sidebar, mobile navigation, and stacked booking forms.

## Colors

### Primary

CP blue identifies the primary action and focus. Deep CP blue provides hover and selected text; the soft blue surface marks active navigation and approval guidance. The frontmatter is the normative palette.

### Neutral

White surfaces sit on a cool, muted page background. Ink is the main reading color; secondary and muted text distinguish supporting detail. Fine borders separate panels; the stronger field border makes inputs identifiable.

Success green, warning amber, and danger red retain their semantic roles. Status badges additionally preserve their existing Tailwind semantic fills and text pairs; their labels state the meaning. The public landing retains its local ink (`#222735`) and muted (`#596173`) values; these are a surface-specific variation, not replacements for workspace text tokens.

**The Action Accent Rule.** Use CP blue for primary actions, focus, and selection; preserve semantic status colors for their existing meanings.

## Typography

**Display Font / Body Font:** Sarabun, with Noto Sans Thai and platform sans-serif fallbacks. The display role belongs to the public landing; ordinary workspace text inherits the body stack.

### Hierarchy

- **Display:** the responsive public hero uses the display token. Its narrow layout overrides the scale, including a 39px heading at 480px and below.
- **Headline:** search uses the headline token, reducing to 24px below 768px. Operational list titles use 26px, also reducing to 24px on mobile.
- **Title:** page headers and form section headings use the title token; room-card and dialog headings commonly use 18px at weight 600.
- **Body:** the application base uses the body token. Forms and operational copy commonly use 14px; supporting paragraphs have generous line height for Thai reading.
- **Label / Status:** action labels use the label token; compact status text uses the status token. Small metadata commonly uses 12–13px. Mobile form controls use 16px text.

**The Thai First Rule.** Keep Sarabun first in the shared font stack and preserve readable Thai labels as layouts narrow.

## Layout

The workspace fills the viewport height without an outer decorative frame. At 1024px and wider, a 224px sidebar accompanies the main content. Below that breakpoint, mobile navigation replaces the sidebar. The bottom navigation is flat, respects the safe area, and has a 64px minimum shell height with 48px minimum button heights.

Desktop search uses 32px side spacing and a three-column room grid. Below 1280px the grid has two columns and the search controls stack; below 768px it becomes one column with 16px side spacing. Date spans the full first row on mobile, with start and end time beneath. Additional filters collapse behind an explicit control. The booking form has room summary and form columns at desktop, and stacks on smaller screens. Review details change from label/value columns to stacked rows on mobile.

Operational records use compact vertical rows; tables retain horizontal scrolling within their own container. The schedule initializes in agenda mode below 768px. Public landing and login switch their main composition at 800px; the landing uses a centered 1240px outer content limit.

Shared action buttons, fields, and most operational controls have a 44px minimum target; search fields use 46px. This is the intended recurring pattern, not a claim that every inherited control meets it. Verify the shipped interface at 375px, 768px, 1024px, and 1440px before sign-off.

## Elevation & Depth

Workspace panels, search results, navigation, and login are flat, solid surfaces separated by borders and tone. Account menus, dialogs, and toasts retain purposeful elevation. Room photography may retain a dark gradient to support overlaid text; this is not a translucent workspace surface.

### Shadow Vocabulary

- **Account menu:** `0 12px 32px #172b4d1f` distinguishes the menu from navigation.
- **Dialog:** `0 18px 64px #18243140` and a `#17243180` backdrop establish modal depth.
- **Toast:** `0 6px 24px #18243126` separates transient feedback from page content.

**The Solid Surface Rule.** Use solid surfaces and fine borders for workspace panels; reserve elevation for overlays and transient feedback.

State transitions use short color changes, usually 160ms ease-out. Decorative entrance animations are disabled in the shared treatment. Reduced-motion CSS disables animation and transitions; the refresh spinner also has an explicit reduced-motion fallback.

## Shapes

Controls use the control radius and repeated panels use the panel radius. Borders are usually 1px. Status badges remain pill-shaped; the page frame and bottom navigation stay square to the viewport. Photo cropping and small segmented controls retain local corner values rather than expanding the shared radius scale.

## Components

### Buttons

Primary buttons use CP blue and white labels, deepening on hover. Secondary buttons use a white surface, neutral border, and secondary text; ghost buttons are quieter text actions. Danger and success variants keep their semantic pale fills and text colors. The shared medium button uses 10px vertical and 16px horizontal padding. Disabled buttons indicate unavailability; loading buttons set `aria-busy` and disable activation.

Shared keyboard focus is a 3px CP blue outline with 3px offset. Public landing focus uses a 5px offset. Do not remove these states when extending a component.

### Chips and Status

Status badges pair a dot and a Thai label with semantic background and text colors. Filter and view selections expose pressed or expanded state and use soft blue with deep blue text. Text must communicate the status independently of color.

### Cards / Containers

Room cards use a solid surface, fine border, panel radius, and cropped room imagery. Their bodies carry title, availability, location, capacity, equipment, and an explicit detail action. Repeated records use the same material, with separators around action areas. Padding varies with density: room bodies use 18px; records commonly use 20px and 16px on mobile; forms use 24px and 18px on mobile.

### Inputs / Fields

Inputs use solid white, the field border, control radius, and dark text. Focus uses the shared outline; invalid fields use the danger border. Disabled fields have a muted fill and unavailable cursor. Keep visible field labels and connect validation feedback with `aria-describedby` where supplied.

### Navigation

Desktop navigation is a fixed-width column with grouped actions. Active items use soft blue, deep blue text, and `aria-current`. Mobile navigation is a full-width bottom bar, with the current item identified by text color and semantic state. A focusable skip link reaches the main content.

### Dialogs and Booking Review

The shared modal uses native `dialog` with `showModal()`, an accessible title, a labelled close button, and a scrollable bounded panel. Escape closes it unless a busy operation is in progress. Its width is capped at 560px and respects viewport margins. Browser focus behavior still requires live verification.

Booking review is a page state in the form layout, with an ordered progress indicator, a summary list, approval guidance, and explicit submission. It does not use a second nested wizard dialog. Confirmation and history present the resulting status, rather than implying every submission is already approved.

## Do's and Don'ts

### Do:

- Do preserve CP blue identity and Thai labels.
- Do reuse the shared control and panel tokens for new operational surfaces.
- Do keep explicit labels, visible keyboard focus, and text accompanying status color.
- Do keep date, time, room capacity, equipment, review, and booking status readable on narrow screens.
- Do verify current rendered screens before claiming responsive or accessibility completion.

### Don't:

- Don't restore the obsolete burgundy identity or glass workspace treatment.
- Don't use color alone to explain availability, errors, or approval state.
- Don't make the public landing display scale the default for operational screens.
- Don't treat inherited one-off values or unverified layouts as new shared tokens.

Not canonized: inherited small metadata and 40px refresh/toast/view-switch controls, isolated legacy colors/radii, and residual CSS from prior treatments. These are not new global rules; resolving them requires targeted review rather than documenting every inherited value as intentional. Current screenshot and accessibility verification is pending; see `../../docs/UI_REDESIGN.md`.
