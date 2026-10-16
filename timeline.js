/* timeline.js — 시간대별 타임라인(드래그로 이동·길이 조절·삭제), 하루 일정 추가, 오늘/캘린더 탭 공용 헬퍼 */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc;
  const PPM = 1.8;   // 분당 픽셀 (60분 = 108px)
  const SNAP = 5;    // 5분 단위로 맞춤

  h.KIND = { study: '공부', review: '복습', preview: '예습', exam: '시험 대비', final: '직전 정리', task: '대회·과제' };
  h.partsLabel = (e, withMin) => e.parts.map(p => (p.k === 'routine' ? p.item.routine.title : { review: '복습', preview: '예습', exam: '시험 대비', final: '직전 정리' }[p.k]) + (withMin ? ` ${p.min}분` : '')).join(withMin ? ' · ' : '·');
  h.kindLabel = e => (e.custom ? (e.custom.alloc ? ((P.allocFind(A.S, e.custom.alloc) || { a: { title: '할당' } }).a.title) : (e.custom.kind === 'event' ? '일정' : '할 일')) : h.KIND[e.kind]);
  const isJobKind = e => e.kind === 'task';

  h.colorOf = (S, e) => {
    if (e.custom) { const f = e.custom.alloc && P.allocFind(S, e.custom.alloc); return f ? f.a.color : (e.custom.color || (e.custom.kind === 'event' ? '#64748b' : '#0ea5e9')); }
    const sb = P.subj(S, e.sid);
    return sb ? sb.color : (e.kind === 'task' ? '#d97706' : '#64748b');
  };
  h.rgba = (hex, a) => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : `rgba(100,116,139,${a})`;
  };
  // 시각이 정해진 고정 블록(루틴 또는 복습)의 제목·보조 문구
  h.fixedTitle = (S, e) => { const it = e.parts[0].item, sb = P.subj(S, e.sid); return it.routine ? it.routine.title : `${sb ? sb.name : ''} 복습`; };
  h.fixedSub = (S, e) => { const it = e.parts[0].item; return it.routine ? (it.routine.amount || (P.subj(S, e.sid) || {}).name || '') : '수업 후 복습'; };
  h.titleOf = (S, e) => {
    if (e.custom) return e.custom.title;
    if (e.routine) return e.routine.title;
    const sb = P.subj(S, e.sid), n = sb ? sb.name : '';
    if (e.kind === 'study') return e.fixedRoutine ? h.fixedTitle(S, e) : n;
    if (e.kind === 'review') return `${n} 복습`;
    if (e.kind === 'preview') return `${n} 예습`;
    return e.job.title;
  };
  h.jobTitleByKey = (S, key) => {
    const [k, id] = key.split('|');
    if (k === 'task') { const t = S.tasks.find(x => x.id === id); return t ? t.title : '과제'; }
    const e = S.exams.find(x => x.id === id), sb = e && P.subj(S, e.sid);
    return sb ? `${sb.name} ${k === 'final' ? '직전 정리' : ((e && e.label) || '기말 대비')}` : '시험 대비';
  };
  h.titleByKey = (S, key) => {
    const p = key.split('|');
    if (p[0] === 'rev' || p[0] === 'pre') { const sb = P.subj(S, p[2]); return `${sb ? sb.name : ''} ${p[0] === 'rev' ? '복습' : '예습'}`; }
    if (p[0] === 'rr') { const sb = P.subj(S, p[2]); return `${sb ? sb.name : ''} 복습`; }
    if (p[0] === 'rt' || p[0] === 'rb') { const r = S.routines.find(x => x.id === p[2]); return r ? r.title : '루틴'; }
    if (p[0] === 'st') { const sb = P.subj(S, p[2]); return sb ? sb.name : '공부'; }
    if (p[0] === 'cu') { const c = S.custom.find(x => x.id === p[1]); return c ? c.title : '일정'; }
    return h.jobTitleByKey(S, key);
  };

  // ---------- 렌더 ----------
  // D: PLAN.days 의 한 날. opt.editable 이면 끌어서 옮기고 길이를 바꾸고 뺄 수 있다.
  h.timeline = function (S, D, opt) {
    opt = opt || {};
    const editable = !!opt.editable, isToday = D.t === 0;
    const full = P.blocksFor(S, D.date);
    let lo = Infinity, hi = -Infinity;
    for (const [a, b] of full) { lo = Math.min(lo, a); hi = Math.max(hi, b); }
    for (const e of D.entries) for (const [a, b] of e.pieces) { lo = Math.min(lo, a); hi = Math.max(hi, b); }
    if (!isFinite(lo)) { lo = 18 * 60; hi = 24 * 60; }
    lo = Math.max(0, Math.floor((lo - 30) / 60) * 60);
    hi = Math.min(P.DAY_END, Math.ceil((hi + 30) / 60) * 60);
    if (hi - lo < 240) hi = Math.min(P.DAY_END, lo + 240);

    // 내 일정이 차지한 시간도 '가용'처럼 보이도록, 원래 가용 시간(내 일정 제외 전)을 다시 계산
    const avail = P.blocksFor(Object.assign({}, S, { custom: [] }), D.date);
    let html = `<div class="tl ${editable ? 'edit' : ''}" data-date="${D.date}" data-t0="${lo}" style="height:${(hi - lo) * PPM}px">`;
    for (const [a, b] of avail) {
      const s = Math.max(a, lo), f = Math.min(b, hi);
      if (f > s) html += `<div class="av" style="top:${(s - lo) * PPM}px;height:${(f - s) * PPM}px"></div>`;
    }
    for (let m = lo; m <= hi; m += 60) html += `<div class="hr" style="top:${(m - lo) * PPM}px"><span>${P.t12s(m)}</span></div>`;
    if (isToday) {
      const n = P.nowMin();
      if (n >= lo && n <= hi) html += `<div class="now" style="top:${(n - lo) * PPM}px"><i></i></div>`;
    }
    for (const e of D.entries) {
      const c = h.colorOf(S, e), running = S.timer && S.timer.key === e.id;
      const cls = [e.custom ? 'cu cu-' + e.custom.kind : (isJobKind(e) ? 'job' : 'rv'), e.manual ? 'pin' : '', running ? 'run' : '', A.ui.sel === e.id ? 'sel' : ''].join(' ');
      e.pieces.forEach(([a, b], pi) => {
        const hpx = Math.max((b - a) * PPM - 2, 18);
        html += `<div class="tb ${cls} ${hpx < 42 ? 'sm' : ''}" data-id="${esc(e.id)}" data-pi="${pi}" data-s="${a}" data-d="${b - a}"
          style="top:${(a - lo) * PPM}px;height:${hpx}px;--c:${c};--cb:${h.rgba(c, 0.2)}" title="${esc(h.titleOf(S, e))}">
          <div class="tt">${esc(h.titleOf(S, e))}${e.pieces.length > 1 ? ` <small>(${pi + 1}/${e.pieces.length})</small>` : ''}</div>
          <div class="tm">${P.range12(a, b)} · ${b - a}분</div>
          ${e.kind === 'study' ? `<div class="tp">${esc(e.fixedRoutine ? h.fixedSub(S, e) : h.partsLabel(e, true))}</div>` : ''}
          ${editable ? `<span class="tools">${h.sessionKeys(S, e, D.date)}${e.manual ? `<button data-action="unpin" data-date="${D.date}" data-id="${esc(e.id)}">고정 해제</button>` : ''}<button class="del" data-action="delentry" data-date="${D.date}" data-id="${esc(e.id)}" title="${e.custom ? '이 일정 삭제' : '이 날 계획에서 빼기'}">${e.custom ? '삭제' : '빼기'}</button></span><i class="rz" title="아래쪽 끝을 끌어 길이 조절"></i>` : ''}</div>`;
      });
    }
    html += '</div>';
    html += `<div class="tlleg"><span><i class="lg rv"></i>공부</span><span><i class="lg job"></i>대회·과제</span><span><i class="lg ev"></i>내 일정</span></div>`;
    const lost = D.entries.filter(e => e.unplaced > 0);
    if (lost.length) html += `<div class="note warn" style="margin-top:8px">시간이 모자라 <b>${lost.map(e => esc(h.titleOf(S, e))).join(', ')}</b> 일부를 놓지 못했어요.</div>`;
    return html;
  };

  // 기존 할 일(안 끝낸 중요 할 일·과제) 목록 — 일정 추가 폼에서 골라 시간을 잡는다
  h.todoPicks = S => {
    const L = [];
    for (const it of S.important) if (!it.done && it.date) L.push({ ref: 'imp:' + it.id, title: it.title, tag: '중요', sub: h.md(it.date), key: it.date });
    for (const t of S.tasks) if (!t.done) L.push({ ref: 'task:' + t.id, title: t.title, tag: '과제', sub: t.due ? `마감 ${h.md(t.due)}` : '', key: t.due || '9' });
    return L.sort((a, b) => a.key.localeCompare(b.key));
  };
  // ‘해결 예정’ 표시: 그 할 일에 일정으로 잡아 둔 시간. due 보다 늦게 잡았으면 경고
  h.schedText = (S, ref, due) => {
    const L = P.scheduledFor(S, ref, P.today());
    if (!L.length) return '';
    const c = L[0], late = due && c.date > due;
    return `<span class="usch ${late ? 'late' : ''}">${late ? '⚠ 마감 뒤에 잡혀 있어요 · ' : ''}해결 예정 ${h.md(c.date)} ${P.t12(c.start)} · ${h.fmtMin(c.dur)}${L.length > 1 ? ` 외 ${L.length - 1}건` : ''}</span>`;
  };

  // 패널 위쪽 도구 줄: 일정 추가 / 되돌리기 / 추가 폼 / 이 날 뺀 항목
  h.addForm = (S, date) => {
    const f = A.ui.addForm;
    if (!f || f.date !== date) return '';
    const picks = h.todoPicks(S);
    const pickRow = picks.length ? `<div class="fl refpick"><span class="muted small">기존 할 일에서 고르기</span>${picks.map(c => `<button type="button" class="chip pick ${f.ref === c.ref ? 'on' : ''}" data-action="addref" data-ref="${esc(c.ref)}" title="${f.ref === c.ref ? '다시 누르면 선택 해제' : '이 할 일을 이 시간에 해결하기로 잡아요'}"><b>${c.tag}</b> ${esc(c.title)}${c.sub ? ` <small>${esc(c.sub)}</small>` : ''}${P.scheduledFor(S, c.ref, P.today()).length ? ' <small>· 예정 있음</small>' : ''}</button>`).join('')}</div>` : '';
    return `<div class="addform">
      ${pickRow}
      ${f.ref ? '<div class="hint refnote">고른 할 일을 아래 시간에 해결하기로 잡아요. 끝내면 그 할 일도 처리돼요.</div>' : ''}
      <div class="fl"><label class="wide">제목<input type="text" id="af-title" data-bind="ui.addForm.title" value="${esc(f.title)}" placeholder="예: 저녁 먹기, 수학 문제집, 동아리"></label></div>
      <div class="fl">${h.seg('ui.addForm.kind', f.kind, [['todo', '공부 할 일'], ['event', '일정 (공부 못 함)']])}</div>
      <div class="fl"><span class="tr">${h.tsel('ui.addForm.start', f.start, false)}<span>부터</span></span>${h.step('ui.addForm.dur', f.dur, { step: 10, min: 5, max: 600, unit: '분' })}</div>
      <div class="fl"><button class="btn primary" data-action="addcustom">추가</button><button class="btn ghost" data-action="addcancel">취소</button></div></div>`;
  };
  h.tlTools = (S, D) => {
    const date = D.date, man = P.manualOf(S, date), skipped = D.skipped || [];
    const hasManual = Object.keys(man).length > 0 || !!(S.layout && S.layout[date]);
    let html = `<div class="tltools"><button class="btn sm primary" data-action="addopen" data-date="${date}">＋ 일정 추가</button>${hasManual ? `<button class="btn sm ghost" data-action="resetday" data-date="${date}">자동 배치로 되돌리기</button>` : ''}</div>`;
    html += h.addForm(S, date);
    if (skipped.length) {
      html += `<div class="skipped"><span class="muted small">이 날 뺀 항목</span>${skipped.map(k => `<button class="chip" data-action="unpin" data-date="${date}" data-id="${esc(k)}" title="다시 넣기">${esc(h.titleByKey(S, k))} <b>↩</b></button>`).join('')}</div>`;
    }
    return html;
  };

  // ---------- 1자습·2자습 간단 이동 ----------
  // 그날 공부 시간대(자습 시간: 설정의 1자습, 2자습 …)가 둘 이상일 때, 항목 옆에 ‘1자습’ ‘2자습’ 키를 붙인다. 누르면 그 시간대의 가장 이른 빈 자리로 옮긴다.
  h.sessionKeys = (S, e, date) => {
    const base = P.baseBlocks(S, date);
    if (base.length < 2) return '';
    const cur = e.pieces && e.pieces.length ? e.pieces[0][0] : null;
    return `<span class="sess">${base.map(([a, b], i) => `<button type="button" class="sk ${cur != null && cur >= a && cur < b ? 'on' : ''}" data-action="tosess" data-date="${date}" data-id="${esc(e.id)}" data-i="${i}" title="${i + 1}자습 (${P.t12(a)}~${P.t12(b)})으로 이동">${i + 1}자습</button>`).join('')}</span>`;
  };
  A.moveToSession = function (date, id, idx) {
    const S = A.S, D = A.PLAN.days.find(x => x.date === date);
    const blk = P.baseBlocks(S, date)[idx], e = D && D.entries.find(x => x.id === id);
    if (!blk || !e) return;
    const a = D.t === 0 ? Math.max(blk[0], D.nowMin || 0) : blk[0];           // 오늘은 이미 지난 시간으로는 옮기지 않는다
    const taken = D.entries.filter(x => x.id !== id).flatMap(x => x.pieces);
    const start = P.firstFit(a, blk[1], taken, e.min);
    if (start == null) { A.toast(`${idx + 1}자습(${P.t12(blk[0])}~${P.t12(blk[1])})에는 빈 자리가 부족해요`, true); return; }
    A.freezeDay(date);                                                          // 다른 블록은 그대로 둔다
    if (e.custom) { e.custom.start = start; if (e.carried) e.custom.date = date; A.save(); A.render(); }
    else A.setManual(date, id, { start });
    A.toast(`${idx + 1}자습(${P.t12(blk[0])}~${P.t12(blk[1])})으로 옮겼어요 · ${P.t12(start)}`);
  };

  // ---------- 드래그 ----------
  let drag = null;

  function resolve(start, dur, others) {
    start = Math.max(0, Math.min(P.DAY_END - dur, start));
    for (let it = 0; it < 8; it++) {
      const hit = others.find(([a, b]) => start < b && start + dur > a);
      if (!hit) break;
      const after = hit[1], before = hit[0] - dur;
      start = (before < 0 || after - start <= start - before) ? after : before;
      start = Math.max(0, Math.min(P.DAY_END - dur, start));
    }
    return start;
  }

  function liveText(d) {
    const s = parseInt(d.tb.dataset.ls, 10), dur = parseInt(d.tb.dataset.ld, 10);
    return `${P.range12(s, s + dur)} · ${dur}분`;
  }

  function commit(d, newStart, newDur) {
    const D = A.PLAN.days.find(x => x.date === d.date);
    const e = D && D.entries.find(x => x.id === d.id);
    if (!e) { A.render(); return; }
    A.freezeDay(d.date);
    const others = D.entries.filter(x => x.pinned && x.id !== e.id && x.pieces.length).map(x => x.pieces[0]);
    if (e.custom) {                                  // 내 일정은 항목 자체를 고친다
      const c = e.custom;
      if (c.start == null && e.pieces.length) c.start = e.pieces[0][0];      // 자동 배치된 할당 일정은 끌면 그 시각으로 고정
      if (e.carried) c.date = d.date;                                         // 이월된 건 끌면 오늘 것으로 확정
      if (d.mode === 'move') c.start = resolve(newStart, c.dur, others);
      else {
        let dur = Math.max(5, newDur);
        const nxt = others.filter(([a]) => a >= c.start + 1).sort((p, q) => p[0] - q[0])[0];
        if (nxt) dur = Math.max(5, Math.min(dur, nxt[0] - c.start));
        c.dur = Math.min(dur, P.DAY_END - c.start);
      }
      A.save(); A.render();
      return;
    }
    if (d.mode === 'move') {
      const offset = e.pieces.slice(0, d.pi).reduce((a, p) => a + (p[1] - p[0]), 0);
      A.setManual(d.date, d.id, { start: resolve(newStart - offset, e.min, others) });
    } else {
      const total = Math.max(5, e.min - d.d + newDur);
      const start = e.pieces[0][0];
      let dur = total;
      const nxt = others.filter(([a]) => a >= start + 1).sort((p, q) => p[0] - q[0])[0];
      if (nxt) dur = Math.max(5, Math.min(dur, nxt[0] - start));
      A.setManual(d.date, d.id, { start, dur: dur + (e.spentExam || e.spent || 0) });
    }
  }

  function scrollRow(id) {
    const r = document.querySelector(`[data-row="${CSS.escape(id)}"]`);
    if (r) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  document.addEventListener('pointerdown', ev => {
    if (A.RO) return;                                                              // 보기 전용: 끌어 옮기기 없음
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.target.closest('[data-action]')) return;
    const tb = ev.target.closest('.tb');
    if (!tb) return;
    const tl = tb.closest('.tl');
    drag = {
      tb, tl, id: tb.dataset.id, pi: +tb.dataset.pi, date: tl.dataset.date,
      s: +tb.dataset.s, d: +tb.dataset.d, y0: ev.clientY, moved: false,
      mode: ev.target.closest('.rz') ? 'resize' : 'move', editable: tl.classList.contains('edit')
    };
    tb.dataset.ls = drag.s; tb.dataset.ld = drag.d;
    try { tb.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
    ev.preventDefault();
  });

  document.addEventListener('pointermove', ev => {
    if (!drag) return;
    const dy = ev.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 4) return;
    if (!drag.editable) return;
    if (!drag.moved) { drag.moved = true; A.ui.dragging = true; drag.tb.classList.add('drag'); }
    const dm = Math.round(dy / PPM / SNAP) * SNAP, t0 = +drag.tl.dataset.t0;
    if (drag.mode === 'move') {
      const s = Math.max(0, Math.min(P.DAY_END - drag.d, drag.s + dm));
      drag.tb.style.top = ((s - t0) * PPM) + 'px';
      drag.tb.dataset.ls = s; drag.tb.dataset.ld = drag.d;
    } else {
      const dur = Math.max(5, Math.min(P.DAY_END - drag.s, drag.d + dm));
      drag.tb.style.height = Math.max(dur * PPM - 2, 18) + 'px';
      drag.tb.dataset.ls = drag.s; drag.tb.dataset.ld = dur;
    }
    const tm = drag.tb.querySelector('.tm');
    if (tm) tm.textContent = liveText(drag);
  });

  function finishDrag(cancel) {
    if (!drag) return;
    const d = drag;
    drag = null;
    A.ui.dragging = false;
    d.tb.classList.remove('drag');
    if (cancel) { A.render(); return; }
    if (!d.moved) { A.ui.sel = d.id; A.ui.open = d.id; A.render(); scrollRow(d.id); return; }
    commit(d, parseInt(d.tb.dataset.ls, 10), parseInt(d.tb.dataset.ld, 10));
  }
  document.addEventListener('pointerup', () => finishDrag(false));
  document.addEventListener('pointercancel', () => finishDrag(true));

  // ---------- 일정 추가 / 삭제 ----------
  function openAdd(date, startMin) {
    const S = A.S;
    let m = startMin;
    if (m == null) {
      const b = P.blocksFor(S, date)[0], first = b ? b[0] : 18 * 60 + 30;
      m = date === P.today() ? Math.max(Math.ceil(P.nowMin() / 15) * 15, first) : first;
    }
    m = Math.max(0, Math.min(P.DAY_END - 15, Math.round(m / 15) * 15));
    A.ui.addForm = { date, title: '', kind: 'todo', start: P.hm(m), dur: 30, ref: '' };
    A.render();
    const t = document.getElementById('af-title');
    if (t) { t.focus(); t.scrollIntoView({ block: 'nearest' }); }
  }
  document.addEventListener('dblclick', ev => {
    const tl = ev.target.closest('.tl.edit');
    if (!tl || ev.target.closest('.tb') || ev.target.closest('[data-action]')) return;
    const y = ev.clientY - tl.getBoundingClientRect().top;
    openAdd(tl.dataset.date, +tl.dataset.t0 + y / PPM);
  });

  const Ac = A.actions;
  Ac.addopen = el => openAdd(el.dataset.date, null);
  Ac.addcancel = () => { A.ui.addForm = null; A.render(); };
  Ac.addref = el => {
    const f = A.ui.addForm, pick = f && h.todoPicks(A.S).find(c => c.ref === el.dataset.ref);
    if (!pick) return;
    const typed = h.val('af-title');
    if (f.ref === pick.ref) { f.ref = ''; f.title = typed || f.title; }
    else { f.ref = pick.ref; f.title = pick.title; f.kind = 'todo'; }
    A.render();
  };
  Ac.addcustom = () => {
    const f = A.ui.addForm, S = A.S;
    if (!f) return;
    const title = (h.val('af-title') || f.title || '').trim(), start = P.toMin(f.start);
    if (!title) { A.toast('제목을 입력하세요', true); return; }
    if (isNaN(start)) { A.toast('시작 시간을 고르세요', true); return; }
    const dur = Math.max(5, Math.min(+f.dur || 30, P.DAY_END - start));
    A.freezeDay(f.date);
    const c = { id: P.uid(), date: f.date, title, kind: f.kind || 'todo', start, dur, done: false };
    if (f.ref && h.todoPicks(S).some(x => x.ref === f.ref)) c.ref = f.ref;       // 기존 할 일에 묶는다 (해결 예정으로 표시됨)
    S.custom.push(c);
    A.ui.addForm = null;
    A.save(); A.render();
    A.toast(c.ref ? `해결 예정으로 잡았어요 · ${h.md(f.date)} ${P.t12(start)}` : `${f.kind === 'event' ? '일정' : '할 일'}을 추가했어요`);
  };
  Ac.delentry = el => {
    const id = el.dataset.id, date = el.dataset.date, S = A.S;
    A.freezeDay(date);
    if (id.startsWith('cu|')) {
      const i = S.custom.findIndex(c => c.id === id.slice(3));
      if (i >= 0) {
        const al = S.custom[i].alloc;
        S.custom.splice(i, 1); delete S.acc[id]; if (S.timer && S.timer.key === id) S.timer = null; A.save(); A.render();
        if (al) A.toast('배정을 풀었어요 · 할당의 대기로 돌아갔어요');
      }
    } else A.setManual(date, id, { skip: true });
  };
  Ac.unpin = el => A.clearManual(el.dataset.date, el.dataset.id);
  Ac.tosess = el => A.moveToSession(el.dataset.date, el.dataset.id, +el.dataset.i);
  Ac.resetday = el => A.clearManual(el.dataset.date);
})();
