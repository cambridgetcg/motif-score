import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const modelURL = new URL('../score.mjs', import.meta.url);

test('a complete phrase submits once and replays without a second attempt', async () => {
  assert.ok(existsSync(modelURL), 'score model is missing');
  const { createScore, step } = await import(modelURL.href);
  let score = createScore();
  for (const action of ['arrive', 'observe', 'acknowledge', 'attempt', 'confirm', 'replay']) {
    score = step(score, action);
  }
  assert.equal(score.kind, 'motif-score/simulation-v1');
  assert.equal(score.phase, 'submitted');
  assert.equal(score.attempts, 1);
  assert.equal(score.paused, false);
  assert.equal(score.inFlight, false);
  assert.match(score.notice, /no new attempt/i);
});

async function model() { return import(modelURL.href); }

for (const phase of ['received', 'stored', 'ready']) {
  test(`pause cancels ${phase}; resume never revives it`, async () => {
    const { createScore, step } = await model();
    let score = step(createScore(), 'arrive');
    if (phase !== 'received') score = step(score, 'observe');
    if (phase === 'ready') score = step(score, 'acknowledge');
    score = step(score, 'pause');
    assert.equal(score.phase, 'cancelled');
    assert.equal(score.paused, true);
    score = step(step(score, 'resume'), 'attempt');
    assert.equal(score.phase, 'cancelled');
    assert.equal(score.attempts, 0);
    assert.equal(score.trace.at(-1).kind, 'refusal');
  });
}

test('uncertainty and repeated replay never manufacture another send', async () => {
  const { createScore, step } = await model();
  let score = createScore();
  for (const action of ['arrive', 'observe', 'acknowledge', 'attempt', 'uncertain']) score = step(score, action);
  for (let i = 0; i < 12; i++) score = step(score, 'replay');
  score = step(score, 'attempt');
  assert.equal(score.phase, 'unknown');
  assert.equal(score.attempts, 1);
  assert.equal(score.inFlight, false);
});

test('a confirmation already in flight may arrive while paused', async () => {
  const { createScore, step } = await model();
  let score = createScore();
  for (const action of ['arrive', 'observe', 'acknowledge', 'attempt', 'pause', 'confirm']) score = step(score, action);
  assert.equal(score.phase, 'submitted');
  assert.equal(score.paused, true);
  assert.equal(score.attempts, 1);
});

test('illegal order is an explicit refusal and input is not mutated', async () => {
  const { createScore, step } = await model();
  const before = createScore();
  const copy = JSON.stringify(before);
  const after = step(before, 'attempt');
  assert.equal(JSON.stringify(before), copy);
  assert.equal(after.phase, 'empty');
  assert.equal(after.attempts, 0);
  assert.equal(after.trace.at(-1).kind, 'refusal');
});

test('available actions expose no new work during a pause', async () => {
  const { createScore, step, availableActions } = await model();
  const score = step(step(createScore(), 'arrive'), 'pause');
  assert.deepEqual(availableActions(score), ['resume', 'reset']);
});

test('trace is a bounded drawing, not a durable journal', async () => {
  const { createScore, step, MAX_TRACE } = await model();
  let score = createScore();
  for (const action of ['arrive', 'observe', 'acknowledge', 'attempt', 'confirm']) score = step(score, action);
  for (let i = 0; i < 80; i++) score = step(score, 'replay');
  assert.equal(score.trace.length, MAX_TRACE);
  assert.equal(score.attempts, 1);
  assert.equal(score.phase, 'submitted');
});

test('reset is explicitly a new simulation and invalid actions are refused', async () => {
  const { createScore, step } = await model();
  assert.deepEqual(step(step(createScore(), 'arrive'), 'reset'), createScore());
  for (const action of ['__proto__', 'constructor', '', null, 1]) {
    assert.throws(() => step(createScore(), action), /unknown_action/);
  }
});

test('three public movements have distinct outcomes and labels', async () => {
  const { createScore, step, SCENES, ACTIONS } = await model();
  assert.equal(SCENES.length, 3);
  assert.equal(new Set(SCENES.map(s => s.id)).size, 3);
  assert.deepEqual(SCENES.map(scene => scene.actions.reduce(step, createScore()).phase), ['submitted', 'cancelled', 'unknown']);
  for (const scene of SCENES) for (const action of scene.actions) assert.ok(Object.hasOwn(ACTIONS, action));
});
