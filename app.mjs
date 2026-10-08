import { createScore, step, availableActions, ACTIONS, SCENES, MAX_TRACE } from './score.mjs';

// This module owns only the presentation and the position in the written phrase.
// All simulation state and transitions come from score.mjs.
const byId = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  'scene-controls', 'random-scene', 'scene-kicker', 'scene-title', 'scene-subtitle',
  'phrase-count', 'staff', 'next-beat', 'next-label', 'next-detail', 'pause-toggle',
  'pause-symbol', 'pause-label', 'reset-sketch', 'announcement', 'notice', 'phrase-help',
  'state-phase', 'state-paused', 'state-attempts', 'state-flight', 'manual-panel',
  'manual-events', 'trace-count', 'empty-trace', 'trace-list', 'trace-footnote',
].map((id) => [id, byId(id)]));

let score = createScore();
let sceneIndex = 0;
let phraseBeat = 0;
let improvised = false;
const sceneButtons = [];
const manualButtons = new Map();
const SVG_NS = 'http://www.w3.org/2000/svg';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function currentScene() { return SCENES[sceneIndex]; }

function beginScene(index, announcement) {
  sceneIndex = index;
  score = step(score, 'reset');
  phraseBeat = 0;
  improvised = false;
  ui.announcement.textContent = announcement;
  render();
}

function resetSketch() {
  beginScene(sceneIndex, `Sketch reset. Movement ${currentScene().number}: ${currentScene().title}.`);
}

function perform(action) {
  if (action === 'reset') {
    resetSketch();
    return;
  }
  if (action === currentScene().actions[phraseBeat]) phraseBeat += 1;
  else improvised = true;
  score = step(score, action);
  ui.announcement.textContent = '';
  render();
}

