/* core.js — 상태 로드/저장, 렌더 루프, 이벤트 위임, 타이머, 시간 기록 */
(function () {
  'use strict';
  const P = window.Planner;
  const A = window.App = {
    S: null, ENV: {}, PLAN: null, views: {}, actions: {}, onShow: {}, h: {},
    ui: { tab: 'today', finish: null, imp: { text: '', parsed: null }, inbox: null, imports: null, prompts: {}, openLesson: '', taskForm: null,
      open: null, sel: null, calMonth: null, calSel: null, dragging: false }
  };
  const h = A.h;
  const TABS = [['home', '홈'], ['today', '오늘'], ['plan', '계획'], ['routine', '루틴'], ['alloc', '할당'], ['work', '시험·과제'], ['notes', '노트'], ['settings', '설정']];

  // ---------- 헬퍼 ----------
  h.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  h.fmtMin = m => {
    m = Math.round(m);
    if (m < 60) return m + '분';
    const hh = Math.floor(m / 60), r = m % 60;
    return r ? `${hh}시간 ${r}분` : `${hh}시간`;
  };
  h.md = d => { const x = P.parse(d); return `${x.getMonth() + 1}/${x.getDate()}(${P.DOW[x.getDay()]})`; };
  h.val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  h.dday = (d, today) => { const n = P.diffDays(today || P.today(), d); return n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`; };
  h.fmtStamp = iso => { const d = new Date(iso); if (isNaN(d)) return ''; const hh = d.getHours(); return `${d.getMonth() + 1}/${d.getDate()} ${hh % 12 || 12}:${P.pad(d.getMinutes())} ${hh < 12 ? 'AM' : 'PM'}`; };
  h.clock = ms => {
    const s = Math.max(0, Math.floor(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
    return (hh ? hh + ':' + P.pad(mm) : P.pad(mm)) + ':' + P.pad(ss);
  };
  h.copy = async text => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* noop */ }
      ta.remove(); return ok;
    }
  };
  const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, path, v) => { const p = path.split('.'); let t = o; for (let i = 0; i < p.length - 1; i++) t = t[p[i]]; t[p[p.length - 1]] = v; };

  A.getPath = getPath; A.setPath = setPath;

  async function api(path, body) {
    const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(path, opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }
  A.api = api;

  // undo = { label, fn }: 토스트에 되돌리기 버튼을 붙인다 (잠시 더 오래 보인다)
  A.toast = (msg, bad, undo) => {
    const el = document.getElementById('toast');
    el.textContent = msg;
    if (undo) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'toast-undo'; b.textContent = undo.label || '되돌리기';
      b.onclick = () => { clearTimeout(A._tt); el.className = ''; undo.fn(); };
      el.appendChild(b);
    }
    el.className = 'show' + (bad ? ' bad' : '') + (undo ? ' act' : '');
    clearTimeout(A._tt); A._tt = setTimeout(() => { el.className = ''; }, undo ? 7000 : 3600);
  };

  // ---------- 저장 ----------
  let saveTimer = null, dirty = false;
  const setStatus = t => { const el = document.getElementById('savestate'); if (el) el.textContent = t; };
  async function flush() {
    clearTimeout(saveTimer);
    if (!dirty) return;
    dirty = false;
    try { await api('/api/state', A.S); setStatus('저장됨'); }
    catch (e) { dirty = true; setStatus('저장 실패'); A.toast('저장 실패: ' + e.message, true); }
  }
  A.flush = flush;
  let roToastAt = 0;
  A.save = () => {
    if (A.RO) {                                                                    // 보기 전용 사이트: 고친 내용은 저장하지 않는다
      if (Date.now() - roToastAt > 8000) { roToastAt = Date.now(); A.toast('보기 전용이에요 — 고친 내용은 저장되지 않고 새로고침하면 사라져요', true); }
      return;
    }
    dirty = true; setStatus('저장 중…'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300);
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('beforeunload', () => {
    if (dirty && navigator.sendBeacon) navigator.sendBeacon('/api/state', new Blob([JSON.stringify(A.S)], { type: 'application/json' }));
  });

  // ---------- 렌더 ----------
  function renderHeader() {
    const S = A.S, today = P.today();
    const next = S.exams.filter(e => e.date && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    const prev = document.getElementById('savestate');
    const keep = prev ? prev.textContent : '';
    document.getElementById('top').innerHTML = `
      <div class="wrap bar">
        <div class="brand" data-action="tab" data-tab="home" title="홈으로">기말 플래너${next ? `<span class="dd">${h.dday(next.date)} · 첫 시험 ${h.md(next.date)}</span>` : ''}</div>
        <nav>${TABS.map(([k, n]) => `<button class="tab ${A.ui.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}">${n}</button>`).join('')}</nav>
        <span id="savestate" class="muted small">${h.esc(keep)}</span>
        <button type="button" class="btn sm ghost themebtn" data-action="theme" title="화면 모드 바꾸기 (자동 → 라이트 → 다크)">${THEMES[S.settings.theme] ? THEMES[S.settings.theme][0] : THEMES.system[0]}<span class="tm-t"> ${(THEMES[S.settings.theme] || THEMES.system)[1]}</span></button>
      </div>
      ${A.RO ? `<div class="wrap robanner">👁 보기 전용 · ${A.ENV.publishedAt ? `마지막 업데이트 ${h.fmtStamp(A.ENV.publishedAt)}` : '올려 둔 복사본'} <span class="muted small">— 체크·수정은 PC의 앱에서 해요</span></div>` : ''}
      ${S.timer ? `<div class="wrap timerbar"><span>⏱ <b>${h.esc(S.timer.label)}</b> <span data-timerbar></span></span><button class="btn sm" data-action="timerstop">정지</button></div>` : ''}`;
    document.documentElement.style.setProperty('--hdr', document.getElementById('top').offsetHeight + 'px');   // 고정되는 칸이 헤더(타이머 줄 포함) 아래에 붙도록
    const nv = document.querySelector('#top nav'), on = nv && nv.querySelector('.tab.on');   // 좁은 화면: 현재 탭이 보이도록 탭 줄을 맞춘다
    if (on && nv.scrollWidth > nv.clientWidth) nv.scrollLeft = Math.max(0, on.getBoundingClientRect().left - nv.getBoundingClientRect().left + nv.scrollLeft - 24);
  }

  A.render = function () {
    if (!A.S) return;
    A.PLAN = P.plan(A.S);
    renderHeader();
    const y = window.scrollY;
    const w0 = document.querySelector('.tlwrap'), t0 = w0 && w0.querySelector('.tl');
    const keep = w0 && t0 ? { date: t0.dataset.date, top: w0.scrollTop } : null;
    const wk0 = document.querySelector('.wk-wrap'), wkTop = wk0 ? wk0.scrollTop : null;
    document.getElementById('main').innerHTML = (A.views[A.ui.tab] || A.views.today)(A.S, A.PLAN);
    window.scrollTo(0, y);
    const w1 = document.querySelector('.tlwrap'), t1 = w1 && w1.querySelector('.tl');
    if (w1 && t1) {
      if (keep && keep.date === t1.dataset.date) w1.scrollTop = keep.top;
      else {
        const target = t1.querySelector('.now') || t1.querySelector('.tb');
        if (target) w1.scrollTop = Math.max(0, target.offsetTop - 60);
      }
    }
    const wk1 = document.querySelector('.wk-wrap');
    if (wk1) {
      if (wkTop != null) wk1.scrollTop = wkTop;
      else { const f = wk1.querySelector('.wb'); wk1.scrollTop = f ? Math.max(0, f.offsetTop - 80) : Math.max(0, (18 * 60 - (+wk1.closest('.wk').dataset.t0)) * 1.2 - 40); }
    }
    tick();
  };
  let pending = false, mouseDown = false;
  A.renderSoon = () => { if (mouseDown) pending = true; else A.render(); };
  document.addEventListener('mousedown', () => { mouseDown = true; }, true);
  document.addEventListener('mouseup', () => {
    mouseDown = false;
    if (pending) setTimeout(() => { if (pending) { pending = false; A.render(); } }, 0);
  }, true);

  function tick() {
    const S = A.S;
    if (!S) return;
    document.querySelectorAll('[data-timer]').forEach(el => {
      const k = el.dataset.timer;
      let ms = (S.acc[k] || 0) * 60000;
      if (S.timer && S.timer.key === k) ms += Date.now() - S.timer.startedAt;
      el.textContent = ms >= 1000 ? h.clock(ms) : '';
    });
    const tb = document.querySelector('[data-timerbar]');
    if (tb && S.timer) tb.textContent = h.clock(Date.now() - S.timer.startedAt);
  }
  setInterval(tick, 1000);
  setInterval(() => {
    const ae = document.activeElement;
    if (!document.hidden && !A.ui.dragging && (A.ui.tab === 'home' || A.ui.tab === 'today' || A.ui.tab === 'plan') && !(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) A.render();
  }, 60000);

  // ---------- 이벤트 위임 ----------
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const fn = A.actions[el.dataset.action];
    if (!fn) return;
    try { fn(el, ev); } catch (e) { console.error(e); A.toast('오류: ' + e.message, true); }
  });

  // data-enter="버튼id" 인 입력칸에서 Enter 를 누르면 그 버튼을 누른다 (한글 조합 중의 Enter 는 무시)
  document.addEventListener('keydown', ev => {
    const el = ev.target;
    if (ev.key !== 'Enter' || ev.isComposing || ev.keyCode === 229 || !el.dataset || !el.dataset.enter) return;
    const b = document.getElementById(el.dataset.enter);
    if (b) { ev.preventDefault(); b.click(); }
  });

  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-bind]');
    if (!el) return;
    const type = el.dataset.type || 'str', path = el.dataset.bind;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (type === 'int') { v = parseInt(el.value, 10); if (isNaN(v)) v = null; }
    else if (type === 'tmin') v = el.value ? P.toMin(el.value) : null;     // 'HH:MM' 선택 → 분 (비우면 null)
    else if (type === 'hours') { v = Math.round(parseFloat(el.value) * 60); if (isNaN(v)) v = 0; }
    else if (type === 'list') v = el.value.split(',').map(s => s.trim()).filter(Boolean);
    else if (type === 'hm') {
      const m = /^(\d{1,2}):(\d{2})$/.exec(el.value.trim());
      if (el.value.trim() === '') v = '';
      else if (!m || +m[1] > 24 || +m[2] > 59 || (+m[1] === 24 && +m[2] > 0)) {
        A.toast('시간은 HH:MM 형식으로 입력하세요 (예: 18:30)', true);
        el.value = getPath(path.startsWith('ui.') ? A : A.S, path) || '';
        return;
      } else { v = P.pad(+m[1]) + ':' + m[2]; el.value = v; }
    } else v = el.value;
    const isUi = path.startsWith('ui.');
    setPath(isUi ? A : A.S, path, v);
    if (!isUi) A.save();
    if (el.hasAttribute('data-render')) A.renderSoon();
  });
  document.addEventListener('input', ev => { if (ev.target.id === 'imp-text') A.ui.imp.text = ev.target.value; });

  // ---------- 탭 ----------
  A.setTab = function (tab) {
    if (!A.views[tab]) tab = 'today';
    if (tab !== A.ui.tab) A.ui.evForm = null;      // 열어 둔 일정 입력 폼은 탭을 옮기면 닫는다
    A.ui.tab = tab;
    if (location.hash.slice(1) !== tab) history.replaceState(null, '', '#' + tab);
    if (A.onShow[tab]) A.onShow[tab]();
    A.render();
    window.scrollTo(0, 0);
  };
  A.actions.tab = el => A.setTab(el.dataset.tab);

  // ---------- 화면 모드 (자동 = Windows 설정을 따름 / 라이트 / 다크) ----------
  const THEMES = { system: ['◐', '자동'], light: ['☀', '라이트'], dark: ['☾', '다크'] };
  A.applyTheme = t => {
    t = THEMES[t] ? t : 'system';
    const r = document.documentElement;
    if (t === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
    try { localStorage.setItem('planner-theme', t); } catch (e) { /* 저장소를 못 쓰면 이번 접속에만 적용 */ }
  };
  A.setTheme = t => { A.S.settings.theme = THEMES[t] ? t : 'system'; A.applyTheme(A.S.settings.theme); if (!A.RO) A.save(); A.render(); };
  A.actions.theme = () => {
    const order = Object.keys(THEMES), cur = THEMES[A.S.settings.theme] ? A.S.settings.theme : 'system';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    A.setTheme(next);
    A.toast(`화면 모드: ${THEMES[next][1]}${next === 'system' ? ' (Windows 설정을 따라요)' : ''}`);
  };
  A.actions.settheme = el => A.setTheme(el.dataset.val);
  A.actions.timerstop = () => A.timerStop();
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== A.ui.tab) A.setTab(t); });

  // ---------- 타이머 / 시간 기록 ----------
  const isJob = k => /^(exam|final|task)\|/.test(k);
  A.isJob = isJob;

  A.timerStart = function (key, label) {
    const S = A.S;
    if (S.timer && S.timer.key === key) return;
    if (S.timer) A.timerStop(true);
    S.timer = { key, label, startedAt: Date.now() };
    A.save(); A.render();
  };
  A.timerStop = function (silent) {
    const S = A.S, t = S.timer;
    if (!t) return;
    let m = (Date.now() - t.startedAt) / 60000;
    S.timer = null;
    if (m > 180) {
      const a = window.prompt(`타이머가 ${Math.round(m)}분 동안 켜져 있었어요. 실제로 몇 분 공부했나요?`, '0');
      m = Math.max(0, parseFloat(a) || 0);
    }
    if (isJob(t.key)) { if (m >= 0.5) A.addWork(t.key, Math.max(1, Math.round(m)), 'timer'); }
    else S.acc[t.key] = (S.acc[t.key] || 0) + m;
    if (!silent) { A.save(); A.render(); }
  };

  function applyJobMinutes(jobId, delta) {
    const S = A.S, [kind, id] = jobId.split('|');
    if (kind === 'exam' || kind === 'final') {
      const e = S.exams.find(x => x.id === id);
      if (!e) return '';
      if (kind === 'exam') e.partial = Math.max(0, (e.partial || 0) + delta);
      else e.finalSpent = Math.max(0, (e.finalSpent || 0) + delta);
      return e.sid;
    }
    const t = S.tasks.find(x => x.id === id);
    if (!t) return '';
    t.spent = Math.max(0, (t.spent || 0) + delta);
    return t.sid || '';
  }
  A.addWork = function (jobId, min, src, quiet) {
    const S = A.S, today = P.today();
    if (S.timer && S.timer.key === jobId && src !== 'timer') S.timer = null; // 직접 기록하면 같은 작업의 타이머는 버린다
    const sid = applyJobMinutes(jobId, min);
    S.work.push({ date: today, key: jobId, min, src, ts: Date.now() });
    S.log.push({ ts: Date.now(), date: today, key: jobId, kind: jobId.split('|')[0], sid, est: 0, act: min, src });
    if (!quiet) { A.save(); A.render(); }
  };
  A.undoWork = function (jobId) {
    const S = A.S, today = P.today();
    let i = -1;
    for (let k = S.work.length - 1; k >= 0; k--) if (S.work[k].key === jobId && S.work[k].date === today) { i = k; break; }
    if (i < 0) return;
    const w = S.work.splice(i, 1)[0];
    applyJobMinutes(jobId, -w.min);
    for (let k = S.log.length - 1; k >= 0; k--) if (S.log[k].key === jobId && S.log[k].ts === w.ts) { S.log.splice(k, 1); break; }
    A.save(); A.render();
  };

  // 기존 할 일에 묶인 일정(c.ref)을 끝내면 그 할 일도 처리: 중요 할 일은 끝냄, 과제는 걸린 시간을 기록
  A.linkDone = (c, actual) => {
    if (c.alloc) { const f = P.allocFind(A.S, c.alloc); if (f && !f.item.done) { f.item.done = true; f.item.doneDate = P.today(); c.allocDone = true; } }   // 할당 항목 완료
    if (!c.ref) return;
    const S = A.S, i = c.ref.indexOf(':'), kind = c.ref.slice(0, i), id = c.ref.slice(i + 1);
    if (kind === 'imp') { const it = S.important.find(x => x.id === id); if (it && !it.done) { it.done = true; c.refDone = true; } }
    else if (kind === 'task' && S.tasks.some(t => t.id === id && !t.done)) { A.addWork('task|' + id, actual, 'done', true); c.refWork = actual; }
  };
  A.linkUndo = c => {
    if (c.allocDone) { const f = P.allocFind(A.S, c.alloc); if (f) { f.item.done = false; delete f.item.doneDate; } delete c.allocDone; }
    delete c.doneDate;
    if (!c.ref) return;
    const S = A.S, i = c.ref.indexOf(':'), kind = c.ref.slice(0, i), id = c.ref.slice(i + 1);
    if (c.refDone) { const it = S.important.find(x => x.id === id); if (it) it.done = false; delete c.refDone; }
    if (c.refWork) { delete c.refWork; A.undoWork('task|' + id); }
  };
  A.finishItem = function (key, actual) {
    const S = A.S, parts = key.split('|');
    if (parts[0] === 'st' || parts[0] === 'rb' || parts[0] === 'rr') return A.finishStudy(key, actual);
    actual = Math.max(1, Math.round(actual));
    if (S.timer && S.timer.key === key) S.timer = null;
    delete S.acc[key];
    const e = A.PLAN.days[0].entries.find(x => x.id === key);
    if (parts[0] === 'cu') {                       // 내가 추가한 공부 할 일
      const c = S.custom.find(x => x.id === parts[1]);
      if (c) { c.done = true; c.actual = actual; c.doneDate = P.today(); A.linkDone(c, actual); }
      S.log.push({ ts: Date.now(), date: P.today(), key, kind: 'custom', sid: '', est: e ? e.min : 0, act: actual, src: 'done' });
    } else {
      const kind = parts[0] === 'rev' ? 'review' : 'preview', sid = parts[2];
      S.progress[key] = { done: true, actual, doneDate: P.today(), ts: Date.now() };
      S.log.push({ ts: Date.now(), date: P.today(), key, kind, sid, est: e ? e.min : 0, act: actual, src: 'done' });
    }
    A.ui.finish = null;
    A.save(); A.render();
  };
  // 과목 블록 완료: 걸린 시간을 부분(복습·예습·시험 대비)의 계획 시간 비율로 나눠 기록한다
  A.finishStudy = function (key, actual) {
    const S = A.S, today = P.today();
    const e = A.PLAN.days[0].entries.find(x => x.id === key);
    if (!e) return;
    actual = Math.max(1, Math.round(actual));
    if (S.timer && S.timer.key === key) S.timer = null;
    delete S.acc[key];
    const total = e.parts.reduce((a, p) => a + p.min, 0) || 1;
    let left = actual;
    e.parts.forEach((p, i) => {
      const share = i === e.parts.length - 1 ? left : Math.max(0, Math.min(left, Math.round(actual * p.min / total)));
      left -= share;
      if (p.item) {
        const act = Math.max(1, share);
        S.progress[p.item.key] = { done: true, actual: act, doneDate: today, ts: Date.now() };
        S.log.push({ ts: Date.now(), date: today, key: p.item.key, kind: p.k, sid: e.sid, est: p.min, act, src: 'done' });
      } else if (share > 0) A.addWork(p.job.id, share, 'done', true);
    });
    A.ui.finish = null;
    A.save(); A.render();
  };
  A.undoItem = function (key) {
    const S = A.S;
    if (key.startsWith('cu|')) { const c = S.custom.find(x => x.id === key.slice(3)); if (c) { c.done = false; delete c.actual; A.linkUndo(c); } }
    else delete S.progress[key];
    for (let k = S.log.length - 1; k >= 0; k--) if (S.log[k].key === key) { S.log.splice(k, 1); break; }
    A.save(); A.render();
  };

  A.toggleChapter = function (exId, i, done) {
    const e = A.S.exams.find(x => x.id === exId);
    if (!e || !e.scope[i]) return;
    const c = e.scope[i];
    c.done = !!done;
    if (done) e.partial = Math.max(0, (e.partial || 0) - (c.min || A.S.settings.minDefaults.chapter));
    A.save(); A.render();
  };

  // ---------- 손으로 고정한 시간 ----------
  A.setManual = function (date, id, patch) {
    const S = A.S;
    S.manual[date] = S.manual[date] || {};
    S.manual[date][id] = Object.assign({}, S.manual[date][id], patch);
    A.save(); A.render();
  };
  A.clearManual = function (date, id) {
    const S = A.S;
    if (id) {
      if (S.manual[date]) { delete S.manual[date][id]; if (!Object.keys(S.manual[date]).length) delete S.manual[date]; }
      if (S.layout[date]) { delete S.layout[date][id]; if (!Object.keys(S.layout[date]).length) delete S.layout[date]; }
    } else { delete S.manual[date]; delete S.layout[date]; }
    A.save(); A.render();
  };
  // 한 블록을 옮기거나 빼기 전에 그날 나머지 블록의 현재 자리를 고정해 둔다 → 다른 블록이 따라 움직이지 않는다
  A.freezeDay = function (date) {
    const S = A.S;
    if (S.layout[date]) return;
    const D = A.PLAN.days.find(x => x.date === date);
    if (!D) return;
    const L = {};
    for (const e of D.entries) if ((!e.custom || (e.custom.start == null && !e.carried)) && e.pieces.length === 1) L[e.id] = e.pieces[0][0];
    S.layout[date] = L;
  };

  // ---------- 로더 ----------
  A.loadInbox = async function () {
    if (A.RO) { A.ui.inbox = { files: [], error: '보기 전용 사이트에서는 파일 정리를 쓸 수 없어요' }; return; }
    await flush(); // 서버는 저장된 설정(폴더 경로)을 읽으므로 먼저 저장을 끝낸다
    try { A.ui.inbox = await api('/api/inbox'); } catch (e) { A.ui.inbox = { files: [], error: e.message }; }
    if (A.ui.tab === 'notes') A.renderSoon();
  };
  A.loadImports = async function () {
    if (A.RO) { A.ui.imports = { files: [] }; return; }
    await flush();
    try { A.ui.imports = await api('/api/imports'); } catch (e) { A.ui.imports = { files: [], error: e.message }; }
    if (A.ui.tab === 'notes') A.renderSoon();
  };

  // ---------- 부팅 ----------
  function migrate(S) {
    const D = P.defaultState(A.ENV), DS = P.defaultSettings(A.ENV);
    S.settings = Object.assign({}, DS, S.settings || {});
    S.settings.minDefaults = Object.assign({}, DS.minDefaults, S.settings.minDefaults || {});
    for (const k of ['subjects', 'timetable', 'fixed', 'milestones', 'exams', 'tasks', 'work', 'log', 'custom', 'routines', 'important', 'allocs']) if (!Array.isArray(S[k])) S[k] = D[k];
    for (const k of ['dayOverrides', 'lessons', 'progress', 'checks', 'acc', 'layout']) if (!S[k] || typeof S[k] !== 'object') S[k] = {};
    for (const r of S.routines) { r.starts = r.starts || {}; r.durs = r.durs || {}; }
    for (const sb of S.subjects) { sb.rvStarts = sb.rvStarts || {}; sb.rvDurs = sb.rvDurs || {}; }
    // 한 번만: 예전엔 시각이 요일마다 따로 저장됐다. 정해 둔 시각이 전부 같으면 ‘모든 요일의 기본’으로 승격해 반복되게 한다.
    S.migr = S.migr && typeof S.migr === 'object' ? S.migr : {};
    if (!S.migr.defaultStart) {
      const same = o => { const v = Object.values(o); return v.length > 0 && v.every(x => x === v[0]) ? v[0] : null; };
      for (const r of S.routines) {
        const t = same(r.starts), m = same(r.durs);
        if (r.start == null && t != null) { r.start = t; r.starts = {}; }
        if (m != null && m !== r.min) { r.min = m; r.durs = {}; }
      }
      for (const sb of S.subjects) {
        const t = same(sb.rvStarts);
        if (sb.rvStart == null && t != null) { sb.rvStart = t; sb.rvStarts = {}; }
      }
      S.migr.defaultStart = true;
      A._migrated = true;
    }
    if (!('timer' in S)) S.timer = null;
    if (!S.manual || typeof S.manual !== 'object') S.manual = {};
    if (JSON.stringify(S.settings.weekendBlocks) === JSON.stringify([['18:30', '21:00'], ['21:30', '24:00']])) S.settings.weekendBlocks = [['08:00', '24:00']];
    const t0 = P.today();
    for (const d of Object.keys(S.manual)) if (d < t0) delete S.manual[d];
    for (const d of Object.keys(S.layout)) if (d < t0) delete S.layout[d];
    if (!S.settings.studyRoot && A.ENV.studyRoot) S.settings.studyRoot = A.ENV.studyRoot;
    if (!S.settings.inbox && A.ENV.inbox) S.settings.inbox = A.ENV.inbox;
    return S;
  }

  A.boot = async function () {
    try {
      // 서버가 없는 곳(GitHub Pages 등)이면 올려 둔 복사본(snapshot.json)을 보기 전용으로 연다
      const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname), forceRO = !local || /[?&]ro\b/.test(location.search);
      let r = null;
      if (!forceRO) { try { r = await api('/api/state'); } catch (e) { r = null; } }
      if (!r) {
        const resp = await fetch('snapshot.json?t=' + Date.now());
        if (!resp.ok) throw new Error('서버에도 올려 둔 복사본에도 연결할 수 없어요');
        const snap = await resp.json();
        A.RO = true; document.body.classList.add('ro'); r = { state: snap.state, env: { publishedAt: snap.publishedAt } };
      }
      A.ENV = r.env || {};
      A.S = migrate(r.state || P.defaultState(A.ENV));
      if (A.RO) { try { const t = localStorage.getItem('planner-theme'); if (t) A.S.settings.theme = t; } catch (e) { /* noop */ } }   // 보기 전용: 이 기기에서 고른 화면 모드를 우선
      A.applyTheme(A.S.settings.theme);
      if (!r.state || A._migrated) A.save();
      A.ui.prompts = A.RO ? {} : await api('/api/prompts').catch(() => ({}));
      const t = location.hash.slice(1);
      A.ui.tab = A.views[t] ? t : 'home';
      if (A.onShow[A.ui.tab]) A.onShow[A.ui.tab]();
      A.render();
    } catch (e) {
      document.getElementById('main').innerHTML = `<div class="card"><h2>서버에 연결할 수 없어요</h2><p>실행.bat 으로 서버를 켠 뒤 새로고침하세요.</p><pre class="prompt">${h.esc(e.message)}</pre></div>`;
    }
  };
})();
