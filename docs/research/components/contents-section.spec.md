# ContentsSection specification

## Overview
- Target: `ContentsSection.tsx`, `ContentsSection.module.css`
- Interaction: native details/summary

## Content
Heading: `Шесть частей. Восемнадцать глав. Один вопрос о доверии.`
Use `bookParts`; first part open by default.

## Exact styles
- List margin-top 50px; 1px top border.
- Each details bottom border; summary grid 90px minmax(260px,.8fr) 1fr 32px; padding 24px 0; cursor pointer; hide native marker.
- Roman number accent Arial 16px/700; title Arial 27px/1.1 650; thesis Georgia 16px ink-soft; plus 24px UI.
- Open state paper-strong strip; chapters in ordered list with left offset 90px, padding 0 32px 26px; each row top border, 12px 0.
- Hover summary background rgba(243,239,232,.6).

## Responsive
- ≤760px summary grid 48px 1fr 28px; thesis moves below title; chapters offset 48px; title 23px.
