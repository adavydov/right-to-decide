# NoveltySection specification

## Overview
- Target: `NoveltySection.tsx`, `NoveltySection.module.css`
- Interaction: static

## Content
Heading: `Новизна находится в причинной сборке, а не в перечне модных практик`.
Use eight `noveltyItems` and `notNovel`.
Public caveat: claims are a testable theory of change; prior-art review and experiments remain required.

## Exact styles
- Lead warning: left 4px accent, paper-strong, 22px Arial weight 650.
- Novelty grid two columns, margin 44px 0, 1px outer grid border; cards padding 25px, no radius.
- Number 13px accent; H3 Arial 23px; body Georgia 16.5px ink-soft.
- `notNovel` strip uses inline chips with 1px border, no radius, UI 13px.
- Caveat: border top/bottom rule, padding 22px 0, Georgia italic 18px.

## Responsive
- ≤760px novelty grid one column; chips remain wrapping.
