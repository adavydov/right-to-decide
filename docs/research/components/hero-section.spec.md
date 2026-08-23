# HeroSection specification

## Overview
- Targets: `HeroSection.tsx`, `HeroSection.module.css`, `DecisionArtwork.tsx`
- Reference: hero screenshots
- Interaction: static; two anchor CTA links

## Text
Eyebrow: `Тезисы будущей монографии · Алексей Михайлович Давыдов`.
H1: `Право на решение`.
Subtitle: `Инженерное образование как система когнитивного допуска в эпоху искусственного интеллекта`.
Cover statement: `Ответ подешевел. Ошибка осталась физической. Ответственность — человеческой.`
Caption: governingAnswer from data.

## Structure
`section.hero > cover(artwork + overlay) + caption(governing + actions)`.
Artwork is original SVG: system graph / decision gate / physical track geometry; one solid terracotta block; words `MODEL / JUDGMENT / EVIDENCE / RESPONSIBILITY` as faint typographic layers. No old monograph assets.

## Exact styles
- Hero top padding 72px; bottom rule.
- Cover desktop: aspect 16/9, border `#d9d5cd`, background `#f3efe8`, overflow hidden.
- Overlay: grid 54%/46%, padding clamp(32px,5vw,72px), UI font.
- H1: Arial, clamp(48px,6.1vw,82px), weight 750, line-height .92, tracking -.06em.
- Subtitle: Georgia, clamp(17px,1.65vw,23px), line-height 1.35, max 43ch.
- Cover statement: Arial 13px uppercase/700, top rule.
- Caption: flex, 20px 0 30px, governing max 680px, Georgia 20px; actions gap 12px.

## Responsive
- ≤760px cover aspect 4/5, overlay one column, 26×24px, H1 clamp 42–56px, artwork shifts right/fades.
- Caption stacks; action links width 100% on mobile.
