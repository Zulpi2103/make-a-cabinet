/* Run with: node --test politics/tests/ui-pundit.test.cjs
   Loads the complete UI and engine with a minimal DOM and deferred model calls.
   Uses real click handlers and lifecycle actions; no browser/model download. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = (name) => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');

function fixture() {
  const listeners = {}, calls = [];
  const sandbox = {
    window: { addEventListener() {}, scrollTo() {} },
    document: { getElementById: () => ({}), addEventListener: (name, fn) => { listeners[name] = fn; } },
    localStorage: { getItem: () => null, setItem() {} },
    navigator: {}, location: { search: '', pathname: '/politics/', origin: 'http://localhost' },
    history: { replaceState() {} }, URLSearchParams, confirm: () => true,
    requestAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  };
  vm.runInNewContext(source('data.js'), sandbox, { filename: 'data.js' });
  vm.runInNewContext(source('engine.js'), sandbox, { filename: 'engine.js' });
  const CC = sandbox.window.CC;
  CC.Net = { conns: new Map(), close() {}, broadcast() {} };
  CC.Sound = { muted: true, play() {}, toggle() {} };
  CC.Img = { get: () => null, prefetch: () => Promise.resolve() };
  CC.Pundit = {
    askFree: (state, progress) => new Promise((resolve, reject) => calls.push({ state, progress, resolve, reject })),
    house: () => ({ source: 'house' }),
  };
  vm.runInNewContext(source('ui.js'), sandbox, { filename: 'ui.js' });
  const app = CC.app;
  const click = (action) => listeners.click({ target: { closest: () => ({ dataset: { a: action }, disabled: false }) } });
  function completeCabinets(phase = 'final') {
    const S = app.S;
    S.phase = phase;
    S.teams = {};
    S.players.forEach((p, pi) => {
      const seats = Array.from({ length: 7 }, (_, si) => pi * 7 + si);
      S.teams[p.id] = { cr: 0, seats, buys: seats.map((f, seat) => ({ f, seat, v: 0, fill: true })) };
    });
  }
  click('local');
  completeCabinets();
  return { CC, app, click, calls, completeCabinets };
}

test('Play again invalidates an old AI request without clearing its replacement', async () => {
  const h = fixture(), S = h.app.S;
  const first = h.click('askFree'), old = h.calls[0];
  assert.notEqual(old.state, S, 'The AI must receive a snapshot, not mutable live state');
  assert.notEqual(old.state.teams, S.teams);
  old.progress('Old game progress');
  assert.equal(h.app.pundProgress, 'Old game progress');

  h.click('again');
  assert.equal(S.phase, 'lobby');
  assert.equal(h.app.pundBusy, false);
  assert.equal(h.app.pundProgress, '');
  old.progress('Late progress from the old game');
  assert.equal(h.app.pundProgress, '');
  h.click('start');
  assert.equal(S.phase, 'auction');
  assert.equal(old.state.phase, 'final', 'A game restart must not mutate the AI snapshot');
  assert(old.state.teams[S.players[0].id].seats.every((fi) => fi !== null));

  h.completeCabinets('cabinets');
  const second = h.click('askFree'), next = h.calls[1];
  next.progress('New game progress');
  old.resolve({ source: 'free', marker: 'old game' });
  await first;
  assert.equal(S.pundit, null);
  assert.equal(h.app.pundBusy, true, 'Old completion must not clear the new request');
  assert.equal(h.app.pundProgress, 'New game progress');
  next.resolve({ source: 'free', marker: 'new game' });
  await second;
  assert.equal(S.pundit.marker, 'new game');
  assert.equal(h.app.pundBusy, false);
  assert.equal(h.app.pundRequest, null);
});

test('leaving and creating another session blocks stale AI errors and progress', async () => {
  const h = fixture(), oldState = h.app.S;
  const first = h.click('askFree'), old = h.calls[0];
  h.click('home');
  assert.equal(h.app.S, null);
  assert.equal(h.app.pundBusy, false);
  h.click('local');
  h.completeCabinets('cabinets');
  const S = h.app.S;
  assert.notEqual(S, oldState);
  const second = h.click('askFree'), next = h.calls[1];
  next.progress('Current session progress');
  old.progress('Stale session progress');
  old.reject(new Error('Failure from the previous session'));
  await first;
  assert.equal(h.app.pundErr, '');
  assert.equal(h.app.pundProgress, 'Current session progress');
  assert.equal(h.app.pundBusy, true);
  next.resolve({ source: 'free', marker: 'current session' });
  await second;
  assert.equal(S.pundit.marker, 'current session');
  assert.equal(h.app.pundBusy, false);
});

test('a current AI failure clears its own busy state and remains actionable', async () => {
  const h = fixture();
  const promise = h.click('askFree');
  h.calls[0].reject(new Error('Graphics memory exhausted'));
  await promise;
  assert.equal(h.app.pundBusy, false);
  assert.equal(h.app.pundRequest, null);
  assert.equal(h.app.pundErr, 'Graphics memory exhausted');
  h.click('askHouse');
  assert.equal(h.app.S.pundit.source, 'house');
  assert.equal(h.app.pundErr, '');
});
