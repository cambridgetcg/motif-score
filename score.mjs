// A browser-only illustration. No transport, account or agent is connected.
export const MAX_TRACE = 24;
export const ACTIONS = Object.freeze({
  arrive: { label: 'Let a note arrive', short: 'Arrival' },
  observe: { label: 'Keep an observation', short: 'Observation' },
  acknowledge: { label: 'Acknowledge input', short: 'Acknowledgement' },
  attempt: { label: 'Simulate one attempt', short: 'Attempt' },
  confirm: { label: 'Receive a simulated receipt', short: 'Confirmation' },
  uncertain: { label: 'Let the response go missing', short: 'Uncertainty' },
  pause: { label: 'Pause new work', short: 'Pause' },
  resume: { label: 'Resume without replaying', short: 'Resume' },
  replay: { label: 'Inspect the recorded outcome', short: 'Return' },
  reset: { label: 'Reset the sketch', short: 'Reset' },
});

export const SCENES = Object.freeze([
  { id: 'arrival', number: 'I', title: 'A note arrives', subtitle: 'A request becomes legible, one record at a time.',
    motifs: ['continuity', 'trust'], actions: ['arrive', 'observe', 'acknowledge', 'attempt', 'confirm', 'replay'] },
  { id: 'interval', number: 'II', title: 'Room for silence', subtitle: 'A pause is part of the score, not an error in it.',
    motifs: ['choice', 'care'], actions: ['arrive', 'observe', 'acknowledge', 'pause', 'resume', 'attempt'] },
  { id: 'return', number: 'III', title: 'The held note', subtitle: 'When an answer is missing, uncertainty keeps its name.',
    motifs: ['privacy', 'honesty'], actions: ['arrive', 'observe', 'acknowledge', 'attempt', 'uncertain', 'replay'] },
]);

export function createScore() {
  return { kind: 'motif-score/simulation-v1', phase: 'empty', paused: false,
    inFlight: false, attempts: 0, beat: 0, trace: [], notice: 'A quiet page. Let a note arrive.' };
}

export function availableActions(score) {
  const outcomes = score.phase === 'unknown' ? ['confirm', ...(score.inFlight ? ['uncertain'] : []), 'replay']
    : score.phase === 'submitted' ? ['replay'] : [];
  if (score.paused) return [...outcomes, 'resume', 'reset'];
  const next = { empty: 'arrive', received: 'observe', stored: 'acknowledge', ready: 'attempt',
    submitted: 'arrive', cancelled: 'arrive' }[score.phase];
  return [...(next ? [next] : []), ...outcomes, 'pause', 'reset'];
}

export function step(score, action) {
  if (typeof action !== 'string' || !Object.hasOwn(ACTIONS, action)) throw new Error('unknown_action');
  if (action === 'reset') return createScore();
  const next = { ...score, trace: [...score.trace], beat: Math.min(score.beat + 1, 10000) };
  let kind = 'record';
  if (!availableActions(score).includes(action)) {
    kind = 'refusal';
    next.notice = score.paused ? 'Paused: no new work is admitted.'
      : score.phase === 'cancelled' ? 'This note was cancelled. Resume does not revive it.'
      : score.phase === 'unknown' ? 'An unknown attempt is not a reason to resend.'
      : 'The preceding records do not permit this step.';
  } else {
    switch (action) {
      case 'arrive':
        Object.assign(next, { phase: 'received', inFlight: false, attempts: 0 });
        next.notice = 'A note arrives. Arrival is not execution.';
        break;
      case 'observe':
        next.phase = 'stored';
        next.notice = 'A scoped observation is kept. A record is not a command.';
        break;
      case 'acknowledge':
        next.phase = 'ready';
        next.notice = 'The input is acknowledged locally. No reply has been sent.';
        break;
      case 'attempt':
        Object.assign(next, { phase: 'unknown', inFlight: true, attempts: 1 });
        next.notice = 'One simulated attempt is reserved. Its outcome is unknown until a receipt arrives.';
        break;
      case 'confirm':
        Object.assign(next, { phase: 'submitted', inFlight: false });
        next.notice = 'A simulated submission receipt arrives. Submission is not reading.';
        break;
      case 'uncertain':
        next.inFlight = false;
        next.notice = 'The return fell silent. Unknown remains unknown.';
        break;
      case 'pause':
        next.paused = true;
        if (['received', 'stored', 'ready'].includes(next.phase)) next.phase = 'cancelled';
        next.notice = next.phase === 'cancelled' ? 'The next beat is withheld. This unsent note is cancelled.'
          : 'No new work begins. A receipt already in flight may still arrive.';
        break;
      case 'resume':
        next.paused = false;
        next.notice = 'The room opens again. Cancelled notes stay cancelled.';
        break;
      case 'replay':
        next.notice = 'The recorded outcome returns; no new attempt.';
        break;
    }
  }
  next.trace = [...next.trace, { beat: next.beat, action, kind, phase: next.phase,
    paused: next.paused, attempts: next.attempts, notice: next.notice }].slice(-MAX_TRACE);
  return next;
}
