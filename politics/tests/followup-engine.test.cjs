/* Focused follow-up regressions. Run: node --test politics/tests/*.test.cjs */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture({ humans = 2, bots = 0, kind = 'local', judge = 'crisis', wire = false, seed = 314 } = {}) {
  let state = seed;
  const math = Object.assign(Object.create(Math), { random: () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296) });
  const sandbox = { window: {}, Math: math };
  for (const name of ['data.js', 'engine.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8'), sandbox);
  const CC = sandbox.window.CC, E = CC.Engine;
  const h = { CC, E, D: sandbox.window.CC_DATA, S: E.newState(kind), now: 1000, choices: 0, responses: 0 };
  for (let i = 0; i < humans; i++) E.addPlayer(h.S, { name: 'Player ' + (i + 1) });
  for (let i = 0; i < bots; i++) E.addBot(h.S, i % 2 ? 'hard' : 'normal');
  h.host = h.S.players[0].id;
  h.sync = () => { if (wire) h.S = JSON.parse(JSON.stringify(h.S)); };
  h.act = (id, action) => { const ok = E.act(h.S, id, action, h.now); h.sync(); return ok; };
  h.expire = () => {
    assert(h.S.deadline > 0, 'No deadline in ' + h.S.phase);
    h.now = h.S.deadline;
    assert(E.tick(h.S, h.now), 'Timeout failed in ' + h.S.phase);
    h.sync();
  };
  assert(h.act(h.host, { t: 'set', patch: { mode: 'world', discards: 0, judge } }));
  h.start = () => assert(h.act(h.host, { t: 'start' }));
  h.find = (name) => { const p = h.D.POLS.find((p) => p.n === name); assert(p, name); return p.i; };
  return h;
}
function form(h) {
  for (let i = 0; h.S.phase !== 'cabinets'; i++) { assert(i < 300); h.expire(); }
  assert(h.S.players.every((p) => h.E.free(h.S, p.id) === 0));
  const occupied = h.S.players.flatMap((p) => h.S.teams[p.id].seats);
  assert.equal(new Set(occupied).size, occupied.length);
}
function showdown(h) {
  h.start(); form(h);
  assert(h.act(h.host, { t: 'next' })); assert.equal(h.S.phase, 'briefing');
  assert(h.act(h.host, { t: 'next' }));
}
function finish(h, vote = 'a') {
  for (let i = 0; h.S.phase !== 'final'; i++) {
    assert(i < 1000, 'Deadlock: ' + h.S.phase);
    h.now += 2000;
    for (const [id, action] of h.CC.Bots.think(h.S, h.now)) if (h.act(id, action)) {
      if (action.t === 'chooseCrisis') h.choices++;
      if (action.t === 'respond') h.responses++;
    }
    if (['cabinets', 'briefing'].includes(h.S.phase)) assert(h.act(h.host, { t: 'next' }));
    else if (h.S.phase === 'debate' || h.S.phase === 'vote') assert(h.act(h.host, { t: 'gvote', w: vote }));
    else if (h.S.phase !== 'final') h.expire();
  }
  assert(h.S.duels.every((d) => ['a', 'b', 't'].includes(d.w)));
  assert.equal(h.S.gameCounted, true);
}
function rejected(h, id, a) {
  const before = JSON.stringify(h.S);
  assert.equal(h.act(id, a), false);
  assert.equal(JSON.stringify(h.S), before);
}
function slots(h, names) { return h.CC.SK.map((_, i) => names[i] ? h.find(names[i]) : null); }
function snapshot(value) { return JSON.parse(JSON.stringify(value)); }

test('cabinet rapport requires documented pair and relevant assigned ministries, and caps at +2', () => {
  const h = fixture();
  let seats = slots(h, ['Barack Obama', null, 'Joe Biden']);
  assert.equal(h.E.workingRelations(seats).length, 0, 'Leader/Foreign are outside this Recovery Act relationship');
  seats = slots(h, [null, 'Barack Obama', null, 'Joe Biden']);
  const r = h.E.workingRelations(seats);
  assert.equal(r.length, 1); assert.equal(r[0].v, 1); assert.deepEqual(Array.from(r[0].context), ['E']);
  assert.equal(h.E.chemistry(seats).find((x) => x.k === 'rapport').v, 1);
  seats = slots(h, ['Bill Clinton', 'Barack Obama', 'Margaret Thatcher', 'Joe Biden', null, 'Ronald Reagan', 'Hillary Clinton']);
  const positive = h.E.chemistry(seats).find((x) => x.k === 'rapport');
  assert.equal(positive.detail.length, 3); assert.equal(positive.detail.reduce((s, r) => s + r.v, 0), 3);
  assert.equal(positive.v, 2, 'Three allies must not overwhelm skills');
  const rivals = slots(h, ['Donald Trump', 'Mikhail Gorbachev', null, 'Boris Yeltsin', 'Hillary Clinton']);
  const negative = h.E.chemistry(rivals).find((x) => x.k === 'rapport');
  assert.equal(negative.v, -2); assert.equal(negative.detail.length, 2);
});

