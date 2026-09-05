# Reader font assets

Prepared on 2026-09-05 for the reading font picker. The site serves these WOFF2 files locally; there is no runtime request to Google Fonts.

## Provenance and license

Official source: [google/fonts](https://github.com/google/fonts/tree/5e35378e6bda803962ee6fd257e444a7d459660d). All files were downloaded from this immutable revision: `5e35378e6bda803962ee6fd257e444a7d459660d`.

The SIL Open Font License 1.1 files listed below are exact upstream bytes. Each family retains its upstream internal name and copyright information. WOFF2 conversion preserves the complete upstream character map, shaping tables, and variation axes; no glyph subsetting or axis instancing was performed.

| Family | Font version | Variable axes (min / default / max) |
| --- | --- | --- |
| Literata | Version 3.103;gftools[0.9.29] | `opsz`: 7 / 12 / 72; `wght`: 200 / 400 / 900 |
| Source Serif 4 | Version 4.004;hotconv 1.0.116;makeotfexe 2.5.65601 | `wght`: 200 / 400 / 900; `opsz`: 8 / 20 / 60 |
| Golos Text | Version 2.004 | `wght`: 400 / 400 / 900 |

Literata and Source Serif 4 include genuine italic variable fonts. Golos Text has no upstream italic face; its italic appearance uses browser synthesis when requested. CSS may expose any weight supported by the axes above.

## Committed files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `literata-normal.woff2` | 397212 | `230e5b1de4f4ace4d49c9fda9c8cf0851acb5425dce9067d89ff88aed93f325d` |
| `literata-italic.woff2` | 396676 | `38060b182b46a8b6c5f521982e86c59480f8811e77852ed563ce8a66a4adecb6` |
| `source-serif-4-normal.woff2` | 427556 | `4453d73855919eb67a8291bf2bad07782ecaf8af0e4e363d58948ff993209d51` |
| `source-serif-4-italic.woff2` | 346088 | `a5e93099350c2768f7939fa51503641c961550830fb2a02083f5cf11adf227b5` |
| `golos-text-normal.woff2` | 76540 | `177af0794fb0c2308b2edc76d8744549b5b390b30c67436892578c5f07c0bf00` |
| `literata-OFL.txt` | 4389 | `8742963604cd89dc81437811a850018fc03b2bfad686d7422c8235967c87614e` |
| `source-serif-4-OFL.txt` | 4400 | `5f94c3fd3a23131a417ab5a0c8452de57e70c3cfb9f604d88241f7065ebf9fd9` |
| `golos-text-OFL.txt` | 4394 | `ff532f9e8789f09a9fdffc3c0954eedfb0a48be77b2e2eb90f5f82e4f347f50c` |

Total compressed font payload: **1644072 bytes** (all five faces).

## Original files

| Local font | Immutable upstream file | Original TTF bytes | Original TTF SHA-256 |
| --- | --- | ---: | --- |
| `literata-normal.woff2` | [TTF source](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/literata/Literata%5Bopsz%2Cwght%5D.ttf) | 955132 | `b41138c9373112f32abb589cc22e8674b06ed4048b0c513be922bdd26f274440` |
| `literata-italic.woff2` | [TTF source](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/literata/Literata-Italic%5Bopsz%2Cwght%5D.ttf) | 902728 | `d483dfaeba9cbf4ce71d32a52ee65df82f7e35b15fff8d1011cdb242d1fcd465` |
| `source-serif-4-normal.woff2` | [TTF source](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/sourceserif4/SourceSerif4%5Bopsz%2Cwght%5D.ttf) | 1209508 | `97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b` |
| `source-serif-4-italic.woff2` | [TTF source](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/sourceserif4/SourceSerif4-Italic%5Bopsz%2Cwght%5D.ttf) | 855432 | `15fbc7e4679489a501998c3669272637a6646388ef7e4bd77eebb5bf967a1f42` |
| `golos-text-normal.woff2` | [TTF source](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/golostext/GolosText%5Bwght%5D.ttf) | 184292 | `17bb58fb69aec2dfb047a2ebf52534023e9b688c97a6b7ac795b0a72912c2063` |

Exact license sources: [Literata](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/literata/OFL.txt), [Source Serif 4](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/sourceserif4/OFL.txt), [Golos Text](https://raw.githubusercontent.com/google/fonts/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/golostext/OFL.txt).

## Conversion and verification

The conversion used Python 3.12 with `fontTools 4.59.2` and `Brotli 1.1.0` installed in an operating-system temporary tooling directory. No application dependency was added. Original font bytes were loaded with `TTFont(BytesIO(data), recalcTimestamp=False)`, `font.flavor` was set to `woff2`, and files were saved with `reorderTables=False`. Original TTFs are not shipped.

Every generated WOFF2 was reopened with FontTools and its complete Unicode character map compared with the original TTF. The check also verified non-`.notdef` glyph mappings for:

- Every printable ASCII character U+0020 through U+007E, including Latin letters and digits.
- All Russian uppercase and lowercase letters U+0410 through U+044F.
- Ё (U+0401) and ё (U+0451).

| Face | Preserved Unicode code points |
| --- | ---: |
| Literata normal | 1163 |
| Literata italic | 1163 |
| Source Serif 4 normal | 918 |
| Source Serif 4 italic | 918 |
| Golos Text normal | 566 |
