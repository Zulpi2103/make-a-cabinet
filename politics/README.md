# Cabinet Clash

A party game about buying an improbable government and putting the right people on the right problems. Play solo against computer rivals, pass one device around, or create an online room for friends. The game is a static website: there is no account, paid AI service or build step.

## Your first game

1. Choose a way to play, add players or computer rivals, and choose a deck. The default budget is **30 credits**; 20 and 40 are also available. Deck filters control which politicians can appear. A deck must have enough people to fill everyone's cabinet.
2. Bid for politicians and assign each recruit to an empty ministry. Every cabinet has seven seats: **Leader, Economy, Foreign Affairs, Interior, Justice, Defence and Social Affairs** (`L E F I J D S`). A recruit's assignment matters later.
3. When everyone's cabinet is complete, inspect the skills and chemistry. Then contest a tournament of cabinet duels using **Crises** or **Group vote**. Solo play uses Crises.
4. The final screen shows this game's standings and the room's cumulative leaderboard. **Play again** keeps that room leaderboard.

Near the bottom of the home page, **Who's who** opens the complete **461-person** reference library. Search by name or background, filter by country and best seat, sort the results, and open a profile to see a portrait or fallback, public role, years, fame and all seven skill ratings. This reference deliberately shows ratings. The separate **experience hints** setting still controls whether auction cards reveal skills; turning hints off does not turn the reference into a restricted library.

## Bidding and filling your cabinet

Use **+1, +2, +5, +10** or **All in**. The increment raises the current price; unaffordable bids cannot be submitted. Where keyboard bidding is available, `1`, `2`, `5` and `0` select those increments (`0` means +10), `M` bids your maximum and `P` passes. Keyboard raises stop at your maximum if the full increment would cost too much.

You may spend every remaining credit even when seats are empty. At zero credits you wait while the other players finish paid bidding. **Only after paid bidding has ended for everyone**, the game randomly recruits enough remaining people to fill the vacancies, for **zero credits**. You still choose each recruit's ministry. A bot or an expired placement timer chooses a usable empty seat automatically. Recruits stay within the selected deck, and a person cannot belong to two cabinets.

All in buys certainty about one recruit at the cost of control over later recruits. Keeping some credits lets you compete for a specialist you still need. A famous name in an unsuitable ministry can be less useful than a less famous specialist.

## Skills, effectiveness and cabinet power

Skills run from **1 to 9**. They are approximate game-design judgments about relevant ability and experience, not scientific rankings or approval of the person. Leadership covers directing a government; Economy covers economic management; Foreign Affairs covers diplomacy; Interior covers domestic administration and security; Justice covers legal and institutional work; Defence covers military strategy and coordination; Social Affairs covers health, education, welfare and public services.

A high Interior rating does not imply strong economic, legal or social policy. Democracy, authoritarianism, moral reputation and time in office receive **no generic scoring multiplier**. A crisis about public trust or equal treatment can make the relevant abilities useful because those are that card's objectives. Effectiveness in one field does not excuse abuses or make someone admirable. Hitler, Stalin, Mao and Pol Pot remain deliberately excluded from the roster.

**Cabinet power** is the sum of each minister's assigned skill, plus **1 for each household-name figure**, plus these cabinet modifiers:

| Modifier | Effect on cabinet power |
| --- | --- |
| Shared country background | The largest country group gives +1 for three ministers, +2 for four, or +3 for five or more. Other country groups do not stack. |
| Geographic breadth | At least four continents: +2. |
| Shared era | All seven ministers in the same era: +2. |
| Ministry fit | All seven assigned skills at least 7/9: +3. |
| Listed working relationships | Relevant ally +1 or rival −1 per pair, with the combined relationship adjustment capped between −2 and +2. |

The eras are before 1945, 1945–1999 and the 21st century. Shared country background models familiarity with institutions; it does not claim that everyone from that country is an ally. Geographic breadth and specialization also help a cabinet, so cooperation is not a reward for uniform politics.

## Working relationships

Only these explicitly listed pairs have ally/rival modifiers. Their links and skill contexts are limited game-design interpretations of documented cooperation or conflict. They are not claims that people would always agree, or that a shared project succeeded.

