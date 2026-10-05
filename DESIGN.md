# Design

The site follows the club's Fall 2026 deck: maroon on white, a heavy Franklin-style grotesque, thick maroon rules
under titles, small tracked uppercase labels. The rules below are adapted from the taste-skill design pack
(github.com/Leonxlnx/taste-skill) with its fake-credibility and image-generation rules removed.

## Settings

| Dial | Value | Meaning here |
|---|---|---|
| Layout variance | 5 of 10 | Left-aligned, asymmetric splits, no masonry experiments |
| Motion | 3 of 10 | Hover and press feedback and the mobile menu only. No scroll animations |
| Density | 4 of 10 | Sections 56 to 96px apart. The ledger table may be denser |

## Tokens (`styles/globals.css`)

| Token | Value | Use | Contrast on white |
|---|---|---|---|
| `--maroon` | `#800000` | The only accent | 10.95:1 |
| `--ink` | `#141414` | Body and headings | 18.4:1 |
| `--muted` | `#555555` | Secondary text | 7.46:1 |
| `--subtle` | `#6b6b6b` | Metadata, placeholders. Nothing lighter is ever used for text | 5.33:1 |
| `--line` | `#8f8f8f` | Input borders | 3.23:1 |
| `--rule` | `#e3e3e3` | Hairlines between rows | decorative |
| `--tint` | `#fbf4f4` | Paid ledger rows | background |
| `--pos` / `--neg` | `#1b7a3d` / `#b3261e` | Ledger gains and losses only, always with a sign | 5.39 / 6.54:1 |

- Font: Libre Franklin (variable), self-hosted by `next/font`. No second family.
- Corners: square everywhere. No shadows, gradients, glass, or glows.
- Light only. Maroon on near-black is 1.68:1, so a dark mode would break the brand.
- One maroon block per page (the next-meeting band on Home, the prize pool on the ledger).

## Rules that are checked, not remembered

- No em or en dashes in any file the site ships. The build fails otherwise.
- Hero: headline of 2 lines or fewer, subtext of 20 words or fewer, buttons visible without scrolling, top
  padding 88px or less.
- Phones: the hero copy and both buttons come before the photo. Anything tappable outside running text is at least
  44px tall (`--tap`). A sent form's confirmation scrolls itself into view. Number fields that can go negative get the full keyboard, because
  the iPhone number pad has no minus key.
- At most one small uppercase label per three sections, never in consecutive sections.
- One button label per intent: "See the schedule", "View the ledger", "Join the ledger", "Log my result",
  "Sign Up", "Request the prospectus". Board tool: "Approve", "Reject", "Save code".
- Sponsor row sits right under the hero, shows real logos only, with the deck's disclaimer word for word.
- No scroll listeners. Every transition is inside `prefers-reduced-motion: no-preference`.
- No `h-screen` or bare `100vh` for full-height sections.
- Every grid has exactly as many cells as items.
- Images are real club photos. Never stock, never generated. Alt text describes what is in the photo.

## Never change silently

URLs (`/`, `/about`, `/team`, `/contact`, `/ledger`), nav labels, the logo, form field names (`code`, `name`,
`email`, `year`, `fname`, `lname`, `website` are the backend contract), and the disclaimer
"No money is wagered at any point. Chips are for scoring only."
