# uchipokerclub.com

The website of the University of Chicago Undergraduate Poker Club: Home, About, Team, Contact, and the ledger
(public standings, member sign-up, and the board's results tool).

- **Deploying or moving hosts:** see [DEPLOY.md](DEPLOY.md).
- **How it should look and why:** see [DESIGN.md](DESIGN.md).
- **What the site is for and what it must never claim:** see [PRODUCT.md](PRODUCT.md).

## Editing content

Almost everything lives in one file: [`content/club.js`](content/club.js). Schedule, events, board, sponsors,
links, copy, and the ledger backend URL. Edit it on github.com, commit to `main`, and the site redeploys.

- Dates are `YYYY-MM-DD`, times are 24-hour `HH:MM`, Chicago time.
- Photos go in `public/images/`. To replace a photo, give the new file a new name and update the path.
- No em dashes or en dashes anywhere. `npm run build` refuses to run if one appears (`scripts/check-copy.mjs`).
  Use a hyphen for ranges: `2026-2027`.

## How the ledger works

The Google Sheet is the database. Its Apps Script (`apps-script/Code.gs`) is a small web app the site talks to:

| Request | Who | What |
|---|---|---|
| `GET` | Anyone | Names and weekly results of people who have played. Never emails. |
| `POST join` | Anyone with the sign-up code | Adds a member to the Players tab |
| `POST subscribe` | Anyone | Adds a row to the Mailing list tab (footer form) |
| `POST load`, `save`, `addPlayer` | Board password only | The results tool at `/ledger/record` |

The home page and `/ledger` are rebuilt in the background at most every 60 seconds, so standings update without
a redeploy and visitors never wait on Google. If the Sheet is unreachable, the page falls back to fetching in
the browser.

## Running it locally

```bash
npm install
```

```bash
npm run dev
```

Tests (standings math, schedule logic, and the whole Apps Script backend run against an in-memory Sheet):

```bash
npm test
```

To try the ledger end to end without Google, run the backend under Node (see `apps-script/test/gas-mock.cjs`)
and point the site at it with `NEXT_PUBLIC_LEDGER_API_URL` and `EXTRA_CONNECT_SRC`.

## Layout

```
content/club.js        every piece of editable content
pages/                 one file per URL
components/            header, footer, ledger table, forms, results tool
lib/                   standings math, schedule helpers, API calls, fonts
styles/globals.css     the whole design system
apps-script/           the Google Sheet backend and its tests
scripts/check-copy.mjs build guard against em and en dashes
```
