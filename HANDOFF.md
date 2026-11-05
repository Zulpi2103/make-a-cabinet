# Cabinet Clash — handoff report

Status as of 4 Nov 2026. Written for whoever continues this work (another AI session or a developer).

## Where the code lives

- **The live game is in the user's GitHub repo clone:** `~/Documents/GitHub/vapik78.github.io/politics/`
  It is served at **https://vapik78.github.io/politics/** (GitHub Pages; the user commits and pushes with GitHub Desktop).
  - `index.html` · `css/style.css` · `js/data.js` · `js/engine.js` · `js/media.js` · `js/net.js` · `js/pundit.js` · `js/ui.js`
- This folder (`Documents/random ai/Political game/`) only holds `README.md` (the full player and deploy guide), this report, and `.claude/launch.json` for a local test server. The user *moved* the game files into the repo, so don't recreate them here.
- **Never commit or push for the user** unless they ask. They do it themselves in GitHub Desktop.
- The repo also has unrelated uncommitted user work (`experience.js`, `.DS_Store`). Leave it alone.
- **Local testing:** `.claude/launch.json` serves a copy at `<scratchpad>/site` on port 8765. macOS blocks serving `~/Documents` directly, so sync first: `rsync -a --delete --exclude .DS_Store ~/Documents/GitHub/vapik78.github.io/politics/ <site>/`. A headless engine simulation lives at `<scratchpad>/sim.js`. Both scratchpad paths may be gone in a new session; rebuild them if needed.

## What the game is (current, working)

A party game: bid in a live auction for real politicians to fill a cabinet, then the cabinets duel.

- No build step; vanilla JS globals (`window.CC`, `window.CC_DATA`).
- **The engine is host-authoritative.** `engine.js` holds the pure state machine: `act(S, pid, action, now)`, `tick(S, now)` and `Bots.think`. State is plain JSON.
- **Roles:**
  - **Solo:** you against AI rivals.
  - **Pass & play:** several people on one screen.
  - **Online rooms:** run through a public MQTT broker (HiveMQ, falling back to EMQX) via `mqtt.js@5.16.0` from cdnjs.
    - WebRTC/PeerJS was dropped because its free relay (TURN) servers are dead.
    - The host's browser runs the engine and publishes a retained `state` message.
    - Players publish `up` messages (hello / act / ping / bye).
    - A last-will message clears the room marker when the host drops; the game auto-reconnects.
- **Deck modes:** legends, world, countries (with presets), continents, modern, history, plus a fame filter.
- **Showdown judging:** `crisis` (automatic: 3 random crises, seat scores + chemistry + dice) or `vote` (argue out loud and vote).
  - A "How the showdown works" briefing screen comes before the duels.
  - Crises reveal slowly: 3 s intro, then 5.5 s each, with "???" for 1.8 s before the scores flip in.
- **House rules:**
  - budget, timer, discards, judge, showdown length;
  - **Experience hints** (off by default). With hints off, cards hide fits, scores and power during the auction and show neutral role text (`f.rn`). Everything is revealed once the cabinets are sworn in.
- **Pundit:**
  - **House pundit:** offline templates, long roasts with per-minister jokes and draft roasts.
  - **Free AI:** WebLLM running Llama 3.2 3B only. The 1B model was removed because it produced race and gender jokes.
  - Both use a keyword safety filter and quality checks. There is no Claude or API-key feature anymore (the user asked to remove it).
- **Other:**
  - a clickable "Power & cabinet bonuses" explainer;
  - photos fit their frame without cropping (blurred backdrop, 480 px thumbnails);
  - random example name on the home page.

## ⚠️ In progress when the session stopped

The user asked for a big batch of changes (in Czech). Only step 1 below is done; **the repo is mid-change but still runs**.

**Done: step 1 (graded skills).** `js/data.js` now stores a 7-digit skill string per politician, one 1–9 rating per seat in the order **L E F I J D S**:

| Letter | Seat |
|---|---|
| L | Leader |
| E | Economy |
| F | Foreign Affairs |
| I | Interior |
| J | Justice |
| D | Defence |
| S | Social Affairs (health, education, welfare) |

- All 447 politicians were hand-rated from their real careers; the source list is in `<scratchpad>/ratings.txt` and is already merged into `data.js`.
- Each politician now has `f.sk = {L,E,F,I,J,D,S}`; `f.tags` = the seats rated ≥ 7.
- The engine **still uses only 5 seats** (L E F I J) and the old scoring: fame base 7/5/3 + 4 if `tags` contains the seat. It works because `tags` still has L–J.
- Uncommitted files in the repo: `css/style.css`, `js/data.js`, `js/engine.js`, `js/media.js`, `js/pundit.js`, `js/ui.js`. Steps 2–9 need to be done before this batch is a good thing to push, although the earlier fixes (photos, neutral roles, bonus explainer) are already in those files and work.

