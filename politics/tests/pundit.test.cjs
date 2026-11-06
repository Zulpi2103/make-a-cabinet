/* Run with: node --test politics/tests/pundit.test.cjs
   Exercises the real pundit with a mocked WebLLM loader. No model download,
   network request, WebGPU inference or third-party test dependency. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = (name) => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');
const names = [
  ['Donald Trump', 'Deng Xiaoping', 'Ronald Reagan', 'Vladimir Putin', 'Hillary Clinton', 'Dwight D. Eisenhower', 'Clement Attlee'],
  ['Barack Obama', 'Joe Biden', 'Robert F. Kennedy', 'Xi Jinping', 'Ruth Bader Ginsburg', 'Margaret Thatcher', 'Martin Luther King Jr.'],
];
const labels = ['LEADER', 'ECONOMY', 'FOREIGN', 'INTERIOR', 'JUSTICE', 'DEFENCE', 'SOCIAL'];

function fixture(options = {}) {
  const requests = [], loaded = [], removed = [];
  let CC, S, round = 0;
  const mockEngine = {
    chat: { completions: { create: async (request) => {
      requests.push(request);
      const step = (requests.length - 1) % 5;
      const person = Math.floor(step / 2);
      let content;
      if (step === 4) {
        content = 'SUMMARY: These cabinets depend on different specialists and careful deployment.\nHEADLINE: Cabinet meetings run out of chairs\nCLOSER: The meeting has adjourned before anybody could find the agenda.';
        round++;
      } else if (step % 2 === 0) {
        // The model tries to inject a reputation-based number; it must have no influence.
        content = `SCORE: ${round === 0 ? (person === 0 ? 1 : 10) : (person === 0 ? 10 : 1)}\nHEADLINE: An ambitious collection of specialists\nSTRENGTH: The Interior minister has the relevant administration skill for service coordination.\nWEAKNESS: Keep the weaker specialist away from an unsuitable primary role.`;
      } else {
        const lines = S.teams[S.players[person].id].seats.map((fi, i) => {
          const f = CC.pol(fi);
          const label = options.byPosition ? f.n : labels[i];
          const joke = options.unsafe && i === 5
            ? `${f.n} will murder the opposition before the next meeting starts.`
            : `${f.n} brings seventeen folders to a meeting that only needed a notebook.`;
          return `${label}: ${joke}`;
        });
        content = lines.concat('OVERALL: This cabinet needs a committee just to agree on its meeting agenda.').join('\n');
      }
      return { choices: [{ message: { content } }] };
    } } },
  };
  const sandbox = {
    window: {},
    localStorage: { getItem: () => '', removeItem: (key) => removed.push(key), setItem() {} },
    navigator: { gpu: { requestAdapter: async () => ({ features: new Set(['shader-f16']) }) } },
    __mockImport: async () => ({ CreateMLCEngine: async (model) => { loaded.push(model); return mockEngine; } }),
  };
  vm.runInNewContext(source('data.js'), sandbox, { filename: 'data.js' });
  vm.runInNewContext(source('engine.js'), sandbox, { filename: 'engine.js' });
  // Replace only the network import boundary; use the production parser and flow.
  vm.runInNewContext(source('pundit.js').replace('await import(WEBLLM_URL)', 'await __mockImport(WEBLLM_URL)'), sandbox, { filename: 'pundit.js' });
  CC = sandbox.window.CC;
  S = CC.Engine.newState('local');
  S.phase = 'cabinets';
  names.forEach((cabinet, i) => {
    const player = CC.Engine.addPlayer(S, { name: 'Player ' + (i + 1) });
    const seats = cabinet.map((name) => {
      const person = sandbox.window.CC_DATA.POLS.find((f) => f.n === name);
      assert(person, `Missing fixture politician ${name}`);
      return person.i;
    });
    S.teams[player.id] = { seats, cr: 0, buys: seats.map((f, seat) => ({ f, seat, v: 0, fill: true })) };
  });
  return { CC, S, requests, loaded, removed };
}

const ratings = (verdict) => Array.from(verdict.serious.cabinets, ({ id, score }) => ({ id, score }));

test('free AI cannot change mechanical numbers with reputation-based SCORE output', async () => {
  const h = fixture();
  const expected = ratings(h.CC.Pundit.house(h.S));
  assert.deepEqual(ratings(await h.CC.Pundit.askFree(h.S, () => {})), expected);
  assert.deepEqual(ratings(await h.CC.Pundit.askFree(h.S, () => {})), expected);
  assert.equal(h.loaded.length, 1, 'The cached model should be reused');
  assert.equal(h.loaded[0], 'Llama-3.2-3B-Instruct-q4f16_1-MLC');
  assert(h.requests.every((r) => !/\nSCORE:/.test(r.messages[1].content)), 'The model must never be asked for a numeric score');
});

test('all seven ministers receive jokes with enough output budget and effectiveness guidance', async () => {
  const h = fixture();
  const verdict = await h.CC.Pundit.askFree(h.S, () => {});
  for (const cabinet of verdict.roast.cabinets) {
    assert.equal(cabinet.lines.length, 7);
    assert.deepEqual(Array.from(cabinet.lines, (line) => line.seat), [0, 1, 2, 3, 4, 5, 6]);
    assert(cabinet.lines.every((line) => line.joke.includes('seventeen folders')));
  }
  const roastRequests = h.requests.filter((r) => r.messages[1].content.includes('Answer with exactly these 8 lines:'));
  assert.equal(roastRequests.length, 2);
  assert(roastRequests.every((r) => r.max_tokens >= 650));
  for (const request of h.requests) {
    assert.match(request.messages[0].content, /Do not reward democracy, liberalism, personal virtue, authoritarianism or longevity/);
    assert.match(request.messages[0].content, /never joke about atrocities or deaths/);
  }
  assert.match(h.requests[0].messages[1].content, /Social Affairs \d\/9/);
  assert.match(h.requests[0].messages[1].content, /Donald Trump & Hillary Clinton -1/);
  assert.match(h.requests[0].messages[1].content, /combined cabinet rapport capped at −2 to \+2/);
  assert(!h.requests[0].messages[1].content.includes('+-1'));
  assert.deepEqual(h.removed.sort(), ['cc-ai-key', 'cc-ai-proxy', 'cc-free-model']);
});

test('unsafe jokes fall back per minister while the other six remain intact', async () => {
  const h = fixture({ unsafe: true });
  const verdict = await h.CC.Pundit.askFree(h.S, () => {});
  for (const cabinet of verdict.roast.cabinets) {
    assert.equal(cabinet.lines.length, 7);
    assert(!cabinet.lines[5].joke.includes('murder'));
    assert(!cabinet.lines[5].joke.includes('seventeen folders'));
    assert(cabinet.lines.filter((line) => line.seat !== 5).every((line) => line.joke.includes('seventeen folders')));
  }
});

test('name-labelled positional fallback still preserves every ministry', async () => {
  const h = fixture({ byPosition: true });
  const verdict = await h.CC.Pundit.askFree(h.S, () => {});
  assert(verdict.roast.cabinets.every((cabinet) => cabinet.lines.length === 7 && cabinet.lines.every((line) => line.joke.includes('seventeen folders'))));
});

test('house numbers ignore biographical praise or regime labels and explain signed relationships', () => {
  const h = fixture();
  const before = h.CC.Pundit.house(h.S);
  const expected = ratings(before);
  h.S.players.forEach((p, pi) => h.S.teams[p.id].seats.forEach((fi) => {
    h.CC.pol(fi).r = pi === 0 ? 'Much-admired democratic reformer' : 'Long-serving authoritarian ruler';
  }));
  const after = h.CC.Pundit.house(h.S);
  assert.deepEqual(ratings(after), expected);
  assert.match(after.serious.cabinets.find((c) => c.id === h.S.players[0].id).strengths, /Working relationships -1/);
  assert(!JSON.stringify(after.serious).includes('+-'));
});