test('country context and complementary specialists remain small, independent of relationship status', () => {
  const h = fixture();
  const sameCountry = slots(h, ['George Washington', 'Alexander Hamilton', 'Thomas Jefferson']);
  assert.equal(h.E.workingRelations(sameCountry).length, 0);
  assert.equal(h.E.chemistry(sameCountry).find((x) => x.k === 'home').v, 1);
  const countries = ['US', 'GB', 'JP', 'ZA', 'BR', 'IN', 'CA'];
  for (let i = 0; i < 7; i++) {
    const p = h.D.POLS[i]; p.c = countries[i]; p.e = i % 2 ? 'h' : 'm'; p.t = 3;
    p.sk = Object.fromEntries(h.CC.SK.map((k) => [k, 3])); p.sk[h.CC.SK[i]] = 7;
  }
  const mixed = [0, 1, 2, 3, 4, 5, 6], chem = h.E.chemistry(mixed);
  assert.equal(chem.find((x) => x.k === 'global').v, 2);
  assert.equal(chem.find((x) => x.k === 'fit').v, 3);
  assert(!chem.some((x) => x.k === 'era' || x.k === 'home' || x.k === 'rapport'));
  assert.equal(h.E.power(mixed), 49 + 2 + 3);
});

test('crisis rapport uses only the actual pair and relevant scenario, once, without cabinet double counting', () => {
  const h = fixture(); h.start(); const id = h.host;
  h.S.teams[id].seats = slots(h, ['Joe Biden', 'Barack Obama', 'Margaret Thatcher', 'George Washington', 'Thomas Jefferson', 'Ronald Reagan', 'Alexander Hamilton']);
  const response = h.E.responseScore(h.S, id, 8, [0, 1], 2);
  assert.equal(response.rapport, 2); assert.equal(response.relations.length, 1);
  assert.equal(response.tot, response.parts.reduce((s, p) => s + p.v, 0) + 2 + 2);
  assert.equal(h.E.responseScore(h.S, id, 0, [0, 1]).rapport, 0, 'An unrelated constitution card gets no Recovery Act rapport');
  assert.equal(h.E.responseScore(h.S, id, 8, [1]).rapport, 0, 'Single-minister previews must not claim a pair bonus');
  assert.equal(h.E.responseScore(h.S, id, 8, [1, 6]).rapport, 0, 'An unused ally does not contribute');
  const unchanged = response.tot;
  h.S.teams[id].seats[2] = h.find('Vladimir Putin'); h.S.teams[id].seats[5] = h.find('Xi Jinping');
  assert.equal(h.E.responseScore(h.S, id, 8, [0, 1], 2).tot, unchanged);
  h.S.teams[id].seats = slots(h, ['Donald Trump', 'Alexander Hamilton', 'George Washington', 'Thomas Jefferson', 'Hillary Clinton', 'Joe Biden', 'Barack Obama']);
  assert.equal(h.E.responseScore(h.S, id, 0, [0, 4]).rapport, -2);
  assert.equal(h.E.responseScore(h.S, id, 13, [0, 4]).rapport, 0);
});

test('skills govern representative democratic and authoritarian figures without a regime or virtue multiplier', () => {
  const h = fixture(); h.start(); const id = h.host;
  const names = ['Vladimir Putin', 'Xi Jinping', 'Barack Obama', 'Ruth Bader Ginsburg'];
  for (const name of names) {
    const fi = h.find(name), f = h.D.POLS[fi];
    h.S.teams[id].seats = slots(h, ['George Washington', 'Alexander Hamilton', 'Thomas Jefferson', name, 'John Adams', 'James Madison', 'Abraham Lincoln']);
    const before = snapshot({ power: h.E.power(h.S.teams[id].seats), response: h.E.responseScore(h.S, id, 17, [3]), seats: h.CC.SK.map((k) => h.E.seatScore(fi, k)) });
    f.democracy = 100; f.virtue = 100; f.regime = 'democratic';
    assert.deepEqual(snapshot({ power: h.E.power(h.S.teams[id].seats), response: h.E.responseScore(h.S, id, 17, [3]), seats: h.CC.SK.map((k) => h.E.seatScore(fi, k)) }), before);
    f.democracy = 0; f.virtue = 0; f.regime = 'authoritarian';
    assert.equal(h.E.responseScore(h.S, id, 17, [3]).tot, before.response.tot);
    const old = f.sk.I; f.sk.I = 1;
    assert.equal(before.response.tot - h.E.responseScore(h.S, id, 17, [3]).tot, 2 * (old - 1));
    f.sk.I = old;
  }
});