| Pair | Relationship | Relevant fields and evidence |
| --- | --- | --- |
| Barack Obama / Joe Biden | Ally | Economy, Social Affairs: delegated [Recovery Act implementation](https://obamawhitehouse.archives.gov/the-press-office/vice-president-biden-oversee-administrations-implementation-recovery-acts-provision), including [childcare funding](https://obamawhitehouse.archives.gov/the-press-office/vice-president-biden-announces-23-billion-recovery-act-funds-help-care-children-pre). |
| Margaret Thatcher / Ronald Reagan | Ally | Foreign Affairs, Defence: a [strategic partnership with real disagreements](https://www.margaretthatcher.org/archive/us-reagan). |
| Bill Clinton / Hillary Clinton | Ally | Social Affairs: [joint work on the 1993 health reform effort](https://www.clintonlibrary.gov/research/health-care-reform-topic-guide). The plan's failure is a reminder that rapport is a small modifier, not a guarantee of success. |
| John F. Kennedy / Robert F. Kennedy | Ally | Foreign Affairs, Justice: [crisis diplomacy](https://microsites.jfklibrary.org/cmc/oct23/doc1.html) and [legal/enforcement work in the administration](https://kennedyhumanrights.org/about-us/rfk-life-legacy/biography/). |
| Donald Trump / Hillary Clinton | Rival | Leader, Justice: direct electoral conflict and [threatened prosecution during the 2016 debate](https://www.debates.org/voter-education/debate-transcripts/october-9-2016-debate-transcript/). |
| Mikhail Gorbachev / Boris Yeltsin | Rival | Leader, Economy, Interior: [conflict over reform and central authority](https://history.state.gov/milestones/1989-1992/collapse-soviet-union). |

For **cabinet power**, at least one of the pair's actual ministries must match its listed fields. For a **crisis response**, the pair must be the two ministers sent together and the card's primary or supporting skill must match those fields. The crisis adjustment is **+2 for allies or −2 for rivals**. Neither country nor era alone creates an ally relationship. A cabinet relationship bonus is not added again to the crisis score.

## Choosing and answering crises

Every duel deals **five different public cards**: two options for each cabinet, plus one neutral card. Each duelist chooses one of their two options, creating a **three-crisis** duel with the neutral card. Which cabinet chooses first rotates between duels. A choice has a 45-second limit; a timeout chooses a card using the cabinet's abilities. These cards and selections are public in online and pass & play games.

For each of the three crises, choose **two distinct ministers**. Each minister can respond **only once in that duel**, so six ministers respond and one remains unused. Plan across all three cards before spending your strongest specialists. Their ministries stay fixed: you are choosing whom to send, not reshuffling the cabinet. A 45-second response timeout chooses a valid available pair.

Each minister contributes:

```text
2 × the card's primary skill
+ the card's supporting skill
+ 3 if assigned to the primary ministry, OR 2 if assigned to the supporting ministry
+ 2 for matching country, OR 1 for matching continent
+ 1 for matching era
```

Country and continent bonuses never stack, and neither do the two ministry bonuses. Add both ministers' contributions, any relevant pair rapport (**+2/−2**), and **one luck bonus of 0–2 for the whole response**. Cabinet power, fame and cabinet chemistry are not added to this calculation. The score breakdown shows what contributed.

For example, a minister with primary skill 8, support skill 6, the primary ministry, matching country and matching era contributes `16 + 6 + 3 + 2 + 1 = 28`. Their partner contributes separately. An allied pair's +2 is added once, followed by the single 0–2 luck bonus. Strong skills and a good assignment dominate the small random component.

The host resolves each random result once and shares it with the room. Reveal pacing stays at the established **5.5 seconds per crisis and 1.8 seconds of suspense**. The higher response score wins that crisis. The cabinet that wins **more of the three crises** wins the duel; equal numbers of crisis wins draw. A large response score does not become that many tournament points.

In **Group vote**, players judge the cabinets themselves. This remains a separate judging option; the game does not silently substitute a calculated crisis result for the vote. Bots can participate. The Hawk prefers Defence, the Reformer prefers Social Affairs, and the other personas retain their own drafting preferences. Bots also account for skills, assignments, relevant relationships, the value of remaining credits and crisis deployment.

## Tournament and room standings

A duel win gives **3 tournament points**; a draw gives **1 point to each cabinet**. This game's table breaks tied points by crisis wins, then cabinet power, then unspent credits. An exact tie across all those values shares a placing. In Group vote, there are no crisis-win advantages to break a tie.

The room leaderboard adds each finished game's tournament points and tracks **games won** and **games played**. Every completed game is counted once. If several players share first place after the game's tie-breaks, **each gets one game won**. The room table sorts by total points, then games won, then games played; names order otherwise equal records. Play again keeps player identities and totals; players who leave remain in the historical table, and new players start at zero. A new room starts a new leaderboard. These totals belong to the current room session, not a permanent global account.

## The pundit

The instant **house pundit** and optional **free AI pundit** use the **same mechanical numeric evaluation**. It compares cabinet power and the proportion of ministers whose assigned skill is at least 7/9. Because the power comparison is relative to the other cabinets in that game, its 10-point rating is not an absolute historical ranking. It awards no tournament points.

The free AI provides commentary and jokes only; even a number it invents cannot change the rating. Its instructions ask for relevant abilities and deployment advice, separate political criticism from mechanical competence, and forbid invented achievements or jokes about atrocities, deaths or protected traits. Unusable minister jokes are replaced individually by house jokes. All seven ministers receive a line, with a separate overall cabinet joke.

The optional model is **Llama 3.2 3B**, downloaded to a compatible browser through WebLLM and then cached (approximately 1.8 GB). It needs WebGPU and sufficient graphics memory. The host runs it in an online room. The house pundit works without that download; there is no API key or paid model integration.

## Balance notes for this follow-up

The audit kept most ratings. Examples of focused changes:

- **Robert F. Kennedy: Foreign Affairs 5 → 7**, while Justice stays 8. His [documented Cuban-crisis diplomatic work](https://microsites.jfklibrary.org/cmc/oct23/doc1.html) supports a stronger diplomacy specialization.
- **Ruth Bader Ginsburg: Social Affairs 7 → 5**, while Justice stays 9. Her [legal, judicial and teaching career](https://www.supremecourt.gov/about/biographyginsburg.aspx) strongly supports Justice; it does not establish equal experience administering welfare, health and education services.
- **Martin Luther King Jr.: Justice 7 → 5; Social Affairs 9 → 7**, while Leader stays 7. His [movement leadership](https://kinginstitute.stanford.edu/introduction) and [anti-poverty organizing](https://kinginstitute.stanford.edu/poor-peoples-campaign) remain strengths without making moral stature a substitute for professional legal or broad public-service administration experience.
- **Putin and Xi retain Interior 9; Deng Xiaoping retains Economy 9.** The audit did not lower specialist ratings because of regime type or raise all other fields automatically. Weaker skills remain meaningful.

The exact numbers are balancing judgments informed by public careers, not measurements supplied by these historical sources.

The earlier seven-seat expansion, 30-credit default, skill-led crises, small luck range, final free recruitment, optional hints, seven-seat pundit coverage and bot ministry preferences were already implemented. This follow-up completes public crisis-card choice, contextual ally/rival effects, the reference library, +10 bids and room totals, and removes the AI's influence over numeric ratings.

The old handoff's four-card hands, five-crisis duel, hidden weights, 100-point scale, percentage recipe and immediate one-credit random placement were alternative designs and were not adopted. They would replace established rules or conflict with final free recruitment. There is no duplicate hand mode, hidden-choice protocol, large die roll or parallel scoring system. `HANDOFF.md` remains historical context.

## Run locally and check changes

From the repository's top folder:

```sh
python3 -m http.server 8765
```

Then open [http://127.0.0.1:8765/politics/](http://127.0.0.1:8765/politics/). Keep the server running while playing; stop it with Ctrl+C. Online play also needs access to the configured MQTT broker. All state and random results remain authoritative on the host; guests render the shared state.

With Node.js available, run the focused checks from the same folder:

```sh
node --test politics/tests/*.test.cjs
```

The engine tests exercise game rules and JSON state boundaries. The pundit tests use mocked model responses to check numeric-score immunity, seven-minister output, token budget, joke safeguards and delayed results across Play again or a new session, without downloading an AI model. These checks do not replace real-browser, MQTT or on-device model tests.
