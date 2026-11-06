/* Run with: node --test politics/tests/engine.test.cjs
   No DOM, server or third-party dependencies. Online cases simulate the host's
   JSON state boundary; they do not claim to exercise an MQTT broker. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = (name) => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');
const exactCountries = ['MM', 'MY', 'LK', 'TL', 'NI', 'CR', 'VN', 'TW', 'SG'];
function fixture({ seed = 42, kind = 'local', humans = 2, bots = 0, settings = {}, wire = false } = {}) {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const sandbox = { window: {}, Math: Object.assign(Object.create(Math), { random }) };
  vm.runInNewContext(source('data.js'), sandbox, { filename: 'data.js' });
  vm.runInNewContext(source('engine.js'), sandbox, { filename: 'engine.js' });
  const CC = sandbox.window.CC, E = CC.Engine;
  const h = { CC, E, D: sandbox.window.CC_DATA, S: E.newState(kind), now: 1000, wire, acceptedBotActions: 0 };
  for (let n = 0; n < humans; n++) E.addPlayer(h.S, { name: 'Human ' + (n + 1) });
  for (let n = 0; n < bots; n++) E.addBot(h.S, ['easy', 'normal', 'hard'][n % 3]);
  h.host = h.S.players[0].id;
  h.sync = () => { if (wire) h.S = JSON.parse(JSON.stringify(h.S)); };
  h.act = (id, action) => {
    const ok = E.act(h.S, id, wire ? JSON.parse(JSON.stringify(action)) : action, h.now);
    h.sync();
    return ok;
  };
  h.expire = () => {
    assert(h.S.deadline > 0, `Missing timer in ${h.S.phase}`);
    h.now = Math.max(h.now + 1, h.S.deadline);
    const ok = E.tick(h.S, h.now);
    h.sync();
    assert(ok, `Timer did not advance ${h.S.phase}`);
  };
  assert(h.act(h.host, { t: 'set', patch: { mode: 'world', fame: 3, budget: 20, timer: 5, discards: 0, ...settings } }));
  h.start = () => {
    assert.equal(E.canStart(h.S), '');
    assert(h.act(h.host, { t: 'start' }));
    h.pool = new Set(E.poolFor(h.S.settings));
  };
  return h;
}
function unchanged(h, id, action) {
  const before = JSON.stringify(h.S);
  assert.equal(h.act(id, action), false, `Unexpectedly accepted ${JSON.stringify(action)}`);
  assert.equal(JSON.stringify(h.S), before, 'Rejected action mutated state');
}
function invariant(h) {
  const { S, E } = h;
  const owned = [];
  for (const p of S.players) {
    const t = S.teams[p.id];
    assert(Number.isInteger(t.cr) && t.cr >= 0 && t.cr <= S.settings.budget, `Bad balance for ${p.id}: ${t.cr}`);
    assert.equal(t.seats.length, 7);
    const filled = t.seats.filter(x => x !== null);
    assert.equal(t.buys.length, filled.length);
    const pendingCost = S.phase === 'assign' && S.sold.by === p.id ? S.sold.v : 0;
    assert.equal(t.buys.reduce((sum, b) => sum + b.v, 0) + pendingCost + t.cr, S.settings.budget);
    assert(t.buys.every(b => b.fill ? b.v === 0 && !b.rnd : b.v >= 1));
    owned.push(...filled);
  }
  assert.equal(new Set(owned).size, owned.length, 'A figure belongs to two seats');
  assert(owned.every(x => Number.isInteger(x) && h.pool.has(x)), 'Owned figure is outside the chosen deck');
  const remaining = S.deck.concat(S.discardPile);
  assert.equal(new Set(remaining).size, remaining.length, 'Duplicate in the remaining pool');
  assert(remaining.every(x => h.pool.has(x) && !owned.includes(x)), 'Owned/invalid figure remains available');
  if (S.phase === 'assign') assert(h.pool.has(S.sold.f) && !owned.includes(S.sold.f), 'Invalid pending recruit');
  const pending = ['auction', 'assign'].includes(S.phase) ? [S.cur] : [];
  const accounted = owned.concat(remaining, pending);
  assert.equal(accounted.length, h.pool.size, 'A figure disappeared from the selected deck');
  assert.equal(new Set(accounted).size, h.pool.size, 'A figure occupies multiple pool/ownership positions');
  if (!['auction', 'assign', 'sold'].includes(S.phase)) {
    assert(S.players.every(p => E.free(S, p.id) === 0), `Vacant cabinet entered ${S.phase}`);
  }
  // The host state, including every response/result, must cross the JSON boundary.
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(S)));
}
function placePending(h, seat) {
  assert.equal(h.S.phase, 'assign');
  const id = h.S.sold.by;
  const chosen = seat === undefined ? h.S.teams[id].seats.findIndex(x => x === null) : seat;
  assert(h.act(id, { t: 'seat', seat: chosen }));
  invariant(h);
  h.expire();
}
function purchase(h, id, amount, seat = 0) {
  assert.equal(h.S.phase, 'auction');
  assert(h.act(id, { t: 'bid', v: amount }));
  h.expire();
  assert.equal(h.S.phase, 'assign');
  assert.equal(h.S.sold.by, id);
  placePending(h, seat);
}
function formByTimeout(h, max = 10000) {
  for (let n = 0; h.S.phase !== 'cabinets'; n++) {
    assert(n < max, `Cabinet formation deadlocked in ${h.S.phase}`);
    invariant(h);
    h.expire();
  }
  invariant(h);
}
function showdownFixture(options = {}) {
  const h = fixture(options);
  h.start();
  formByTimeout(h);
  assert(h.act(h.host, { t: 'next' }));
  assert.equal(h.S.phase, 'briefing');
  assert(h.act(h.host, { t: 'next' }));
  while (h.S.phase === 'choose') assert(h.act(h.S.choiceTurn, { t: 'chooseCrisis', ci: h.E.bestCrisis(h.S, h.S.choiceTurn) }));
  return h;
}
function finishGame(h, max = 60000) {
  let steps = 0;
  while (h.S.phase !== 'final') {
    assert(++steps <= max, `Game deadlocked in ${h.S.phase}`);
    invariant(h);
    h.now += 500;
    for (const [id, action] of h.CC.Bots.think(h.S, h.now)) {
      if (h.act(id, action)) h.acceptedBotActions++;
    }
    const S = h.S;
    if (S.phase === 'auction' && !S.bid) {
      const p = S.players.find(p => !p.bot && h.E.maxBid(S, p.id) > 0 && !S.passed.includes(p.id));
      if (p) h.act(p.id, { t: 'bid', v: Math.min(2, h.E.maxBid(S, p.id)) });
    } else if (S.phase === 'assign' && !h.E.player(S, S.sold.by).bot) {
      const seat = S.teams[S.sold.by].seats.findIndex(x => x === null);
      assert(h.act(S.sold.by, { t: 'seat', seat }));
    } else if (S.phase === 'choose' && !h.E.player(S, S.choiceTurn).bot) {
      assert(h.act(S.choiceTurn, { t: 'chooseCrisis', ci: h.E.bestCrisis(S, S.choiceTurn) }));
    } else if (S.phase === 'respond' && !h.E.player(S, S.responseTurn).bot) {
      const d = S.duels[S.di], id = S.responseTurn;
      const seats = h.CC.SK.map((_, i) => i).filter(i => !d.used[id].includes(i)).slice(0, 2);
      assert(h.act(id, { t: 'respond', seats }));
    } else if (S.phase === 'cabinets' || S.phase === 'briefing') {
      assert(h.act(h.host, { t: 'next' }));
    } else if (S.phase === 'debate') {
      for (const p of S.players.filter(p => !p.bot)) h.act(p.id, { t: 'ready' });
    } else if (S.phase === 'vote') {
      for (const id of h.E.voters(S).filter(id => !h.E.player(S, id).bot)) h.act(id, { t: 'vote', w: 'a' });
    }
    if (['sold', 'duel', 'duelres'].includes(h.S.phase)) h.expire();
    else if (h.S.deadline && h.now >= h.S.deadline) { h.E.tick(h.S, h.now); h.sync(); }
  }
  invariant(h);
  assert(h.S.duels.every(d => ['a', 'b', 't'].includes(d.w)));
  const expected = Object.fromEntries(h.S.players.map(p => [p.id, { pts: 0, w: 0, d: 0, l: 0, cw: 0 }]));
  for (const d of h.S.duels) {
    const a = expected[d.a], b = expected[d.b];
    if (d.w === 'a') { a.pts += 3; a.w++; b.l++; }
    else if (d.w === 'b') { b.pts += 3; b.w++; a.l++; }
    else { a.pts++; b.pts++; a.d++; b.d++; }
    if (d.r.crises) {
      assert.equal(d.r.crises.length, 3);
      assert.equal(new Set(d.cards).size, 3);
      for (const id of [d.a, d.b]) {
        assert.equal(d.used[id].length, 6);
        assert.equal(new Set(d.used[id]).size, 6);
      }
      for (const c of d.r.crises) for (const side of ['A', 'B']) {
        assert([0, 1, 2].includes(c[side].roll));
        assert.equal(c[side].parts.length, 2);
        assert.equal(c[side].tot, c[side].parts.reduce((sum, p) => sum + p.v, 0) + c[side].rapport + c[side].roll);
      }
      a.cw += d.r.wa; b.cw += d.r.wb;
    }
  }
  for (const id of Object.keys(expected)) {
    assert.equal(h.S.scores[id], expected[id].pts);
    for (const key of ['w','d','l','cw']) assert.equal(h.S.rec[id][key], expected[id][key]);
  }
  assert.equal(h.E.standings(h.S).length, h.S.players.length);
  assert.doesNotThrow(() => h.E.awards(h.S));
  return steps;
}

test('all-in leaves multiple vacancies waiting until the solvent cabinet finishes', () => {
  const h = fixture(); h.start();
  const [a,b] = h.S.players.map(p => p.id);
  assert.equal(h.E.maxBid(h.S,a),20);
  purchase(h,a,20,6);
  assert.equal(h.S.teams[a].cr,0);
  assert.equal(h.E.free(h.S,a),6);
  unchanged(h,a,{t:'bid',v:1});
  for (let n=0;n<7;n++) {
    assert.equal(h.S.phase,'auction');
    assert.equal(h.S.filling,false);
    assert.equal(h.E.free(h.S,a),6);
    h.expire();
    assert.equal(h.S.sold.by,b,'An unbid paid lot was assigned to the broke player');
    assert.equal(h.S.sold.v,1);
    assert.equal(h.S.sold.rnd,true);
    placePending(h);
  }
  assert.equal(h.S.teams[b].cr,13);
  assert.equal(h.S.phase,'assign');
  assert.equal(h.S.filling,true);
  assert.equal(h.S.sold.by,a);
  const recruit=h.S.sold.f;
  assert.equal(h.S.sold.v,0);
  assert.equal(h.S.sold.fill,true);
  placePending(h,4);
  assert.equal(h.S.teams[a].seats[4],recruit,'Human choice of vacant ministry must be respected');
  formByTimeout(h);
  assert.equal(h.S.teams[a].cr,0);
  assert.equal(h.S.teams[a].buys.filter(b=>b.fill).length,6);
});

for (const count of [2,3,8]) test(`${count} players can all spend everything and complete cabinets`, () => {
  const h=fixture({humans:count,seed:count}); h.start();
  for (const p of h.S.players) purchase(h,p.id,20,0);
  assert(h.S.players.every(p=>h.S.teams[p.id].cr===0));
  assert.equal(h.S.filling,true);
  formByTimeout(h);
  assert(h.S.players.every(p=>h.S.teams[p.id].buys.filter(b=>b.fill).length===6));
});

test('several broke cabinets wait together while another player still buys', () => {
  const h=fixture({humans:3}); h.start();
  const [a,b,c]=h.S.players.map(p=>p.id);
  purchase(h,a,20); purchase(h,b,20);
  for (let n=0;n<7;n++) {
    assert.equal(h.S.filling,false);
    assert.equal(h.E.free(h.S,a),6); assert.equal(h.E.free(h.S,b),6);
    purchase(h,c,1,n);
  }
  assert.equal(h.S.filling,true); formByTimeout(h);
});

test('an exact 14-person filtered deck survives unlimited discards and recycling', () => {
  const h=fixture({settings:{mode:'countries',countries:exactCountries,discards:-1}});
  assert.equal(h.E.poolFor(h.S.settings).length,14);
  assert.equal(h.E.minPool(h.S),14); h.start();
  for (let n=0;n<14;n++) {
    assert.equal(h.S.phase,'auction'); h.expire();
    assert.equal(h.S.phase,'sold'); assert.equal(h.S.sold.by,null);
    h.expire();
  }
  assert.equal(h.S.noDisc,true); assert.equal(h.S.discUsed,14);
  assert.equal(h.S.discardPile.length,0);
  formByTimeout(h,100);
  assert.equal(h.S.deck.length,0);
  assert.equal(h.S.players.reduce((n,p)=>n+h.S.teams[p.id].buys.length,0),14);
  assert(h.S.players.every(p=>h.S.teams[p.id].buys.every(b=>b.rnd&&b.v===1)));
});

test('discarded figures join free final recruitment without duplicates on an exact deck', () => {
  const h=fixture({settings:{mode:'countries',countries:exactCountries,discards:-1}}); h.start();
  const discarded=[];
  for(let n=0;n<4;n++){discarded.push(h.S.cur);h.expire();h.expire();}
  for(const p of h.S.players) purchase(h,p.id,20);
  assert.equal(h.S.filling,true); assert.equal(h.S.discardPile.length,0);
  formByTimeout(h);
  const fills=h.S.players.flatMap(p=>h.S.teams[p.id].buys.filter(b=>b.fill).map(b=>b.f));
  assert(discarded.every(id=>fills.includes(id)));
  assert.equal(h.S.deck.length,0);
});

test('finite discard limit falls back to one-credit lots and final recruits time out to a valid ministry',()=>{
  const h=fixture({settings:{discards:3}});h.start();
  const [a,b]=h.S.players.map(p=>p.id);purchase(h,a,20,6);
  for(let n=0;n<3;n++){
    h.expire();assert.equal(h.S.phase,'sold');assert.equal(h.S.sold.by,null);h.expire();
  }
  assert.equal(h.S.discUsed,3);assert.equal(h.S.discardPile.length,3);
  for(let n=0;n<7;n++){
    h.expire();assert.equal(h.S.sold.by,b);assert.equal(h.S.sold.v,1);placePending(h);
  }
  assert.equal(h.S.phase,'assign');assert.equal(h.S.sold.fill,true);
  const f=h.S.sold.f;
  const open=h.S.teams[a].seats.map((x,i)=>x===null?i:-1).filter(i=>i>=0);
  const highest=Math.max(...open.map(i=>h.E.seatScore(f,h.CC.SK[i])));
  const before=JSON.stringify(h.S);
  assert.equal(h.E.tick(h.S,h.S.deadline-1),false);
  assert.equal(JSON.stringify(h.S),before,'A deadline must not fire early');
  h.expire();
  const bought=h.S.teams[a].buys.at(-1);
  assert.equal(bought.f,f);assert.equal(bought.v,0);assert.equal(bought.fill,true);
  assert.equal(h.E.seatScore(f,h.CC.SK[bought.seat]),highest);
  h.expire();formByTimeout(h);
});

test('invalid bids and placements do not mutate the host state',()=>{
  const h=fixture();h.start(); const [a,b]=h.S.players.map(p=>p.id);
  for(const v of [0,-1,1.5,'2',NaN,Infinity,21]) unchanged(h,a,{t:'bid',v});
  unchanged(h,'absent',{t:'bid',v:1});
  assert(h.act(a,{t:'bid',v:5}));
  unchanged(h,a,{t:'bid',v:6}); unchanged(h,b,{t:'bid',v:5});
  assert(h.act(b,{t:'pass'})); unchanged(h,b,{t:'bid',v:6});
  h.expire();
  for(const seat of [-1,7,0.5,'0']) unchanged(h,a,{t:'seat',seat});
  unchanged(h,b,{t:'seat',seat:0});
  placePending(h,0); purchase(h,a,1,1);
  assert(h.act(a,{t:'bid',v:1})); h.expire();
  unchanged(h,a,{t:'seat',seat:0});
  h.expire(); assert.equal(h.S.phase,'sold'); invariant(h);
});

test('deck size guard uses all seven seats and rejects undersized filters',()=>{
  const h=fixture({settings:{mode:'countries',countries:['MM']}});
  assert.equal(h.E.minPool(h.S),14);
  assert.match(h.E.canStart(h.S),/need 14/);
  unchanged(h,h.host,{t:'start'});
  assert.equal(h.CC.SEATS.length,7);
  assert.equal(h.CC.SK.join(''),'LEFIJDS');
  assert.equal(new Set(h.CC.CRISES.map(c=>c.p)).size,7);
});

test('career ability outweighs the complete 0–2 luck range; fame is only a cabinet +1',()=>{
  const h=showdownFixture(); const id=h.S.players[0].id;
  const find=n=>h.D.POLS.find(p=>p.n===n).i;
  const strong=find('Alexander Hamilton'), weak=find('Jan Žižka'), second=find('Ruth Bader Ginsburg');
  h.S.teams[id].seats=[0,strong,2,3,4,5,second];
  const high=h.E.responseScore(h.S,id,8,[1,6],0);
  h.S.teams[id].seats[1]=weak;
  const low=h.E.responseScore(h.S,id,8,[1,6],2);
  assert(high.tot>low.tot+10,'A substantial relevant skill advantage must survive maximum opposing luck');
  assert.equal(high.parts[0].primary,9);
  assert.equal(high.parts[0].ability,21);
  h.S.teams[id].seats[1]=strong;
  const f=h.D.POLS[strong], before=h.E.responseScore(h.S,id,8,[1,6],0).tot;
  const normal=h.E.seatScore(strong,'E'); f.t=1;
  assert.equal(h.E.seatScore(strong,'E'),normal+1);
  assert.equal(h.E.responseScore(h.S,id,8,[1,6],0).tot,before,'Do not apply fame again to crisis scores');
  f.t=3; assert.equal(h.E.responseScore(h.S,id,8,[1,6],0).tot,before);
});

test('geography does not stack, period gives +1, and both assigned portfolios matter',()=>{
  const h=showdownFixture(); const id=h.S.players[0].id;
  for(let i=0;i<7;i++){
    const f=h.D.POLS[i];f.c='US';f.e='h';f.t=2;f.sk=Object.fromEntries(h.CC.SK.map(k=>[k,5]));
  }
  h.S.teams[id].seats=[0,1,2,3,4,5,6];
  const aligned=h.E.responseScore(h.S,id,0,[0,4],0);
  assert.equal(aligned.parts[0].geography,2);
  assert.equal(aligned.parts[0].era,1);
  assert.equal(aligned.parts[0].portfolio,3);
  assert.equal(aligned.parts[1].portfolio,2);
  h.D.POLS[0].c='CA';
  assert.equal(h.E.responseScore(h.S,id,0,[0,4],0).parts[0].geography,1);
  h.D.POLS[0].c='JP';h.D.POLS[0].e='m';
  const away=h.E.responseScore(h.S,id,0,[0,4],0);
  assert.equal(away.parts[0].geography,0);assert.equal(away.parts[0].era,0);
  h.D.POLS[0].c='US';h.D.POLS[0].e='h';
  h.S.teams[id].seats=[1,0,4,3,2,5,6];
  const unassigned=h.E.responseScore(h.S,id,0,[1,2],0);
  assert.equal(aligned.tot-unassigned.tot,5);
  // Changing unused ministers/chemistry cannot change the selected response.
  h.D.POLS[3].c='JP';h.D.POLS[5].c='BR';h.D.POLS[6].e='m';
  assert.equal(h.E.responseScore(h.S,id,0,[1,2],0).tot,unassigned.tot);
});

test('each minister responds once per duel; invalid/off-turn/reused choices are rejected',()=>{
  const h=showdownFixture();const d=h.S.duels[h.S.di];
  assert.equal(h.S.phase,'respond');
  unchanged(h,h.S.responseTurn==='p1'?'p2':'p1',{t:'respond',seats:[0,1]});
  unchanged(h,'absent',{t:'respond',seats:[0,1]});
  for(const seats of [null,[],[0],[0,0],[0,1,2],[-1,1],[0,7],[0,1.5],['0',1]]) unchanged(h,h.S.responseTurn,{t:'respond',seats});
  for(let ci=0;ci<3;ci++){
    const used=ci*2;
    if(ci) unchanged(h,h.S.responseTurn,{t:'respond',seats:[0,used]});
    for(let n=0;n<2;n++) assert(h.act(h.S.responseTurn,{t:'respond',seats:[used,used+1]}));
    assert.equal(h.S.phase,'duel');
    unchanged(h,d.a,{t:'respond',seats:[5,6]});
    assert(h.act(h.host,{t:'next'}));
  }
  assert.equal(h.S.phase,'duelres');
  for(const id of [d.a,d.b]) assert.equal(new Set(d.used[id]).size,6);
  const scored=JSON.stringify(h.S.scores);
  unchanged(h,h.host,{t:'gvote',w:'a'});
  assert.equal(JSON.stringify(h.S.scores),scored);
});

function foresightFixture(bot=false){
  const h=showdownFixture({humans:bot?1:2,bots:bot?1:0});
  const id=bot?h.S.players.find(p=>p.bot).id:h.S.players[0].id;
  h.S.teams[id].seats=[0,1,2,3,4,5,6];
  for(let i=0;i<7;i++) { const f=h.D.POLS[i];f.c='US';f.e='m';f.t=3;f.sk=Object.fromEntries(h.CC.SK.map(k=>[k,1])); }
  Object.assign(h.D.POLS[0].sk,{E:9,S:9});Object.assign(h.D.POLS[1].sk,{E:8,S:8});
  Object.assign(h.D.POLS[2].sk,{E:9});Object.assign(h.D.POLS[3].sk,{E:8});
  Object.assign(h.D.POLS[4].sk,{F:9,L:9});Object.assign(h.D.POLS[5].sk,{F:8,L:8});
  const d=h.S.duels[h.S.di];d.cards=[1,13,9];d.used[id]=[];d.responses[id]=null;
  h.S.crisisIndex=0;h.S.responseTurn=id;h.S.phase='respond';h.S.deadline=h.now+45000;
  return {h,id,d};
}
test('timeout plans across all three visible cards instead of spending the best specialist immediately',()=>{
  const {h,id,d}=foresightFixture();
  const selected=Array.from(h.E.bestResponse(h.S,id));
  assert.deepEqual(selected,[2,3]);
  const greedy=h.E.responseScore(h.S,id,d.cards[0],[0,1]).tot;
  assert(greedy>h.E.responseScore(h.S,id,d.cards[0],selected).tot);
  h.expire();
  assert.deepEqual(Array.from(d.responses[id]),selected);
  assert.equal(d.used[id].length,2);
});

test('bots make the same forward-looking crisis choice before their timeout',()=>{
  const {h,id,d}=foresightFixture(true);
  h.CC.Bots.think(h.S,h.now);
  h.now+=2000;
  const action=h.CC.Bots.think(h.S,h.now).find(([pid,a])=>pid===id&&a.t==='respond');
  assert(action);assert.deepEqual(Array.from(action[1].seats),[2,3]);
  assert(h.act(id,action[1]));assert.equal(d.used[id].length,2);
});

test('group voting retains spectator voting, manual judging and tournament points',()=>{
  const h=showdownFixture({humans:3,settings:{judge:'vote'}});
  assert.equal(h.S.phase,'debate');const d=h.S.duels[h.S.di];
  for(const p of h.S.players) assert(h.act(p.id,{t:'ready'}));
  assert.equal(h.S.phase,'vote');const voters=Array.from(h.E.voters(h.S));assert.equal(voters.length,1);
  unchanged(h,d.a,{t:'vote',w:'a'});unchanged(h,voters[0],{t:'vote',w:'t'});
  assert(h.act(voters[0],{t:'vote',w:'b'}));assert.equal(h.S.scores[d.b],3);
  assert.equal(h.S.phase,'duelres');unchanged(h,voters[0],{t:'vote',w:'b'});
  assert(h.act(h.host,{t:'next'}));assert.equal(h.S.phase,'debate');
  const next=h.S.duels[h.S.di];assert(h.act(h.host,{t:'gvote',w:'t'}));
  assert.equal(next.w,'t');finishGame(h);
});

for(const config of [
  {kind:'solo',humans:1,bots:2,seed:12},
  {kind:'local',humans:3,bots:1,seed:13},
  {kind:'online',humans:2,bots:2,seed:14,wire:true},
  {kind:'local',humans:0,bots:2,seed:15},
  {kind:'local',humans:0,bots:8,seed:16},
  {kind:'online',humans:3,bots:2,seed:17,wire:true,settings:{judge:'vote'}},
]) test(`complete ${config.kind} game: ${config.humans} humans, ${config.bots} bots${config.settings?.judge==='vote'?', group voting':''}`,()=>{
  const h=fixture(config);h.start();finishGame(h);
  const n=h.S.players.length;assert.equal(h.S.duels.length,n*(n-1)/2);
  assert(h.acceptedBotActions>0,'Bot auction/response actions were actually exercised');
});

test('replay resets paid/free purchases, fatigue, points, discards and bot memory',()=>{
  const h=fixture({kind:'online',humans:1,bots:2,wire:true,seed:99});h.start();finishGame(h);
  const ids=h.S.players.map(p=>p.id);
  assert(h.act(h.host,{t:'again'}));assert.equal(h.S.phase,'lobby');
  h.start();assert.equal(h.S.lot,1);assert.equal(h.S.filling,false);assert.equal(h.S.discUsed,0);
  assert.equal(h.S.discardPile.length,0);assert.equal(h.S.duels.length,0);
  assert.deepEqual(h.S.players.map(p=>p.id),ids);
  for(const id of ids){assert.equal(h.S.scores[id],0);assert.equal(h.S.teams[id].buys.length,0);assert.equal(h.S.teams[id].cr,20);}
  finishGame(h);
});
