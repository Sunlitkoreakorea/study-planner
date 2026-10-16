/* v_calendar.js — 계획 탭: 월간 캘린더(날짜별 할 일을 크게, 끌어서 다른 날로 옮기기) + 선택한 날의 시간표 */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc, pad = P.pad;

  function cellsOf(ym) {
    const [y, m] = ym.split('-').map(Number);
    const first = `${y}-${pad(m)}-01`;
    const start = P.addDays(first, -P.dow(first));
    const last = P.fmt(new Date(y, m, 0, 12));
    const end = P.addDays(last, 6 - P.dow(last));
    return Array.from({ length: P.diffDays(start, end) + 1 }, (_, i) => P.addDays(start, i));
  }
  const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1, 12); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

  // 하루 요약: 일정(라벨) + 계획 한 줄들 + 합계. drag 가 있는 항목은 다른 날짜 칸으로 끌어 옮길 수 있다.
  function dayInfo(S, PLAN, d) {
    const idx = P.diffDays(PLAN.today, d);
    const info = { events: [], jobs: [], total: 0, parts: { rev: 0, task: 0 }, past: 0 };
    for (const it of S.important) if (it.date === d) info.events.push({ t: '★ ' + it.title, k: it.done ? 'imp done' : 'imp' });   // 중요 할 일은 칸에서 잘리지 않게 맨 앞에
    for (const m of S.milestones) if (m.date <= d && d <= (m.end || m.date)) info.events.push({ t: m.title, k: m.kind || 'etc' });
    for (const e of S.exams) if (e.date === d) {
      const sb = P.subj(S, e.sid);
      info.events.push({ t: `${sb ? sb.short || sb.name : ''} 시험`, k: 'subj', c: sb && sb.color, unconf: !e.confirmed, drag: `exam|${d}|${e.id}` });
    }
    for (const t of S.tasks) if (!t.done && t.due === d) info.events.push({ t: `마감 · ${t.title}`, k: 'deadline' });
    if (idx >= 0 && idx < PLAN.days.length) {
      const D = PLAN.days[idx];
      for (const e of D.entries) {
        if (e.custom && e.custom.kind === 'event') { info.events.push({ t: e.custom.title, k: 'etc', drag: `cu|${d}|${e.id}` }); continue; }   // 내 일정은 공부 총량에 넣지 않는다
        info.total += e.min;
        const sb = P.subj(S, e.sid), c = h.colorOf(S, e);
        if (e.custom) { info.jobs.push({ t: e.custom.title, m: e.min, c, drag: `cu|${d}|${e.id}`, al: !!e.custom.alloc }); info.parts.rev += e.min; continue; }
        if (e.kind === 'task') { info.jobs.push({ t: e.job.title, m: e.min, c, drag: `job|${d}|${e.id}` }); info.parts.task += e.min; continue; }
        // 과목 블록: 시험 대비 몫이 있으면 그 몫을 다른 날로 옮길 수 있다 (복습·예습은 수업 날짜에 묶여 있으므로 그대로)
        info.jobs.push({ t: e.fixedRoutine ? h.fixedTitle(S, e) : (sb ? sb.short || sb.name : ''), m: e.min, c, sub: h.partsLabel(e), drag: e.parts.some(p => p.job) ? `job|${d}|${e.id}` : '' });
        info.parts.rev += e.min;
      }
      info.jobs.sort((a, b) => (b.al ? 2 : b.drag ? 1 : 0) - (a.al ? 2 : a.drag ? 1 : 0));   // 옮길 수 있는 줄(시험 대비·과제)이 칸에서 잘리지 않게 앞에 둔다
    } else if (idx < 0) {
      info.past = S.log.filter(l => l.date === d).reduce((a, l) => a + l.act, 0);
    }
    return info;
  }

  const dragAttr = v => (v ? `draggable="true" data-drag="${esc(v)}"` : '');

  function cell(S, PLAN, d, ym, sel) {
    const inf = dayInfo(S, PLAN, d), w = P.dow(d), today = PLAN.today;
    const total = inf.total || inf.past;
    const seg = (m, k) => (m ? `<i class="${k}" style="width:${Math.min(100, m / 300 * 100)}%"></i>` : '');
    return `<div class="cell ${d.slice(0, 7) !== ym ? 'out' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''} ${w === 0 ? 'sun' : w === 6 ? 'sat' : ''} ${d < today ? 'past' : ''}" role="button" tabindex="0" data-action="calsel" data-date="${d}">
      <span class="dn">${+d.slice(8)}</span>
      <span class="evs">${inf.events.slice(0, 3).map(ev => `<span class="ev ${ev.k}" ${ev.c ? `style="--c:${ev.c}"` : ''} ${dragAttr(ev.drag)}>${esc(ev.t)}${ev.unconf ? '?' : ''}</span>`).join('')}${inf.events.length > 3 ? `<span class="more">+${inf.events.length - 3}</span>` : ''}</span>
      <span class="lns">${inf.jobs.slice(0, 3).map(l => `<span class="ln" ${dragAttr(l.drag)} title="${esc(l.t)}${l.sub ? ' · ' + esc(l.sub) : ''}"><i style="background:${l.c}"></i><em>${esc(l.t)}</em><b>${l.m}분</b></span>`).join('')}${inf.jobs.length > 3 ? `<span class="more">+${inf.jobs.length - 3}개 더</span>` : ''}</span>
      <span class="ft">${total ? `<b>${h.fmtMin(total)}</b>${inf.past ? ' ✓' : ''}` : ''}<span class="mini">${seg(inf.parts.rev, 'k-rev')}${seg(inf.parts.task, 'k-task')}</span></span>
    </div>`;
  }

  function logLabel(S, l) {
    const sb = P.subj(S, l.sid), n = sb ? sb.name : '';
    if (l.kind === 'review') return `${n} 복습`;
    if (l.kind === 'preview') return `${n} 예습`;
    if (l.kind === 'routine') return h.titleByKey(S, l.key);
    if (l.kind === 'custom') return l.key ? h.titleByKey(S, l.key) : '할 일';
    return h.jobTitleByKey(S, l.key);
  }

  h.logLabel = logLabel;

  function detail(S, PLAN, sel) {
    const today = PLAN.today, idx = P.diffDays(today, sel), dt = P.parse(sel);
    const head = `<div class="ph"><h2>${dt.getMonth() + 1}월 ${dt.getDate()}일 ${P.DOW[dt.getDay()]}요일${sel === today ? ' <span class="pill ok">오늘</span>' : ''}</h2><button class="btn sm" data-action="openday" data-date="${sel}" title="오늘 탭의 큰 화면으로 열어요">이 날 열기 ›</button></div>`;
    const inf = dayInfo(S, PLAN, sel);
    const evs = inf.events.length ? `<div class="evl">${inf.events.map(ev => `<span class="ev ${ev.k}" ${ev.c ? `style="--c:${ev.c}"` : ''}>${esc(ev.t)}${ev.unconf ? ' (미확정)' : ''}</span>`).join('')}</div>` : '';
    const ov = S.dayOverrides[sel];
    const off = ov && ov.off ? `<div class="note info">쉬는 날${ov.note ? ' · ' + esc(ov.note) : ''} — 공부 시간이 없는 날이에요.</div>` : '';

    if (idx < 0) {
      const logs = S.log.filter(l => l.date === sel);
      return `<div class="panel" id="daydetail">${head}${evs}${off}${h.impBox(S, sel)}${logs.length ? `<h3>한 일 (${h.fmtMin(inf.past)})</h3>${logs.map(l => `<div class="ms"><span>${esc(logLabel(S, l))}</span><span class="muted small right">${l.act}분</span></div>`).join('')}` : '<div class="hint">기록이 없는 날이에요.</div>'}</div>`;
    }
    if (idx >= PLAN.days.length) return `<div class="panel" id="daydetail">${head}${evs}${h.impBox(S, sel)}<div class="hint">이 날까지 배정된 시험·과제가 없어요. 마감이 이 날 이후인 대회·과제를 추가하면 계획이 여기까지 이어져요.</div></div>`;
    const D = PLAN.days[idx];
    const planned = D.entries.filter(e => !(e.custom && e.custom.kind === 'event')).reduce((a, e) => a + e.min, 0);
    return `<div class="panel" id="daydetail">${head}${evs}${off}${h.impBox(S, sel)}
      <div class="stats"><div><span>가용</span><b>${h.fmtMin(D.raw)}</b></div><div><span>계획</span><b>${h.fmtMin(planned)}</b></div><div><span>여유</span><b>${h.fmtMin(Math.max(0, D.cap - planned))}</b></div></div>${h.tlTools(S, D)}
      ${D.entries.length ? `<div class="mini-list">${D.entries.map(e => `<button class="mi ${A.ui.sel === e.id ? 'sel' : ''}" data-action="selEntry" data-id="${esc(e.id)}" style="--c:${h.colorOf(S, e)}">
        <i class="dot" style="background:${h.colorOf(S, e)}"></i><span class="mt">${esc(h.titleOf(S, e))}</span><span class="muted small">${e.kind === 'study' ? h.partsLabel(e) : h.kindLabel(e)}</span>
        <span class="mm">${e.pieces.length ? P.t12(e.pieces[0][0]) + ' · ' : ''}${h.fmtMin(e.min)}</span></button>`).join('')}</div>` : ''}
      ${D.dropped.length ? `<div class="hint">상한·시간 부족으로 빠진 복습/예습 ${D.dropped.length}개</div>` : ''}
      <div class="hint">${idx === 0 ? '체크·타이머는 오늘 탭에서 해요. 여기서도 끌어서 시간을 바꿀 수 있어요.' : '블록을 끌어 시간을 옮기고, 아래쪽 끝을 끌어 길이를 바꿔요.'}</div>
      <div class="tlwrap">${h.timeline(S, D, { editable: true })}</div></div>`;
  }

  A.views.plan = function (S, PLAN) {
    const today = PLAN.today;
    const ym = A.ui.calMonth || today.slice(0, 7);
    const sel = A.ui.calSel || today;
    const [y, m] = ym.split('-').map(Number);
    const days = cellsOf(ym);
    const al = h.alerts(S, PLAN);
    return `<div class="split cal-split"><section class="cal">
      <div class="calhead"><h1>${y}년 ${m}월</h1><div class="calnav">
        <button class="btn" data-action="calnav" data-d="-1">◀</button><button class="btn" data-action="caltoday">오늘</button><button class="btn" data-action="calnav" data-d="1">▶</button></div></div>
      ${al.urgent}
      ${h.allocTray ? h.allocTray(S) : ''}
      <div class="calgrid"><div class="dow sun">일</div><div class="dow">월</div><div class="dow">화</div><div class="dow">수</div><div class="dow">목</div><div class="dow">금</div><div class="dow sat">토</div>
        ${days.map(d => cell(S, PLAN, d, ym, sel)).join('')}</div>
      <div class="legend"><span><i class="k-rev"></i>공부</span><span><i class="k-task"></i>대회·과제</span><span class="muted">날짜를 누르면 그날의 시간표 · 시험 대비·과제·일정·시험일 라벨은 끌어서 다른 날로 옮길 수 있어요</span></div>
    </section><aside class="pane-r">${detail(S, PLAN, sel)}</aside></div>`;
  };

  // ---------- 액션 ----------
  const Ac = A.actions;
  Ac.calnav = el => { A.ui.calMonth = shiftMonth(A.ui.calMonth || P.today().slice(0, 7), +el.dataset.d); A.render(); };
  Ac.caltoday = () => { A.ui.calMonth = P.today().slice(0, 7); A.ui.calSel = P.today(); A.render(); };
  Ac.calsel = el => {
    A.ui.calSel = el.dataset.date;
    if (el.dataset.date.slice(0, 7) !== (A.ui.calMonth || P.today().slice(0, 7))) A.ui.calMonth = el.dataset.date.slice(0, 7);
    A.render();
    if (window.innerWidth < 980) { const d = document.getElementById('daydetail'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  Ac.selEntry = el => { A.ui.sel = el.dataset.id; A.render(); };
  A.onShow.plan = () => { if (!A.ui.calSel) A.ui.calSel = P.today(); if (!A.ui.calMonth) A.ui.calMonth = P.today().slice(0, 7); };

  // ---------- 캘린더에서 끌어서 다른 날로 옮기기 ----------
  // 값 형식: '종류|원래 날짜|id'  (종류: cu 내 일정 · exam 시험일 · job 시험 대비/과제의 그날 몫)
  A.moveToDate = function (v, target) {
    const S = A.S, PLAN = A.PLAN, today = PLAN.today;
    const type = v.slice(0, v.indexOf('|')), rest = v.slice(type.length + 1), src = rest.slice(0, 10), id = rest.slice(11);
    if (target < today) { A.toast('지난 날짜로는 옮길 수 없어요', true); return; }
    if (target === src) return;
    if (type === 'alloc') { const [aid, iid] = id.split(':'); if (A.assignUnit(aid, iid, target)) A.toast(`${h.md(target)}에 배정했어요`); return; }   // 배정 대기 칩
    if (type === 'cu') {
      const c = S.custom.find(x => x.id === id.slice(3));
      if (!c) return;
      c.date = target; if (c.alloc) c.start = null;       // 할당은 날짜를 옮기면 시각을 비워 그날 빈 시간에 자동 배치
      A.save(); A.render(); A.toast(`${h.md(target)}로 옮겼어요`);
      return;
    }
    if (type === 'exam') {
      const e = S.exams.find(x => x.id === id);
      if (!e) return;
      e.date = target; A.save(); A.render(); A.toast(`시험일을 ${h.md(target)}로 바꿨어요`);
      return;
    }
    if (type === 'job') {
      const sD = PLAN.days[P.diffDays(today, src)], tD = PLAN.days[P.diffDays(today, target)];
      const ent = sD && sD.entries.find(x => x.id === id);
      if (!ent) return;
      const moves = ent.kind === 'task' ? [{ job: ent.job, amt: ent.min }] : ent.parts.filter(p => p.job).map(p => ({ job: p.job, amt: p.min }));
      for (const m of moves) {
        if (target > m.job.deadline) { A.toast(`${m.job.title}은(는) ${h.md(m.job.deadline)}까지만 할 수 있어요`, true); return; }
        if (target < m.job.release) { A.toast(`${m.job.title}은(는) ${h.md(m.job.release)}부터 할 수 있어요`, true); return; }
      }
      S.manual[src] = S.manual[src] || {}; S.manual[target] = S.manual[target] || {};
      for (const m of moves) {
        const existing = tD ? ((tD.work.find(w => w.job.id === m.job.id) || {}).min || 0) : 0;
        S.manual[src][m.job.id] = { skip: true };
        S.manual[target][m.job.id] = { dur: existing + m.amt };
      }
      A.save(); A.render(); A.toast(`${h.md(target)}로 옮겼어요 (되돌리려면 그 날짜의 ‘자동 배치로 되돌리기’)`);
    }
  };

  let dragVal = null, dragY = -1, scrollTimer = null;
  // 끄는 동안 마우스가 화면 위·아래 가장자리에 가면 달력이 저절로 스크롤된다 (멀리 있는 날짜로 끌어다 놓기 쉽게)
  const stopAutoScroll = () => { clearInterval(scrollTimer); scrollTimer = null; dragY = -1; };
  const startAutoScroll = () => {
    stopAutoScroll();
    scrollTimer = setInterval(() => {
      if (dragY < 0) return;
      const H = window.innerHeight, top = 70, bot = H - 100;
      if (dragY < top) window.scrollBy(0, -Math.round(6 + (top - dragY) * 0.45));
      else if (dragY > bot) window.scrollBy(0, Math.round(6 + (dragY - bot) * 0.45));
    }, 16);
  };
  document.addEventListener('dragstart', ev => {
    const el = ev.target.closest && ev.target.closest('[data-drag]');
    if (!el) return;
    if (A.RO) { ev.preventDefault(); return; }                                    // 보기 전용: 끌어 옮기기 없음
    dragVal = el.dataset.drag;
    startAutoScroll();
    ev.dataTransfer.setData('text/plain', dragVal);
    ev.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  document.addEventListener('dragend', () => {
    dragVal = null; stopAutoScroll();
    document.querySelectorAll('.dragging, .dropok').forEach(x => x.classList.remove('dragging', 'dropok'));
  });
  document.addEventListener('dragover', ev => {
    if (dragVal) dragY = ev.clientY;
    const tray = ev.target.closest && ev.target.closest('.alloc-tray');
    if (tray && dragVal && dragVal.startsWith('cu|')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; tray.classList.add('dropok'); return; }
    const c = ev.target.closest && ev.target.closest('.cell');
    if (!c || !dragVal) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.dropok').forEach(x => { if (x !== c) x.classList.remove('dropok'); });
    c.classList.add('dropok');
  });
  document.addEventListener('drop', ev => {
    stopAutoScroll();
    const tray = ev.target.closest && ev.target.closest('.alloc-tray');
    if (tray && dragVal && dragVal.startsWith('cu|')) {
      ev.preventDefault();
      const v = dragVal; dragVal = null;
      document.querySelectorAll('.dragging, .dropok').forEach(x => x.classList.remove('dragging', 'dropok'));
      A.unassignDrag(v);
      return;
    }
    const c = ev.target.closest && ev.target.closest('.cell');
    if (!c || !dragVal) return;
    ev.preventDefault();
    const v = dragVal;
    dragVal = null;
    document.querySelectorAll('.dragging, .dropok').forEach(x => x.classList.remove('dragging', 'dropok'));
    A.moveToDate(v, c.dataset.date);
  });
})();
