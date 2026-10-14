---
name: "KKU Room Booking — Shared Glass UI"
description: "Thai room booking with burgundy actions and translucent, cool neutral chrome."
colors:
  kku-red: "#A4233B"
  kku-red-dark: "#8B1E32"
  glass-text: "#222735"
  glass-secondary: "#596173"
  stage: "#eef0f6"
  stage-lavender: "#e1ddec"
  stage-blue: "#d8e8ed"
  stage-light: "#f5f3f7"
  stage-cool: "#ecf0f6"
  glass-surface: "rgb(255 255 255 / 65%)"
  glass-chrome: "rgb(255 255 255 / 62%)"
  glass-edge: "rgb(255 255 255 / 85%)"
  glass-line: "rgb(58 66 87 / 12%)"
  field: "rgb(255 255 255 / 76%)"
  surface-opaque: "#fff"
  chrome-opaque: "#f7f8fb"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Sarabun, Noto Sans Thai, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  overview:
    fontSize: "clamp(22px, 3vw, 30px)"
    fontWeight: 600
    letterSpacing: "-.025em"
rounded:
  field: "12px"
  navigation-item: "14px"
  panel: "16px"
  dock-selection: "18px"
  frame: "24px"
spacing:
  compact: "12px"
  standard: "16px"
  relaxed: "24px"
  desktop-content: "36px"
components:
  button-primary:
    backgroundColor: "{colors.kku-red}"
    textColor: "{colors.surface-opaque}"
    rounded: "{rounded.field}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.kku-red-dark}"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.glass-text}"
    rounded: "{rounded.field}"
  glass-panel:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.glass-text}"
    rounded: "{rounded.panel}"
  mobile-dock:
    backgroundColor: "{colors.glass-chrome}"
    rounded: "{rounded.frame}"
---

# Design System: KKU Room Booking — Shared Glass UI

## Overview

**Creative North Star: "Quiet Glass Workspace"**

Apple-inspired translucent chrome sits over a soft lavender and blue neutral surface. Burgundy remains the action and selection accent, with Thai text and existing room-booking content preserved. This document records the shared material shipped in `src/reference/glass.css`, imported after `reference.css` and `desktop.css` by `src/main.tsx`.

This is an additive material guide. The older `src/reference/DESIGN.md` remains a record of the adopted mobile reference; where shared colors, typography, depth, and corners differ, the shipped glass stylesheet and this document describe the current treatment. Existing screen composition and behavior remain governed by their implementation. No PRODUCT.md is available; this guide makes no additional product claims.

**Key Characteristics:**

- Cool neutral surfaces with restrained burgundy emphasis.
- Translucent chrome, readable controls, and softly rounded containers.
- Responsive desktop frame and mobile dock.
- Opaque material fallback and reduced transparency support.

## Colors

The frontmatter records reused material values. Primary burgundy identifies actions, focus, and active navigation. Dark burgundy supplies primary-button hover. Neutral ink and secondary text keep labels legible over pale lavender and blue surroundings.

**The Accent Rule.** Preserve burgundy for action and selection; keep shared chrome neutral.

The supported glass values apply only when backdrop filtering is available. Otherwise surface and chrome use their opaque tokens. The stage combines lavender and blue radial gradients with a light-to-cool diagonal gradient.

## Typography

Use the system-first font stack with Sarabun and Noto Sans Thai fallbacks. Preserve existing screen text sizes and Thai labels. The overview title uses a medium weight and modest negative tracking; desktop overrides its size to 30px, or 24px at narrower desktop widths.

## Layout

Mobile occupies the viewport height. Desktop starts at 1024px, with 16px outer space and a frame height of `calc(100dvh - 32px)`. The existing sidebar and screen grids remain intact. Desktop content commonly uses 36px horizontal spacing; mobile search controls use 12px margins and 16px padding. Date controls wrap below 451px.

The mobile dock has a 64px minimum height, 8px top space, 12px side margins, and a bottom margin respecting the safe area. Form fields and dock buttons have a 44px minimum height; desktop navigation items have a 48px minimum height.

## Elevation & Depth

Shared panels use a diffuse ambient shadow and a white inset edge. The desktop frame has a broader shadow. Room-card hover increases depth and adds a subtle burgundy border; disabled cards reduce opacity.

**The Bounded Blur Rule.** Apply blur to chrome, dialogs, account options, the login control panel, and search controls; leave repeated content cards without individual backdrop blur.

Chrome uses `blur(20px) saturate(140%)`; search controls use `blur(12px)`. Unsupported filtering uses opaque surface defaults. `prefers-reduced-transparency: reduce` restores opaque surfaces and disables these filters. Existing `prefers-reduced-motion` rules disable animations and transitions.

## Shapes

Fields and standard buttons use the field radius. Navigation items use the navigation-item radius; recurring cards use the panel radius. Desktop frames, login panels, and the mobile dock use the frame radius. Dock selections use their dedicated inset radius.

## Components

- **Buttons:** preserve existing primary, secondary, ghost, danger, and success variants. Primary buttons retain white labels and burgundy hover. Shared keyboard focus uses a 3px burgundy outline with 3px offset.
- **Fields:** pale white fill, a fine neutral stroke, inset shading, and dark text. Placeholders use the secondary text token.
- **Cards:** white translucent material, fine white edges, and ambient elevation. Room imagery retains its dark lower gradient for white photo labels.
- **Desktop navigation:** neutral hover, brighter white active fill, burgundy active text, and a restrained active shadow.
- **Mobile dock:** rounded translucent shell with a pale burgundy active-item fill. Desktop hides the dock.
- **Feedback:** preserve semantic status colors and the existing dark toast treatment; the glass palette does not replace status meaning.

## Do's and Don'ts

- Do preserve Thai labels, burgundy identity, and existing booking layouts.
- Do use the shared material tokens for recurring panels and chrome.
- Do preserve visible keyboard focus, opaque fallback, and reduced transparency behavior.
- Don't add individual backdrop blur to repeated room cards.
- Don't use the glass treatment to replace semantic status colors or obscure text.