### Remaining requests (user's spec, in order)

2. **Scoring from skills; fame counts much less.** `seatScore = f.sk[seat] + (tier 1 ? 1 : 0)`. Remove `BASE` and `FIT`. Tune the AI `valuation()` (its `best / 7` scaling) to the new score range.
3. **Seven seats.** Add `{k:'D', name:'Defence', icon:'🎖️'}` and `{k:'S', name:'Social Affairs', icon:'🏥'}` to `SEATS` in L E F I J D S order. Then update:
   - `minPool` to players × 7;
   - seats arrays to length 7;
   - budget options to 20/30/40, default 30;
   - chemistry for 7 seats: country +(n−1) capped at +5; continents ≥4 → conts−2; same era +3; all seats ≥7 → +4;
   - personas: give the Hawk `D`, and add a social-minded rival with `S`;
   - the bonus explainer text.
   - Classic `CRISES` need seat pairs that include the D and S seats.
4. **Bidding.** Allow **all in**: `maxBid = cr`, with no 1-credit-per-empty-seat reserve. Players with 0 credits can't bid; forced (random) assignments cost `min(1, cr)`. Add a **+10** button next to +1, +2, +5 and All in.
5. **Classic crisis dice 1–3** instead of 1–6.
6. **New judge mode "Crisis hand"** (`judge: 'hand'`; add a lobby chip and briefing text):
   - Each duel, both players are dealt **4 crisis cards** and secretly **play 2**; **1 random** crisis is added, for **5 crises**.
   - For each crisis, each player sends **2 ministers** (or the same one twice). The game does **not** reveal which seats a crisis tests: cards show only a name, flavour text and maybe a region.
   - **Score per crisis, out of 100:**
     - **≥ 60 % seat relevance:** each crisis has hidden weights over the 7 seats, spread so it isn't "inflation → Economy" (e.g. Inflation E .45, L .25, S .2, F .1). posRel = w[seat] / max(w).
     - **~25 % personal skill:** Σ w[k] · sk[k] / 9.
     - **~15 % modifiers:** region match (minister's continent) +; known allies in the same crisis + / bitter rivals −, from a small pair list (Clintons, Kennedys, Obama & Biden, Thatcher & Reagan, Trump vs Clinton, Gorbachev vs Yeltsin…); same country/era synergy; era fit (e.g. modern crises penalise pre-1945 ministers).
     - an optional tiny dice roll, 0–3.
   - The two slots are averaged. Higher total over the 5 crises wins the duel (3 league points).
   - **Phases:** `hand` (pick 2 of 4) → `deploy` (assign 2 per crisis; Ready) → slow reveal crisis by crisis → `duelres`.
   - Bots pick cards where they're strongest and assign their best pairs.
   - Online play keeps choices hidden; pass & play can pick openly in turn.
7. **Room leaderboard.** Keep `S.room = {games, rows: {pid: {pts, wins, games}}}` across "Play again" with the same players. Update it when a game reaches `final`; show it on the final screen and in the lobby.
8. **Who's who page.** A button near the bottom of the home page opens a searchable list of all politicians (filters: country, best seat; sorting). Clicking one opens a profile: portrait, role, years, fame, and bars for the 7 skill ratings. This page may reveal ratings; it's reference material.
9. **Pundit and text updates for 7 seats.**
   - `pundit.js` `SEAT_KEYS` needs 7 entries; add `SEAT_JOKES` pools for `D` and `S`. The old Defence jokes in git history (commit `ae42429`) can be reused for D.
   - Raise the free-AI roast `max_tokens` to about 650.
   - Update the rules modal, briefing screen, bonus modal and README.
10. **"Too much democracy" (user's feeling).** Keep the ratings value-neutral: strongmen are rated on real competence (e.g. Putin I9, Xi I9). Still exclude figures known mainly for genocide (Hitler, Stalin, Mao, Pol Pot). If the user means something else, ask them.
11. **Crisis timing** is already slowed (`CRISIS_MS = 5500`, 1.8 s suspense). The user may not have seen it because it isn't pushed yet. Confirm with them before changing it again.

After implementing: run the engine simulations for all modes (all duels must finish) and test in the browser (solo, then online with two tabs). Then tell the user which files changed so they can commit and push.

## Conventions and gotchas

- The user writes in Czech or English; reply in the language they used. They prefer short, direct updates.
- Keep the newspaper / campaign-poster style (Fraunces + Space Grotesk, hard shadows, light and dark tokens).
- Rendering uses `innerHTML` plus a rAF/timeout fallback; the candidate card's DOM node is reused within a lot to avoid replaying its animation.
- Browser caching during tests: `fetch(file, {cache:'reload'})` before `location.reload()`.
