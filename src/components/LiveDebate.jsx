import { useEffect, useMemo, useRef, useState } from 'react';
import { Legacy } from '../game/legacy.js';
import { startDebate, watchDebate, submitAnswer, submitRebut, hostUpdate } from '../net/debate.js';

const DEFAULT_T = { answer: 30000, reveal: 7000, rebut: 30000, done: 6000 };
const STYLE = { policy: 'Your platform', message: 'Stay on message', attack: 'Attack', joke: 'Joke', pivot: 'Move to the middle' };
const ROUNDS = 5;

/**
 * Debate night, live. Everyone answers the same question at once (30 seconds), answers are
 * revealed together, then everyone picks a rival to rebut. The host scores each step;
 * after five questions the ranking sets everyone's momentum.
 */
export default function LiveDebate({ code, uid, isHost, state, version, players, onDone, timings }) {
  const T = { ...DEFAULT_T, ...(timings || {}) };
  const [node, setNode] = useState(undefined);
  const [now, setNow] = useState(Date.now());
  const [target, setTarget] = useState(null);
  const started = useRef(0);
  const stepKey = useRef('');
  const finished = useRef(false);

  useEffect(() => watchDebate(code, (v) => setNode(v)), [code]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const spec = useMemo(() => (node && node.spec && node.version === version ? JSON.parse(node.spec) : null), [node && node.spec, node && node.version, version]);

  // Host: open the debate for this week.
  useEffect(() => {
    if (!isHost || node === undefined || started.current === version) return;
    if (node && node.version === version) { started.current = version; return; }
    started.current = version;
    startDebate(code, version, Legacy.mp.debatePrepare(state), T.answer);
  }, [isHost, node, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Host: advance phases when everyone has answered or time runs out.
  useEffect(() => {
    if (!isHost || !spec || !node) return;
    const { round, phase } = node;
    const key = `${round}:${phase}`;
    if (stepKey.current === key) return;
    const humans = spec.stages.flatMap((s) => s.parts).filter((p) => p.uid && players[p.uid] && players[p.uid].connected);
    const ans = (node.answers && node.answers[round]) || {};
    const reb = (node.rebuts && node.rebuts[round]) || {};
    const allIn = phase === 'answer' ? humans.every((p) => ans[p.uid] !== undefined) : phase === 'rebut' ? humans.every((p) => reb[p.uid] !== undefined) : false;
    if (!allIn && now < node.deadline) return;
    stepKey.current = key;
    const byPart = (src) => { const o = {}; spec.stages.forEach((s) => s.parts.forEach((p) => { if (p.uid && src[p.uid] !== undefined) o[p.id] = src[p.uid]; })); return o; };
    const totals = { ...(node.totals || {}) };
    const t = Date.now();
    if (phase === 'answer') {
      const res = Legacy.mp.debateScoreAnswers(spec, round, byPart(ans));
      for (const id in res) totals[id] = (totals[id] || 0) + res[id].pts;
      hostUpdate(code, { [`results/${round}/a`]: res, totals, phase: 'reveal', deadline: t + T.reveal });
    } else if (phase === 'reveal') {
      hostUpdate(code, { phase: 'rebut', deadline: t + T.rebut });
    } else if (phase === 'rebut') {
      const zused = { ...(node.zused || {}) };
      const res = Legacy.mp.debateScoreRebuts(spec, round, byPart(reb), zused);
      for (const id in res) { totals[id] = (totals[id] || 0) + res[id].pts + (res[id].hit || 0); if (res[id].type === 'zinger') zused[id] = true; }
      hostUpdate(code, { [`results/${round}/r`]: JSON.parse(JSON.stringify(res)), totals, zused, phase: 'rebutReveal', deadline: t + T.reveal });
    } else if (phase === 'rebutReveal') {
      hostUpdate(code, round + 1 < ROUNDS ? { round: round + 1, phase: 'answer', deadline: t + T.answer } : { phase: 'done', deadline: t + T.done });
    } else if (phase === 'done' && !finished.current) {
      finished.current = true;
      onDone(Legacy.mp.debateApply(state, spec, totals));
    }
  }, [isHost, spec, node, now, players]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!spec || !node) {
    return <div className="overlay center"><div className="lt"><div className="lt-head"><div className="tag">Debate night</div><h2>The candidates are taking the stage</h2></div><div className="lt-body"><p className="muted">Setting up the debate…</p></div></div></div>;
  }

  const parts = spec.stages.flatMap((s) => s.parts.map((p) => ({ ...p, stage: s.key })));
  const me = parts.find((p) => p.uid === uid);
  const stage = spec.stages.find((s) => me && s.key === me.stage) || spec.stages[0];
  const round = node.round, phase = node.phase;
  const secs = Math.max(0, Math.ceil((node.deadline - now) / 1000));
  const totals = node.totals || {};
  const res = (node.results && node.results[round]) || {};
  const myAns = me && node.answers && node.answers[round] && node.answers[round][me.uid];
  const myReb = me && node.rebuts && node.rebuts[round] && node.rebuts[round][me.uid];
  const zUsed = me && node.zused && node.zused[me.id];
  const others = me ? stage.parts.filter((p) => p.id !== me.id) : [];
  const q = me ? me.qtext[round] : (stage.parts.find((p) => !p.ai) || stage.parts[0]).qtext[round];
  const nameOf = (id) => (parts.find((p) => p.id === id) || {}).name;
  const pts = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10)}`;

  return (
    <div className="overlay center live-debate" role="dialog" aria-label="Live debate">
      <div className="lt wide">
        <div className="lt-head"><div className="tag">Debate night</div><h2>{stage.title}{phase !== 'done' ? ` · Question ${round + 1} of ${ROUNDS}` : ''}</h2></div>
        <div className="lt-body">
          <div className="ld-grid">
            <div>
              {phase === 'done' ? (
                <>
                  <h3>Final ranking</h3>
                  <ol className="ld-rank">{stage.parts.slice().sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0)).map((p) => <li key={p.id}><b>{p.uid === uid ? 'You' : p.name}</b> <span className="num">{pts(totals[p.id] || 0)}</span></li>)}</ol>
                  <p className="muted">First place gains the most momentum and last place loses some. The campaign resumes in a moment.</p>
                </>
              ) : (
                <>
                  <p className="ld-q">Moderator: {q}</p>
                  {(phase === 'answer' || phase === 'rebut') && <p className={`ld-timer ${secs <= 10 ? 'down' : ''}`}><span className="num">{secs}</span>s left</p>}
                  {phase === 'answer' && me && myAns === undefined && (
                    <div className="choices">{me.answers[round].map((a, i) => (
                      <button key={i} className="choice" onClick={() => submitAnswer(code, round, uid, i)}>“{a.text}”<small>{STYLE[a.style] || a.style}</small></button>
                    ))}</div>
                  )}
                  {phase === 'answer' && (!me || myAns !== undefined) && <p className="muted">{me ? 'Answer locked in. Waiting for the other candidates…' : 'The candidates are answering…'}</p>}
                  {(phase === 'reveal' || phase === 'rebut' || phase === 'rebutReveal') && res.a && (
                    <div className="ld-answers">{stage.parts.map((p) => { const r = res.a[p.id]; if (!r) return null; return (
                      <div key={p.id} className={`ld-ans ${r.ok ? 'ok' : 'bad'}`}><b>{p.uid === uid ? 'You' : p.name}{r.auto ? ' (auto)' : ''}</b><span>“{r.text}”</span><span className="num">{r.ok ? '✓' : '✗'} {pts(r.pts)}</span></div>); })}</div>
                  )}
                  {phase === 'rebut' && me && myReb === undefined && (
                    <div className="panel" style={{ marginTop: 12 }}>
                      <b>Pick someone to go after</b>
                      <div className="seg" style={{ margin: '8px 0', flexWrap: 'wrap' }}>{others.map((o) => <button key={o.id} className={target === o.id ? 'on' : ''} onClick={() => setTarget(o.id)}>{o.name}</button>)}</div>
                      <div className="choices">
                        <button className="choice" disabled={!target} onClick={() => submitRebut(code, round, uid, { target, type: 'counter' })}>Counter their answer<small>Solid odds. Win and they lose a little too.</small></button>
                        {!zUsed && <button className="choice" disabled={!target} onClick={() => submitRebut(code, round, uid, { target, type: 'zinger' })}>Interrupt with a zinger<small>Once per debate. Big swing either way.</small></button>}
                        <button className="choice" onClick={() => submitRebut(code, round, uid, { type: 'slide' })}>Let it slide<small>Safe, costs you a little.</small></button>
                      </div>
                    </div>
                  )}
                  {phase === 'rebut' && (!me || myReb !== undefined) && <p className="muted" style={{ marginTop: 10 }}>{me ? 'Rebuttal locked in. Waiting for the others…' : 'The candidates are choosing their rebuttals…'}</p>}
                  {phase === 'rebutReveal' && res.r && (
                    <div className="ld-answers" style={{ marginTop: 10 }}>{stage.parts.map((p) => { const r = res.r[p.id]; if (!r) return null; return (
                      <div key={p.id} className={`ld-ans ${r.type === 'slide' ? '' : r.ok ? 'ok' : 'bad'}`}><b>{p.uid === uid ? 'You' : p.name}</b>
                        <span>{r.type === 'slide' ? 'Lets it slide.' : `${r.type === 'zinger' ? 'Zingers' : 'Counters'} ${r.targetName === nameOf(me && me.id) ? 'you' : r.targetName}: “${r.line}”`}</span>
                        <span className="num">{r.type === 'slide' ? '' : r.ok ? '✓' : '✗'} {pts(r.pts)}{r.hit ? ` (hit ${pts(r.hit)})` : ''}</span></div>); })}</div>
                  )}
                </>
              )}
            </div>
            <div className="panel ld-score">
              <h3>Scoreboard</h3>
              {stage.parts.slice().sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0)).map((p) => (
                <div key={p.id} className="poll-row"><span className="name">{p.uid === uid ? 'You' : p.name}{p.ai ? ' (AI)' : ''}</span><span className="num" style={{ fontSize: 20 }}>{pts(totals[p.id] || 0)}</span></div>
              ))}
              {!me && <small className="muted">You’re watching this one.</small>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
