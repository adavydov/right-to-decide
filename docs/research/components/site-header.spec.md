# SiteHeader specification

## Overview
- Target: `src/components/SiteHeader.tsx`, `SiteHeader.module.css`
- Reference: `reference-desktop-hero-1440.png`, menu-open screenshot, mobile hero screenshot
- Interaction: click-driven dropdown; outside click and Escape close it

## Structure and content
`header > skip-link + inner(brand + desktop nav + menu trigger/dropdown)`.
Brand: `Право на решение`. Desktop anchors: `Проблема`, `Тезисы`, `Содержание`. Dropdown: all section anchors plus GitHub.

## Exact styles
- Header: static/relative, `#fbfaf7`, bottom rule `1px solid rgba(199,75,54,.55)`.
- Inner: `max-width:1070px`, min-height `70px`, padding `16px 35px`.
- Brand: Arial, `20px/1.1`, weight 700, `#c74b36`, no underline.
- Desktop nav: Arial 14px, gap 24px, links min-height 44px.
- Trigger: 42×42, 1px `#d9d5cd`, zero radius, transparent; hover/open `#f3efe8`.
- Dropdown: top `calc(100% + 10px)`, right 0, width min(300px, viewport−24px), padding 8px, border, paper, `0 18px 44px rgba(41,41,39,.14)`.
- State: closed opacity 0, hidden, translateY(-6px); open opacity 1, visible, translateY(0), 180ms.

## Responsive
- ≤900px inner padding 32px.
- ≤760px inner padding 12px 20px, brand 18px, desktop nav hidden, dropdown shows all anchors.

## Accessibility
Skip link, semantic nav, `aria-expanded`, `aria-controls`, focus return on Escape, no scroll locking.
