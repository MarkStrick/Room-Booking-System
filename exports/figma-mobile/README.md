# KKU SPACE — Mobile UI Export

Figma file: https://www.figma.com/design/2zUdJtNaFn2Z1I2aqpuVQU

Export date: 10 October 2026 (Asia/Bangkok).

168 screen/state exports: 56 per device.

| Device | Width | Reference viewport height |
|---|---:|---:|
| Mobile, compact baseline | 360 | 800 |
| iPhone 13 | 390 | 844 |
| iPhone 17 Pro Max | 440 | 956 |

The long page exports retain their complete page height; dialogs and mobile navigation use the device viewport height. UI data comes from the application's seed fixtures, including user, staff, administrator, authentication, and form screens. This is a UI export, not a connected application or a clickable prototype.

The Figma imports contain native frames and text. They are not connected to a published component library. Direct component construction and API screenshot inspection reached the account's Starter MCP call limit; the standard web capture/import channel remained available. The imported Mobile gallery was inspected visually in Figma's browser viewer.

To download a native .fig file, sign in to the file's Figma account and choose File → Save local copy. No native .fig download has been produced by this workspace export.

## Local backup

- `gallery/`: HTML previews with individual text, SVG icons, and nested UI boxes; open a device HTML file to inspect the exports. Google Fonts require network access.
- `mobile/`, `iphone13/`, `iphone17promax/`: structured UI measurements and editable text for all 168 screen states.
- `*-inventory.json`: screen names and measured dimensions.
- `manifest.json`: device dimensions, file URL, and import node IDs.
The workspace also retains temporary export adapters in `source/`; these are not part of the ZIP. The application source was restored after exporting.

The compact Mobile size is a general baseline, not a claim that all phones sold in 2026 have the same viewport.

## Completed Figma frames

168 distinct screen/state exports are complete. iPhone 17 Pro Max was imported in smaller groups to finish conversion. Earlier import attempts may leave additional duplicate references in the file. The canonical completed sets are:

| Device / screen numbers | Figma frame |
|---|---|
| Mobile, 1–56 | [Open](https://www.figma.com/design/2zUdJtNaFn2Z1I2aqpuVQU?node-id=7-2) |
| iPhone 13, 1–56 | [Open](https://www.figma.com/design/2zUdJtNaFn2Z1I2aqpuVQU?node-id=8-2) |
| iPhone 17 Pro Max, 1–14 | [Open](https://www.figma.com/design/2zUdJtNaFn2Z1I2aqpuVQU?node-id=14-2) |
| iPhone 17 Pro Max, 15–28 | [Open](https://www.figma.com/design/2zUdJtNaFn2Z1I2aqpuVQU?node-id=15-2) |
| iPhone 17 Pro Max, 29–35 | [Open](https://www.figma.com/design/2zUdJtNaFn2Z1I2aqpuVQU?node-id=19-2) |
| iPhone 17 Pro Max, 36–49 | [Open](https://www.figma.com/design/2zUdJtNaFn2Z1I2aqpuVQU?node-id=23-2) |
| iPhone 17 Pro Max, 50–56 | [Open](https://www.figma.com/design/2zUdJtNaFn2Z1I2aqpuVQU?node-id=22-2) |

The final 14-form group removes nodes fully outside the clipping bounds; all visible UI remains editable.
