# Publication QA

## Build

- Node.js 24
- Next.js 16.3.2, static export
- `npm run check` with `NEXT_PUBLIC_BASE_PATH=/right-to-decide`: passed
- production dependency audit: 0 vulnerabilities
- exported routes: `/`, `/robots.txt`, `/sitemap.xml`

## Visual review

The local page was reviewed in the in-app browser against the authorized
predecessor at:

- 1440 × 1000
- 768 × 900
- 390 × 844

Captured states are stored in `docs/design-references/`. Review covered the
hero, problem, five-step framework, world-practice rows, evidence register and
author profile. The mobile evidence grid was widened after the review to keep
long source identifiers separate from titles.

## Structure and accessibility

- one `h1`; section hierarchy uses `h2`/`h3`/`h4`
- skip link targets `#main-content`
- menu exposes `aria-expanded`, closes on Escape and click outside
- contents uses native `details`/`summary`
- portrait attribution is visible and linked to the official RUT profile
- external links open with `rel="noreferrer"`
- all nine internal fragment links resolve; no duplicate IDs
- reduced-motion and visible-focus rules are present

## Evidence hygiene

The page separates mechanisms, observed signals and boundaries of evidence.
Twenty-three unique external URLs were checked; accessible targets returned
successful responses. Several publishers reject automated checks or time out,
while remaining valid in a browser (notably PNAS and TEQSA).
