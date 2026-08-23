# AuthorSection specification

## Overview
- Target: `AuthorSection.tsx`, `AuthorSection.module.css`
- Asset: `public/images/author-alexey-davydov.jpg`; always attribute/link official RUT profile
- Interaction: external links hover

## Content
Heading: `Автор работает внутри системы, которую предлагает перестроить`.
Use verified `author.ts`: role, bio, whyThisAuthor, six-point timeline, awards, identifiers, links, selected works.

## Structure
Intro → grid(photo / copy) → timeline → awards → identifiers and works → email CTA.

## Exact styles
- Author grid two columns minmax(260px,.72fr) minmax(0,1.28fr), gap 56px, margin-top 50px.
- Photo width 100%, max 360px, aspect 587/782, object-fit cover, border 1px; caption UI 11px ink-soft.
- Name Arial clamp 34–48px/1.03 650; role accent UI 15px/1.45 700; bio Georgia 19px.
- Timeline top border; rows grid 110px/1fr, padding 18px 0, bottom border; period accent UI 13px.
- Awards grid two columns, each border-bottom, padding 12px, UI 14px.
- External link list flat border grid; hover paper-strong.

## Responsive
- ≤900px gap 36px.
- ≤760px one column; photo max 420px; timeline one column; awards one column.
