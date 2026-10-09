# Deploying www.uchipokerclub.com

Everything here belongs to the club, not to a member and not to any other project a member runs.
**Use UofChicagoPokerClub@gmail.com for every account below.** That keeps the club's usage, limits and billing
separate from everything else, and it survives every board turnover.

## Accounts

| What | Owner | Notes |
|---|---|---|
| Google Sheet + Apps Script (ledger, sign-ups, mailing list) | UofChicagoPokerClub@gmail.com | Turn on 2-Step Verification for this account first. It is the master key to everything. |
| Vercel (hosting) | A new free Hobby account signed up with UofChicagoPokerClub@gmail.com | Sign up in a private browser window so no existing Vercel login gets reused. |
| GitHub (code) | A GitHub organization for the club (free), contact email UofChicagoPokerClub@gmail.com, with board members' personal GitHub accounts as owners | Keep the repo **public**: Vercel's free plan cannot deploy private repos owned by an organization. Nothing secret lives in this repo. |
| Domain uchipokerclub.com | Stays at Squarespace Domains (expires 2027-01-07) | Only two DNS records change. No email uses this domain. |

Do not create or link the Vercel project from a terminal (`vercel link`, `vercel deploy`): a laptop's Vercel
command-line login may belong to a different team. Use the vercel.com website, signed in as the club.

This repo's git identity is set locally to the club (`git config user.email` shows UofChicagoPokerClub@gmail.com),
so commits never carry another account's email.

## 1. Backend: the club Google Sheet

1. Signed in as UofChicagoPokerClub@gmail.com, create a Google Sheet named "UChicago Poker Club Ledger".
2. Extensions > Apps Script. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this repo. Save.
3. Reload the Sheet. A **Ledger** menu appears:
   - **Set up sheet** (approve access once). Creates the Players, Log, Mailing list, Sponsor inquiries and
     Submissions tabs. Safe to run again: it only adds what is missing, and puts back any mailing list row that
     an older version wrote out of column order. The mailing list columns can be reordered freely: sign-ups are
     written by header name (Email, First Name, Last Name, Joined, Source, Class Year, Major). A header that is
     missing is added after the last column in use, by Set up sheet or by the next sign-up.
   - **New board password**. Shown once: copy it into the board group chat.
   - **Set meeting code**. 6 to 20 letters or numbers. Members need it to join and to log results. It can also be
     changed from the board tool, which is easier at a meeting (the Ledger menu does not exist in the Sheets phone app).
4. Deploy > New deployment > type **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and copy
   the URL ending in `/exec`.
5. Paste that URL into `ledger.apiUrl` in `content/club.js` and commit.
6. Share the Sheet (Editor) only with board members who need it. Never "Anyone with the link".

After editing `Code.gs` later: Deploy > Manage deployments > edit > Version: **New version**. The URL stays the same.
Then run **Ledger > Set up sheet** once, in case the new version added a tab. Deploy the backend before pushing a
site change that calls a new backend action: the old backend answers an unknown action as a wrong board password.

## 2. Website: GitHub, then Vercel

From this folder, with the GitHub organization created on github.com:

```bash
gh auth status
```

It must show your **personal** GitHub account (the one that owns the club organization), not a shared or
company account. Then:

```bash
git add -A && git commit -m "Club website"
```

```bash
gh repo create <club-org>/uchipokerclub --public --source=. --push
```

On vercel.com, signed in as the club: Add New > Project > Import Git Repository. Install the Vercel GitHub app on
the club organization only, for this repo only. Framework is detected as Next.js. Deploy.

Open the `*.vercel.app` preview link and check every page. Every later push to `main` deploys automatically;
pushes to other branches get their own preview link.

## 3. Domain cutover

1. Vercel > the project > Settings > Domains: add `www.uchipokerclub.com` and `uchipokerclub.com`.
   Vercel then shows the exact records it wants.
2. Squarespace > Domains > uchipokerclub.com > DNS: delete the **Squarespace Defaults** records (four A records
   198.49.23.144, 198.49.23.145, 198.185.159.144, 198.185.159.145, and the `www` CNAME to `ext-sq.squarespace.com`).
   Add the A record and the `www` CNAME **exactly as Vercel shows them**. Leave the two TXT records alone.
3. Wait for Vercel to show "Valid Configuration" and issue HTTPS (minutes, sometimes a few hours).
4. Check: `https://www.uchipokerclub.com` loads; `https://uchipokerclub.com` and `/home` redirect; `/ledger`
   shows standings; a test sign-up and a test mailing-list sign-up land in the Sheet.

## 4. Retire Squarespace

1. Export the old footer newsletter's subscribers from Squarespace and paste them into the Mailing list tab.
2. Leave the Squarespace site up for a week as a fallback.
3. Cancel the **website** plan. Keep the **domain** registered with auto-renew on (it renews 2027-01-07).
   Moving the domain to a cheaper registrar later is optional.

**Rollback** at any point: in the Squarespace DNS panel, delete the Vercel records and re-add the Squarespace
Defaults preset.

## Run a meeting

1. Before it starts, open www.uchipokerclub.com/ledger/record on your phone (board password), set a new
   **meeting code**, and show it in the room with the address uchipokerclub.com/ledger/log.
2. New members join at /ledger/join with the same code. At the end, everyone logs their chips at /ledger/log.
   Members log chip counts against the starting stack: 7,500 unless the board saved another number in the board
   tool's Starting stack field (it is saved along with results). Check that field shows the right stack before members log.
3. Each player shows you their stack. In the board tool's **To approve** list, type their name in the find box,
   check the chips, correct **Chips counted** if needed, and press **Approve**. **Reject** if it is wrong; they can
   log again. A card that says "Changed from" was logged more than once: make sure the person in front of you is
   the one on the card. The public ledger updates within a minute.
4. Walk-ins without a phone: type their name in the find box, enter their chips in the table, press Save. A result
   typed in the table locks logging for that player that night, and Approve will not overwrite it.
5. When the meeting ends, clear the meeting code (Change, empty, Save code), so last week's code cannot be used
   before the next meeting.

Logging is open from 4 p.m. to 4 a.m. Chicago on the date in a week column's label ("Oct 9"). Ledger > Add a week
only accepts labels like that. A meeting moved to another day needs its own week column, or the board table.
Entries still waiting after the night stay in the board tool; it opens on that week until they are handled.

Google is sometimes slow, up to about a minute for one answer. After a few seconds every form says "Still working".
Members' forms stop waiting after a minute and keep what was typed; sending again is safe, because the backend
recognizes a log or sign-up it already has. The board tool waits for every answer and handles one request at a time,
so let it finish rather than refreshing the page.

## Everyday

- **Change the site:** edit `content/club.js` on github.com (pencil icon), commit to `main`. Live in about a minute.
- **Record a week:** www.uchipokerclub.com/ledger/record (board password), or approve what members logged.
- **New term:** update the schedule and events in `content/club.js`; update `TERM` and `WEEKS` in `Code.gs` and
  deploy a new version first (the week dates take their year from `TERM`); then in the Sheet, Ledger > Add a week
  for each meeting. `npm test` checks that `WEEKS` falls on the weekly meeting dates; Add a week refuses a label
  that is not a date.
- **Board change:** Ledger > New board password (signs everyone out), and update the board in `content/club.js`.