for (const [index, scene] of SCENES.entries()) {
  const button = element('button', 'movement');
  button.type = 'button';
  button.dataset.scene = scene.id;
  button.setAttribute('aria-label', `Movement ${scene.number}: ${scene.title}`);
  const number = element('span', 'movement-number', scene.number);
  number.setAttribute('aria-hidden', 'true');
  const wording = element('span', 'movement-wording');
  wording.append(element('span', 'movement-title', scene.title), element('span', 'movement-motifs', scene.motifs.join(' / ')));
  const arrow = element('span', 'movement-arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  button.append(number, wording, arrow);
  button.addEventListener('click', () => {
    if (index === sceneIndex) return;
    beginScene(index, `Movement ${scene.number}: ${scene.title}. A fresh sketch.`);
  });
  sceneButtons.push(button);
  ui['scene-controls'].append(button);
}

// Keep stable button nodes so keyboard focus is not discarded on every render.
for (const [action, definition] of Object.entries(ACTIONS)) {
  const button = element('button', '', definition.label);
  button.type = 'button';
  button.dataset.action = action;
  button.addEventListener('click', () => {
    perform(action);
    if (button.hidden) {
      const firstAvailable = manualButtons.get(availableActions(score)[0]);
      firstAvailable?.focus({ preventScroll: true });
    }
  });
  manualButtons.set(action, button);
  ui['manual-events'].append(button);
}

ui['next-beat'].addEventListener('click', () => {
  const action = currentScene().actions[phraseBeat];
  if (!action || (score.paused && !availableActions(score).includes(action))) return;
  // A written phrase can deliberately request a refused event, as Movement II does.
  // The model, never the UI, decides whether that event is admitted.
  perform(action);
});
ui['pause-toggle'].addEventListener('click', () => perform(score.paused ? 'resume' : 'pause'));
ui['reset-sketch'].addEventListener('click', resetSketch);
ui['random-scene'].addEventListener('click', () => {
  const alternatives = SCENES.map((_, index) => index).filter((index) => index !== sceneIndex);
  const index = alternatives[Math.floor(Math.random() * alternatives.length)];
  beginScene(index, `Random movement selected: ${SCENES[index].number}, ${SCENES[index].title}. A fresh sketch.`);
});

function renderStaff() {
  const fragment = document.createDocumentFragment();
  fragment.append(svgElement('title', { id: 'staff-title' }, `${score.trace.length} recorded events in the score`));
  fragment.append(svgElement('desc', { id: 'staff-description' },
    'Each mark comes from an actual simulation event. Height indicates the resulting phase; hollow marks are refused events. The exact records are in the trace below.'));
  const phaseY = { submitted: 48, unknown: 66, ready: 84, stored: 102, received: 120, cancelled: 138, empty: 156 };
  for (const y of [48, 66, 84, 102, 120]) {
    fragment.append(svgElement('line', { x1: 101, x2: 986, y1: y, y2: y, class: 'staff-line' }));
  }
  fragment.append(svgElement('line', { x1: 101, x2: 101, y1: 48, y2: 120, class: 'staff-bar' }));
  fragment.append(svgElement('line', { x1: 980, x2: 980, y1: 48, y2: 120, class: 'staff-bar' }));
  fragment.append(svgElement('line', { x1: 986, x2: 986, y1: 48, y2: 120, class: 'staff-bar' }));
  for (const [phase, y] of Object.entries(phaseY)) {
    fragment.append(svgElement('text', { x: 0, y: y + 4, class: 'staff-phase' }, phase));
  }
  if (score.trace.length === 0) {
    fragment.append(svgElement('text', { x: 550, y: 169, 'text-anchor': 'middle', class: 'staff-empty' }, 'A little room for a first note.'));
  } else {
    const columns = Math.max(currentScene().actions.length, score.trace.length);
    const points = score.trace.map((record, index) => ({ record, x: 120 + (index + 0.5) * (840 / columns), y: phaseY[record.phase] }));
    fragment.append(svgElement('polyline', { points: points.map(({ x, y }) => `${x},${y}`).join(' '), class: 'staff-connector' }));
    for (const [index, { record, x, y }] of points.entries()) {
      const group = svgElement('g', { class: `staff-mark${index === points.length - 1 ? ' is-latest' : ''}${record.kind === 'refusal' ? ' is-refusal' : ''}` });
      group.append(svgElement('title', {}, `Beat ${record.beat}: ${ACTIONS[record.action].short}; ${record.kind}; phase ${record.phase}. ${record.notice}`));
      if (y > 120) group.append(svgElement('line', { x1: x - 13, x2: x + 13, y1: y, y2: y, class: 'staff-bar' }));
      group.append(svgElement('line', { x1: x + 7, x2: x + 7, y1: y - 2, y2: y - 32 }));
      group.append(svgElement('ellipse', { cx: x, cy: y, rx: 8, ry: 5.5, transform: `rotate(-24 ${x} ${y})`, class: 'note-head' }));
      if (record.kind === 'refusal') group.append(svgElement('line', { x1: x - 9, x2: x + 10, y1: y + 9, y2: y - 10 }));
      fragment.append(group, svgElement('text', { x, y: 190, class: 'staff-number' }, String(record.beat).padStart(2, '0')));
    }
  }
  ui.staff.replaceChildren(fragment);
}

function renderTrace() {
  const records = [...score.trace].reverse();
  const fragment = document.createDocumentFragment();
  for (const record of records) {
    const row = element('li', `trace-row${record.kind === 'refusal' ? ' is-refusal' : ''}`);
    row.dataset.beat = String(record.beat);
    const beat = element('span', 'trace-beat', String(record.beat).padStart(2, '0'));
    beat.setAttribute('aria-label', `Beat ${record.beat}`);
    const action = element('div', 'trace-action', ACTIONS[record.action].short);
    action.append(element('span', 'trace-kind', record.kind === 'refusal' ? 'refused' : 'recorded'));
    const detail = element('div', 'trace-record');
    detail.append(element('p', 'trace-notice', record.notice));
    detail.append(element('p', 'trace-state', `phase: ${record.phase} · ${record.paused ? 'paused' : 'not paused'} · simulated attempts: ${record.attempts}`));
    row.append(beat, action, detail);
    fragment.append(row);
  }
  ui['trace-list'].replaceChildren(fragment);
  ui['trace-list'].hidden = records.length === 0;
  ui['trace-list'].tabIndex = records.length ? 0 : -1;
  ui['trace-list'].scrollTop = 0;
  ui['empty-trace'].hidden = records.length !== 0;
  ui['trace-count'].textContent = `${records.length} / ${MAX_TRACE} recent events`;
  const retained = records.length === MAX_TRACE ? `Only the latest ${MAX_TRACE} events are shown. ` : '';
  ui['trace-footnote'].textContent = `${retained}Newest event first. This is a temporary sketch, not a saved journal. Reset or reload clears it.`;
}

function render() {
  const scene = currentScene();
  const action = scene.actions[phraseBeat];
  const available = availableActions(score);
  const blockedByPause = Boolean(action && score.paused && !available.includes(action));
  sceneButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === sceneIndex)));
  ui['scene-kicker'].textContent = `Movement ${scene.number} · ${scene.motifs.join(' / ')}`;
  ui['scene-title'].textContent = scene.title;
  ui['scene-subtitle'].textContent = scene.subtitle;
  ui['phrase-count'].textContent = `${phraseBeat} / ${scene.actions.length} phrase beats`;
  ui['next-beat'].disabled = !action || blockedByPause;
  ui['next-label'].textContent = action ? 'Next beat' : 'Phrase complete';
  ui['next-detail'].textContent = !action ? 'Reset, or choose another movement.'
    : blockedByPause ? `Paused · next: ${ACTIONS[action].short}` : `${ACTIONS[action].label} · ${phraseBeat + 1} of ${scene.actions.length}`;
  ui['pause-toggle'].disabled = false;
  ui['pause-label'].textContent = score.paused ? 'Resume' : 'Pause';
  ui['pause-symbol'].textContent = score.paused ? '▷' : 'Ⅱ';
  ui['pause-toggle'].setAttribute('aria-label', score.paused ? 'Resume without replaying' : 'Pause new work');
  ui['reset-sketch'].disabled = false;
  ui['random-scene'].disabled = SCENES.length < 2;
  ui.notice.textContent = score.notice;
  ui['state-phase'].textContent = score.phase;
  ui['state-paused'].textContent = score.paused ? 'paused' : 'not paused';
  ui['state-attempts'].textContent = String(score.attempts);
  ui['state-flight'].textContent = score.inFlight ? 'yes' : 'no';
  ui['phrase-help'].textContent = !action
    ? 'End of this phrase. The state above is its outcome, not a claim of success. Reset to repeat it, or choose another movement.'
    : blockedByPause
      ? 'New work is paused. Resume to continue. An unsent note stays cancelled; reset to try the original phrase again.'
      : score.paused
        ? 'New work is paused. The next written event is still permitted; a pause does not erase an existing outcome.'
        : improvised
          ? 'You have changed the written phrase. Its next event may be refused; every result stays visible in the trace.'
          : 'One click, one event. A requested beat can be refused; the trace tells you why.';
  for (const [event, button] of manualButtons) {
    button.hidden = !available.includes(event);
  }
  renderStaff();
  renderTrace();
}

render();