test('five unique public offers yield exactly one choice per player plus neutral; invalid actions are inert', () => {
  const h = fixture({ wire: true }); showdown(h);
  assert.equal(h.S.phase, 'choose'); assert.equal(h.S.dur, 45000);
  let d = h.S.duels[h.S.di];
  assert.equal(new Set([...d.offers[d.a], ...d.offers[d.b], d.neutral]).size, 5);
  assert.equal(h.S.choiceTurn, d.a); assert.equal(d.cards.length, 0);
  const first = h.S.choiceTurn, other = d.b, chosen = d.offers[first][1];
  rejected(h, other, { t: 'chooseCrisis', ci: d.offers[other][0] });
  rejected(h, 'missing', { t: 'chooseCrisis', ci: chosen });
  for (const ci of [d.neutral, d.offers[other][0], -1, 1.5, String(chosen)]) rejected(h, first, { t: 'chooseCrisis', ci });
  rejected(h, first, { t: 'respond', seats: [0, 1] });
  assert(h.act(first, { t: 'chooseCrisis', ci: chosen }));
  assert.equal(h.S.choiceTurn, other);
  d = h.S.duels[h.S.di]; assert.equal(d.picks[first], chosen, 'Pick must remain public after JSON transmission');
  rejected(h, first, { t: 'chooseCrisis', ci: d.offers[first][0] });
  const selectedOther = d.offers[other][0], neutral = d.neutral;
  assert(h.act(other, { t: 'chooseCrisis', ci: selectedOther }));
  assert.equal(h.S.phase, 'respond'); assert.equal(h.S.choiceTurn, null);
  assert.deepEqual(h.S.duels[h.S.di].cards, [chosen, selectedOther, neutral]);
  rejected(h, other, { t: 'chooseCrisis', ci: selectedOther });
});

test('choice timeout and bot pick prefer a card suited to their cabinet against the opposing cabinet', () => {
  for (const bot of [false, true]) {
    const h = fixture({ humans: bot ? 1 : 2, bots: bot ? 1 : 0 }); showdown(h);
    const d = h.S.duels[h.S.di], id = bot ? d.b : d.a, other = id === d.a ? d.b : d.a;
    for (const [pid, offset] of [[id, 0], [other, 7]]) {
      h.S.teams[pid].seats = h.CC.SK.map((_, i) => i + offset);
      for (const fi of h.S.teams[pid].seats) {
        const p = h.D.POLS[fi]; p.c = 'US'; p.e = 'm'; p.t = 3;
        p.sk = Object.fromEntries(h.CC.SK.map((k) => [k, ['E', 'S'].includes(k) ? pid === id ? 9 : 1 : 4]));
      }
    }
    d.offers = { [id]: [17, 8], [other]: [0, 2] }; d.neutral = 4; d.picks = { [id]: null, [other]: null };
    h.S.choiceTurn = id;
    const before = JSON.stringify(h.S);
    assert.equal(h.E.bestCrisis(h.S, id), 8); assert.equal(JSON.stringify(h.S), before, 'Planning must not mutate the room');
    if (bot) {
      h.CC.Bots.think(h.S, h.now); h.now += 2000;
      const action = h.CC.Bots.think(h.S, h.now).find(([pid, a]) => pid === id && a.t === 'chooseCrisis');
      assert(action); assert.equal(action[1].ci, 8); assert(h.act(id, action[1]));
    } else h.expire();
    assert.equal(d.picks[id], 8); assert.equal(h.S.choiceTurn, other);
  }
});

test('choice starter alternates by duel while the prior reveal stays 5.5 seconds', () => {
  const h = fixture({ humans: 3 }); showdown(h);
  assert.equal(h.S.choiceTurn, h.S.duels[0].a);
  while (h.S.phase === 'choose') h.expire();
  for (let ci = 0; ci < 3; ci++) {
    for (let t = 0; t < 2; t++) h.expire();
    assert.equal(h.S.phase, 'duel'); assert.equal(h.S.dur, 5500);
    h.expire();
  }
  assert.equal(h.S.phase, 'duelres'); h.expire();
  assert.equal(h.S.di, 1); assert.equal(h.S.phase, 'choose'); assert.equal(h.S.choiceTurn, h.S.duels[1].b);
});

