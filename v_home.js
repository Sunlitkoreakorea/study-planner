/* v_home.js — 홈 탭: 앞으로 남은 일정을 D-day 로 한눈에 + 오늘 요약.
   중요 할 일(S.important)의 입력 상자·체크·삭제도 여기서 맡는다 (입력 상자는 계획 탭의 날짜 패널에 들어간다). */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc;
  const KIND = { imp: '중요 할 일', task: '마감 · 대회', exam: '시험', etc: '일정' };
  const FILTERS = [['all', '전체'], ['imp', '중요'], ['task', '마감'], ['exam', '시험'], ['etc', '일정']];

  // ---------- 계획 탭 날짜 패널에 들어가는 ‘중요 할 일’ 상자 ----------
  h.impBox = (S, date) => {
    const items = S.important.filter(x => x.date === date);
    return `<section class="impbox"><h3>중요 할 일 <small>홈 화면에 D-day 로 나와요</small></h3>
      ${A.ui.evForm && A.ui.evForm.mode === 'edit' && A.ui.evForm.kind === 'imp' && items.some(x => x.id === A.ui.evForm.id) ? h.evForm() : ''}
      ${items.map(it => `<div class="imp-r ${it.done ? 'done' : ''}">
        <button type="button" class="ick ${it.done ? 'on' : ''}" data-action="impdone" data-id="${esc(it.id)}" title="${it.done ? '다시 안 끝낸 걸로' : '끝냈어요'}">${it.done ? '✓' : ''}</button>
        <span class="imp-t">${esc(it.title)}${h.schedText(S, 'imp:' + it.id, it.date)}</span>
        <button type="button" class="btn sm ghost" data-action="evedit" data-id="imp:${esc(it.id)}" title="고치기">✎</button>
        <button type="button" class="btn sm ghost" data-action="impdel" data-id="${esc(it.id)}" title="지우기">✕</button></div>`).join('')}
      <div class="imp-add"><input type="text" id="imp-title" data-enter="imp-add-btn" maxlength="80" placeholder="예: KSEF 초안 제출, SAT 접수"><button type="button" id="imp-add-btn" class="btn primary sm" data-action="impadd" data-date="${date}">추가</button></div>
    </section>`;
  };

  // ---------- 일정 추가·수정 폼 (홈 위쪽 / 계획 탭 중요 할 일 상자) ----------
  // A.ui.evForm = { mode: 'add'|'edit', kind: 'imp'|'deadline'|'etc'|'exam', id, title, date, end }
  //   imp → S.important 항목, 그 외 → S.milestones(달력 일정) 항목
  h.evForm = () => {
    const f = A.ui.evForm;
    if (!f) return '';
    const add = f.mode === 'add', range = f.kind !== 'imp' && f.kind !== 'deadline';
    return `<div class="addform evform">
      <div class="fl"><label class="wide">${add ? '새 일정' : '일정 고치기'}<input type="text" id="ev-title" data-enter="ev-save" maxlength="80" data-bind="ui.evForm.title" value="${esc(f.title)}" placeholder="예: KSEF 초안 제출, 동아리 발표"></label></div>
      ${add ? `<div class="fl">${h.seg('ui.evForm.kind', f.kind, [['imp', '중요 할 일'], ['deadline', '마감'], ['etc', '일정']])}</div>` : ''}
      <div class="fl"><label>날짜<input type="date" id="ev-date" data-bind="ui.evForm.date" value="${esc(f.date)}"></label>
        ${range ? `<label>끝나는 날 <small>(며칠이면)</small><input type="date" id="ev-end" data-bind="ui.evForm.end" value="${esc(f.end || '')}"></label>` : ''}</div>
      <div class="fl"><button type="button" class="btn primary" id="ev-save" data-action="evsave">${add ? '추가' : '저장'}</button><button type="button" class="btn ghost" data-action="evcancel">취소</button>${add ? '' : '<button type="button" class="btn ghost danger" data-action="evdel">삭제</button>'}</div></div>`;
  };

  // ---------- 홈 ----------
  const urgency = n => (n < 0 ? 'late' : n <= 3 ? 'hot' : n <= 7 ? 'soon' : '');

  function row(it, today) {
    const n = P.diffDays(today, it.date), inline = it.kind === 'imp' || it.id.startsWith('ms:'), isAl = it.id.startsWith('al:');   // 시험·과제는 시험·과제 탭에서 고친다
    const label = it.ongoing ? '진행 중' : h.dday(it.date, today);
    const sub = `${h.md(it.date)}${it.end ? ' ~ ' + h.md(it.end) : ''} · ${KIND[it.kind]}${it.unconfirmed ? ' · 날짜 미확정' : ''}${it.overdue ? ' · 지났어요' : ''}${it.ongoing ? ` · ${h.dday(it.end, today)} 종료` : ''}`;
    return `<div class="up ${it.kind} ${it.ongoing ? 'ing' : urgency(n)}" role="button" tabindex="0" data-action="upgo" data-id="${esc(it.id)}" style="${it.color ? `--c:${it.color}` : ''}">
      <span class="ud">${esc(label)}</span>
      <span class="ut"><b>${esc(it.title)}</b><small>${esc(sub)}</small>${/^(imp|task):/.test(it.id) ? h.schedText(A.S, it.id, it.date) : ''}</span>
      <span class="uact">
        <button type="button" class="btn sm ghost uedit" data-action="${inline ? 'evedit' : 'upgo'}" data-id="${esc(it.id)}" title="${inline ? '고치기' : isAl ? '할당 탭에서 고치기' : '시험·과제 탭에서 고치기'}">✎</button>
        ${isAl ? '' : `<button type="button" class="btn sm ghost uedit udel" data-action="updel" data-id="${esc(it.id)}" title="지우기">✕</button>`}
        ${it.kind === 'imp' ? `<button type="button" class="ick" data-action="impdone" data-id="${esc(it.impId)}" title="끝냈어요"></button>` : ''}
      </span>
    </div>`;
  }

  function todayPanel(S, PLAN) {
    const today = PLAN.today, D = PLAN.days[0], dt = P.parse(today);
    const planned = D.entries.filter(e => !(e.custom && e.custom.kind === 'event')).reduce((a, e) => a + e.min, 0);
    const next = D.entries.filter(e => e.pieces && e.pieces.length).slice().sort((a, b) => a.pieces[0][0] - b.pieces[0][0]);
    const ov = S.dayOverrides[today], ms = S.milestones.filter(m => m.date <= today && today <= (m.end || m.date));
    return `<div class="panel home-today">
      <div class="ph"><h2>오늘 · ${dt.getMonth() + 1}월 ${dt.getDate()}일 ${P.DOW[dt.getDay()]}요일</h2></div>
      ${ms.length || (ov && ov.off) ? `<div class="evl">${ms.map(m => `<span class="ev etc">${esc(m.title)}</span>`).join('')}${ov && ov.off ? `<span class="ev etc">쉬는 날${ov.note ? ' · ' + esc(ov.note) : ''}</span>` : ''}</div>` : ''}
      <div class="stats"><div><span>남은 계획</span><b>${h.fmtMin(planned)}</b></div><div><span>남은 가용</span><b>${h.fmtMin(D.raw)}</b></div><div><span>할 일</span><b>${D.entries.filter(e => !(e.custom && e.custom.kind === 'event')).length}개</b></div></div>
      ${next.length ? `<div class="mini-list">${next.slice(0, 5).map(e => `<div class="mi nx" style="--c:${h.colorOf(S, e)}"><i class="dot" style="background:${h.colorOf(S, e)}"></i><span class="mt">${esc(h.titleOf(S, e))}</span><span class="mm">${P.t12(e.pieces[0][0])} · ${h.fmtMin(e.min)}</span></div>`).join('')}${next.length > 5 ? `<div class="hint">외 ${next.length - 5}개</div>` : ''}</div>` : `<div class="hint">${D.raw === 0 ? '오늘은 남은 가용 시간이 없어요.' : '오늘 계획된 할 일이 없어요.'}</div>`}
      <div class="fl"><button class="btn primary" data-action="tab" data-tab="today">오늘 할 일 열기</button><button class="btn" data-action="tab" data-tab="plan">계획 보기</button></div>
    </div>`;
  }

  A.views.home = function (S, PLAN) {
    const today = PLAN.today, all = P.upcoming(S, today);
    const f = FILTERS.some(x => x[0] === A.ui.homeFilter) ? A.ui.homeFilter : 'all';
    const cnt = k => (k === 'all' ? all.length : all.filter(x => x.kind === k).length);
    const shown = f === 'all' ? all : all.filter(x => x.kind === f);
    const al = h.alerts(S, PLAN);
    const late = all.filter(x => x.overdue).length;
    return `<div class="split home-split"><section class="home-main">
      <header class="dayhead"><h1>다가오는 일정</h1><button class="btn primary" data-action="evnew">＋ 일정 추가</button></header>
      ${h.evForm()}
      ${al.urgent}
      ${late ? `<div class="note bad">끝내지 못한 중요 할 일이 ${late}개 있어요.</div>` : ''}
      <div class="home-filter">${h.seg('ui.homeFilter', f, FILTERS.map(([k, n]) => [k, `${n} ${cnt(k)}`]))}</div>
      <div class="uplist">${shown.length ? shown.map(it => row(it, today)).join('') : `<div class="empty">${all.length ? '이 종류의 일정은 없어요.' : '다가오는 일정이 없어요.'}<br><small>위의 ＋ 일정 추가로 적을 수 있어요.</small></div>`}</div>
      <div class="hint">줄을 누르면 해당 날짜·시험·과제로 이동하고, ✎로 그 자리에서 고쳐요 (시험·과제는 시험·과제 탭에서). 날짜별로 적으려면 <button class="link" data-action="tab" data-tab="plan">계획</button> 탭에서 날짜를 눌러요.</div>
    </section><aside class="pane-r">${todayPanel(S, PLAN)}${h.allocHome ? h.allocHome(S, PLAN.today) : ''}</aside></div>`;
  };

  // ---------- 액션 ----------
  const Ac = A.actions;
  const newId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const find = id => A.S.important.find(x => x.id === id);

  Ac.impadd = el => {
    const inp = document.getElementById('imp-title'), title = inp ? inp.value.trim() : '';
    if (!title) { A.toast('할 일을 적어 주세요', true); if (inp) inp.focus(); return; }
    A.S.important.push({ id: newId(), date: el.dataset.date, title, done: false });
    A.save(); A.render();
    const n = document.getElementById('imp-title'); if (n) n.focus();
  };
  Ac.impdone = el => {
    const it = find(el.dataset.id);
    if (!it) return;
    it.done = !it.done;
    A.save(); A.render();
    if (it.done) A.toast(`끝냈어요 · ${it.title}`, false, { fn: () => { it.done = false; A.save(); A.render(); } });
  };
  Ac.impdel = el => {
    const S = A.S, i = S.important.findIndex(x => x.id === el.dataset.id);
    if (i < 0) return;
    const it = S.important.splice(i, 1)[0];
    A.save(); A.render();
    A.toast(`지웠어요 · ${it.title}`, false, { fn: () => { S.important.splice(Math.min(i, S.important.length), 0, it); A.save(); A.render(); } });
  };
  // ---- 일정 추가·수정 ----
  const focusTitle = () => { const t = document.getElementById('ev-title'); if (t) { t.focus(); t.select(); } };
  Ac.evnew = () => {
    A.ui.evForm = { mode: 'add', kind: 'imp', id: null, title: '', date: P.today(), end: '' };
    A.render(); focusTitle();
  };
  // data-id: 'imp:<id>' | 'ms:<id>'
  Ac.evedit = el => {
    const S = A.S, key = el.dataset.id, isImp = key.startsWith('imp:'), id = key.slice(key.indexOf(':') + 1);
    const it = isImp ? find(id) : S.milestones.find(m => m.id === id);
    if (!it) return;
    A.ui.evForm = { mode: 'edit', kind: isImp ? 'imp' : (it.kind || 'etc'), id, title: it.title, date: it.date, end: it.end || '' };
    A.render(); focusTitle();
    const f = document.querySelector('.evform'); if (f) f.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  Ac.evcancel = () => { A.ui.evForm = null; A.render(); };
  Ac.evsave = () => {
    const S = A.S, f = A.ui.evForm;
    if (!f) return;
    const title = h.val('ev-title').trim(), date = h.val('ev-date'), end = h.val('ev-end');
    if (!title) { A.toast('제목을 적어 주세요', true); focusTitle(); return; }
    if (!date) { A.toast('날짜를 골라 주세요', true); return; }
    if (end && end < date) { A.toast('끝나는 날이 시작 날짜보다 빠를 수 없어요', true); return; }
    const imp = f.kind === 'imp';
    if (f.mode === 'add') {
      if (imp) S.important.push({ id: newId(), date, title, done: false });
      else { const m = { id: 'm' + newId(), date, title, kind: f.kind }; if (end && f.kind === 'etc') m.end = end; S.milestones.push(m); }
    } else {
      const it = imp ? find(f.id) : S.milestones.find(m => m.id === f.id);
      if (!it) { A.ui.evForm = null; A.render(); return; }
      it.title = title; it.date = date;
      if (!imp) { if (end) it.end = end; else delete it.end; }
    }
    A.ui.evForm = null;
    A.save(); A.render();
    A.toast(f.mode === 'add' ? `추가했어요 · ${title}` : `고쳤어요 · ${title}`);
  };
  Ac.evdel = () => {
    const S = A.S, f = A.ui.evForm;
    if (!f || f.mode !== 'edit') return;
    const imp = f.kind === 'imp', list = imp ? S.important : S.milestones, i = list.findIndex(x => x.id === f.id);
    if (i < 0) return;
    const it = list.splice(i, 1)[0];
    A.ui.evForm = null;
    A.save(); A.render();
    A.toast(`지웠어요 · ${it.title}`, false, { fn: () => { list.splice(Math.min(i, list.length), 0, it); A.save(); A.render(); } });
  };
  // 홈 줄의 ✕: 중요 할 일·달력 일정은 바로, 시험·과제는 확인 후 지운다 (모두 되돌리기 가능). data-id: 'imp:' | 'ms:' | 'exam:' | 'task:'
  Ac.updel = el => {
    const S = A.S, key = el.dataset.id, kind = key.slice(0, key.indexOf(':')), id = key.slice(kind.length + 1);
    const list = { imp: S.important, ms: S.milestones, exam: S.exams, task: S.tasks }[kind];
    const i = list ? list.findIndex(x => x.id === id) : -1;
    if (i < 0) return;
    const it = list[i], name = kind === 'exam' ? `${(P.subj(S, it.sid) || {}).name || ''} 시험` : it.title;
    if ((kind === 'exam' || kind === 'task') && !window.confirm(`‘${name}’을(를) 지울까요? 시험·과제 계획에서도 빠져요.`)) return;
    list.splice(i, 1);
    if (A.ui.evForm && A.ui.evForm.id === id) A.ui.evForm = null;
    A.save(); A.render();
    A.toast(`지웠어요 · ${name}`, false, { fn: () => { list.splice(Math.min(i, list.length), 0, it); A.save(); A.render(); } });
  };
  // 홈의 줄을 누르면 그 일정이 있는 곳으로
  Ac.upgo = el => {
    const it = P.upcoming(A.S, P.today()).find(x => x.id === el.dataset.id);
    if (!it) return;
    if (it.kind === 'imp') { A.ui.calSel = it.date; A.ui.calMonth = it.date.slice(0, 7); A.setTab('plan'); }
    else if (it.id.startsWith('al:')) { A.ui.allocSel = it.id.slice(3); A.setTab('alloc'); }
    else { A.ui.workSel = it.id; A.setTab('work'); }
    window.scrollTo(0, 0);
  };
  document.addEventListener('keydown', ev => {
    const el = ev.target;
    if ((ev.key === 'Enter' || ev.key === ' ') && el.classList && el.classList.contains('up')) { ev.preventDefault(); el.click(); }
  });
})();
