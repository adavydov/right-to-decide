# Behavior inventory

Reference: `https://adavydov.github.io/edu40-monograph/`, desktop 1440, mobile 390, 23.08.2026.

## Global

- Static header, 1 px terracotta rule.
- Paper background `#fbfaf7`; no shadows except dropdown; no rounded cards.
- Links and controls have minimum 44 px touch target.
- Focus ring: 3 px `#1864ab`, offset 3 px.
- Primary controls change `#c74b36 → #96321f`; duration 180 ms.

## Header

- Desktop: brand left, three anchor links right, square 42×42 menu trigger.
- Mobile ≤760 px: direct nav hidden; menu contains all anchors.
- Dropdown: right aligned, 248 px max width, opacity + `translateY(-6px)`, closes on outside click and Escape.

## Editorial content

- Desktop: numbered left rail + vertical rule + content column.
- Mobile: section number on top, horizontal rule, content below.
- Thesis cards do not lift or gain decorative shadows; hover changes background only.
- `<details>` summaries expose an explicit plus/minus mark and remain keyboard accessible.

## Responsive

- 1440: 1070 px centered canvas, 35 px internal gutters, two-column editorial rows.
- 768: 32 px gutters; dense grids reduce columns.
- 390: 20 px gutters; all grids one column; paired buttons full width; no horizontal overflow.
- Hero: 16:9 desktop; tall editorial cover mobile; title fluid 64→42 px.

## Accessibility and motion

- Skip link appears on focus.
- `aria-expanded` and `aria-controls` on menu.
- `prefers-reduced-motion` removes smooth scroll and transitions.
- Decorative cover artwork is `aria-hidden`; visible claims remain real text.

