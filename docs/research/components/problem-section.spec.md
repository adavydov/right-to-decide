# ProblemSection specification

## Overview
- Target: `ProblemSection.tsx`, `ProblemSection.module.css`
- Interaction: hover only

## Content
Heading: `ИИ сломал две лестницы, на которых держалась инженерная профессия`.
Two lead panels:
1. `Лестница взросления` — disappearing junior work.
2. `Лестница доверия` — artifacts no longer prove competence.
Conclusion band: `Университету придётся заново спроектировать и путь, на котором человек становится инженером, и доказательство того, что инженер состоялся.`
Then four stakeholder stakes from data.

## Exact styles
- Uses global section intro.
- Double break grid: 2 equal columns, margin-top 48px, common 1px outer border; panel padding 30px.
- Panel number: Arial 13px/700 accent; title Arial 30px/1.1 weight 650; paragraph Georgia 18px ink-soft.
- Conclusion: margin-top 24px, paper-strong, left border 4px accent, padding 24px 28px, Arial 22px/1.4 weight 650.
- Stakeholder grid: 4 columns, margin-top 48px, border top+left; each cell padding 22px, right+bottom border.
- Audience label accent uppercase 12px; warning Arial 18px/1.25 weight 650; demand Georgia 16px ink-soft.

## Responsive
- ≤900px stakeholder grid 2 columns.
- ≤760px all grids one column; borders remain flat; conclusion font 19px.
