# ThesisSection specification

## Overview
- Target: `ThesisSection.tsx`, `ThesisSection.module.css`
- Interaction: hover background only

## Content
Heading: `Четырнадцать тезисов, которые книга должна доказать`.
Use `thesisGroups`; preserve numbering 01–14, group title, group thesis, consequences and source links.

## Structure
Each group: `group header + ordered thesis cards`. Cards show number rail, title, text, optional consequence, optional source chips.

## Exact styles
- Group margin-top 64px; group header two columns 170px/1fr with vertical rule.
- Group title accent Arial 13px uppercase; group thesis Arial 28px/1.16 weight 650.
- Cards two-column grid, border-top/left; card min-height 240px, padding 26px, right/bottom border.
- Number Arial 13px 700 accent. H3 Arial 25px/1.08 650, tracking -.025em. Body Georgia 17px/1.55 ink-soft.
- Consequence: top rule, Arial 14px/1.45 weight 650.
- Hover background `#f3efe8`; 180ms; no transform/shadow.

## Responsive
- ≤900px cards one column.
- ≤760px group header one column, thesis font 25px, card min-height auto.