for (const judge of ['crisis', 'vote']) test(`${judge} complete/repeat games update room once and retain inactive players, names, and stable identities`, () => {
  const h = fixture({ humans: 2, bots: 1, judge, wire: true }); h.start(); finish(h);
  const room = snapshot(h.S.room), ids = h.S.players.map((p) => p.id);
  assert.equal(room.games, 1);
  for (const p of h.S.players) {
    assert.equal(room.rows[p.id].games, 1); assert.equal(room.rows[p.id].pts, h.S.scores[p.id]);
    assert.equal(room.rows[p.id].wins, h.E.gameWinners(h.S).includes(p.id) ? 1 : 0);
  }
  assert.equal(h.E.tick(h.S, h.now + 1000000), false);
  rejected(h, h.host, { t: 'next' }); rejected(h, h.host, { t: 'gvote', w: 'a' });
  assert.deepEqual(snapshot(h.S.room), room);
  assert(h.act(h.host, { t: 'again' })); assert.deepEqual(snapshot(h.S.room), room);
  rejected(h, h.host, { t: 'again' });
  assert(h.act(h.host, { t: 'rename', id: h.host, name: 'Returning player' }));
  assert.equal(h.S.room.rows[h.host].name, 'Returning player');
  assert(h.act(h.host, { t: 'remove', id: ids[1] }));
  assert(h.act(h.host, { t: 'addHuman', name: 'New player' }));
  const joined = h.S.players.find((p) => !ids.includes(p.id)); assert(joined);
  assert.equal(h.S.room.rows[joined.id].games, 0); assert.equal(h.S.room.rows[joined.id].pts, 0);
  assert.equal(h.E.roomStandings(h.S).find((r) => r.id === ids[1]).active, false);
  h.start(); assert.equal(h.S.gameCounted, false); finish(h);
  assert.equal(h.S.room.games, 2);
  assert.equal(h.S.room.rows[h.host].games, 2);
  assert.equal(h.S.room.rows[joined.id].games, 1);
  assert.deepEqual(snapshot(h.S.room.rows[ids[1]]), room.rows[ids[1]], 'Departed totals are historical, not reset or recounted');
  assert.equal(h.S.room.rows[h.host].pts, room.rows[h.host].pts + h.S.scores[h.host]);
  assert(h.E.roomStandings(h.S).every((r) => typeof r.active === 'boolean'));
});

test('exact final ties share a game win, using points, crisis wins, power, then credits as tie breaks', () => {
  const h = fixture({ judge: 'vote' }); h.start(); form(h);
  const [a, b] = h.S.players.map((p) => p.id);
  for (const fi of h.S.teams[a].seats.concat(h.S.teams[b].seats)) {
    const p = h.D.POLS[fi]; p.c = 'US'; p.e = 'm'; p.t = 3; p.n = 'Tie figure ' + fi;
    p.sk = Object.fromEntries(h.CC.SK.map((k) => [k, 5]));
  }
  finish(h, 't');
  assert.deepEqual(Array.from(h.E.gameWinners(h.S)), [a, b]);
  assert.equal(h.S.room.rows[a].wins, 1); assert.equal(h.S.room.rows[b].wins, 1);
  assert.equal(h.S.room.rows[a].pts, 1); assert.equal(h.S.room.rows[b].pts, 1);
  h.S.teams[b].cr++; assert.deepEqual(Array.from(h.E.gameWinners(h.S)), [b]);
  h.S.rec[a].cw++; assert.deepEqual(Array.from(h.E.gameWinners(h.S)), [a]);
  h.S.scores[b]++; assert.deepEqual(Array.from(h.E.gameWinners(h.S)), [b]);
});

for (const judge of ['crisis', 'vote']) test(`bots-only ${judge} showdown resolves every duel and counts one room game`, () => {
  const h = fixture({ humans: 0, bots: 4, judge, wire: true }); showdown(h);
  assert.equal(h.S.phase, 'final'); assert.equal(h.S.duels.length, 6); assert.equal(h.S.room.games, 1);
  for (const d of h.S.duels) {
    assert(['a', 'b', 't'].includes(d.w));
    if (judge === 'crisis') {
      assert.equal(d.r.crises.length, 3); assert.equal(new Set(d.cards).size, 3);
      assert(d.offers[d.a].includes(d.picks[d.a])); assert(d.offers[d.b].includes(d.picks[d.b]));
      assert.equal(d.cards[2], d.neutral);
      for (const pid of [d.a, d.b]) assert.equal(new Set(d.used[pid]).size, 6);
    }
  }
});
