/* v_plan.js — 시험·과제 탭: 왼쪽 목록(시험 · 대회/과제 · 달력 일정)에서 하나를 고르면 오른쪽에서 정한다 */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc;
  const row = (label, desc, ctl) => `<div class="swrow"><span class="swt"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span>${ctl}</div>`;
  const subjOptions = (S, sel, withNone) =>
    (withNone ? `<option value="">없음</option>` : '') + S.subjects.map(s => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

  // ---------- 왼쪽 목록 ----------
  function list(S, PLAN, k) {
    const today = PLAN.today;
    const exams = S.exams.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date || '9').localeCompare(b.e.date || '9'));
    const tasks = S.tasks.map((t, i) => ({ t, i })).sort((a, b) => (+a.t.done - +b.t.done) || (a.t.due || '9').localeCompare(b.t.due || '9'));
    const ms = S.milestones.map((m, i) => ({ m, i })).sort((a, b) => a.m.date.localeCompare(b.m.date));
    const li = (key, dot, title, sub, pct, extra) => `<button class="navi li ${k === key ? 'on' : ''}" data-action="worksel" data-k="${esc(key)}">
      <i class="dot" style="background:${dot}"></i><span class="lt">${esc(title)}</span><small>${sub}</small>${extra || ''}${pct != null ? `<span class="mprog"><i style="width:${pct}%"></i></span>` : ''}</button>`;
    return `<div class="navgroup">시험</div>
      ${exams.map(({ e }) => {
    const sb = P.subj(S, e.sid); if (!sb) return '';
    const tot = P.examTotal(S, e), rem = P.examRemaining(S, e), pct = tot ? Math.round((tot - rem) / tot * 100) : 0;
    return li('exam:' + e.id, sb.color, sb.name, `${e.date ? h.md(e.date) + ' ' + h.dday(e.date, today) : '날짜 없음'}${e.confirmed ? '' : ' · 미확정'}`, pct);
  }).join('')}
      <button class="navi add ${k === 'newexam' ? 'on' : ''}" data-action="worksel" data-k="newexam">＋ 시험 추가</button>
      <div class="navgroup">대회 · 과제</div>
      ${tasks.map(({ t }) => li('task:' + t.id, '#d97706', t.title, `${t.due ? h.md(t.due) + ' ' + h.dday(t.due, today) : '마감 없음'}${t.done ? ' · 완료' : ''}`, t.totalMin ? Math.min(100, Math.round((t.spent || 0) / t.totalMin * 100)) : 0)).join('')}
      <button class="navi add ${k === 'newtask' ? 'on' : ''}" data-action="worksel" data-k="newtask">＋ 대회·과제 추가</button>
      <div class="navgroup">달력 일정</div>
      ${ms.map(({ m }) => li('ms:' + m.id, m.kind === 'deadline' ? '#d97706' : m.kind === 'exam' ? '#dc2626' : '#94a3b8', m.title, `${h.md(m.date)}${m.end ? ' ~ ' + h.md(m.end) : ''}`, null)).join('')}
      <button class="navi add ${k === 'newms' ? 'on' : ''}" data-action="worksel" data-k="newms">＋ 일정 추가</button>`;
  }

  // ---------- 시험 ----------
  function exam(S, id, today) {
    const i = S.exams.findIndex(e => e.id === id);
    if (i < 0) return empty();
    const e = S.exams[i], sb = P.subj(S, e.sid), b = `exams.${i}`;
    const rem = P.examRemaining(S, e), tot = P.examTotal(S, e), pct = tot ? Math.round((tot - rem) / tot * 100) : 0;
    const hasScope = e.scope.length;
    return `<div class="panel detail">
      <div class="dh"><i class="dot big" style="background:${sb ? sb.color : '#999'}"></i><h2>${esc(sb ? sb.name : '시험')} 시험</h2><button class="btn sm ghost danger" data-action="delExam" data-i="${i}">삭제</button></div>
      ${tot === 0 && !hasScope ? '<div class="note info">이 시험은 <b>루틴</b>으로 준비해요. 하루에 무엇을 얼마나 할지는 <button class="link" data-action="tab" data-tab="routine">루틴 탭의 주간 시간표</button>에서 정하세요.</div>' : `<div class="prog"><i style="width:${pct}%"></i></div><div class="hint">남은 공부 ${h.fmtMin(rem)} / 전체 ${h.fmtMin(tot)} (${pct}%)</div>`}
      <section class="grp"><h3>시험 날짜</h3>
        <div class="fl"><input type="date" data-bind="${b}.date" data-render="1" value="${esc(e.date)}">${e.date ? `<span class="pill">${h.dday(e.date, today)}</span>` : ''}</div>
        ${h.sw(`${b}.confirmed`, e.confirmed, '날짜 확정', '시험 시간표로 확인한 날짜면 켜세요. 꺼져 있으면 ‘미확정’으로 표시돼요', true)}</section>
      <section class="grp"><h3>시험 범위 <small>${hasScope ? `${e.scope.filter(c => c.done).length}/${e.scope.length} 단원 완료` : '아직 없어요'}</small></h3>
        ${hasScope ? e.scope.map((c, j) => `<div class="ch"><input type="checkbox" data-action="chapter" data-ex="${esc(e.id)}" data-i="${j}" ${c.done ? 'checked' : ''}>
          <input type="text" data-bind="${b}.scope.${j}.title" value="${esc(c.title)}" class="${c.done ? 'done' : ''}">
          ${h.step(`${b}.scope.${j}.min`, c.min != null ? c.min : S.settings.minDefaults.chapter, { step: 10, min: 10, max: 600, unit: '분' })}
          <button class="x" data-action="delChapter" data-ex="${esc(e.id)}" data-i="${j}">×</button></div>`).join('') : '<div class="hint">단원을 입력하면 단원별로 진도를 관리하고, 오늘 탭에서 단원 단위로 체크할 수 있어요.</div>'}
        <textarea id="ch-${esc(e.id)}" rows="3" placeholder="한 줄에 한 단원씩 입력하세요. 시간을 정하려면 ‘3장 평형 | 90’ 처럼 | 뒤에 분을 적어요"></textarea>
        <button class="btn sm" data-action="addChapters" data-ex="${esc(e.id)}">단원 추가</button></section>
      <section class="grp"><h3>필요한 시간</h3>
        ${hasScope ? '<div class="hint">단원별 시간의 합으로 계산해요.</div>' : row('시험 대비 총 시간', '범위를 입력하지 않았을 때 쓰는 값', h.step(`${b}.budgetMin`, e.budgetMin != null ? e.budgetMin : S.settings.minDefaults.exam, { hours: true, step: 30, min: 30, max: 6000, unit: '시간' }))}
        ${row('직전 정리', '시험 직전에 전 범위를 훑는 시간', h.step(`${b}.finalMin`, e.finalMin != null ? e.finalMin : S.settings.minDefaults.final, { step: 10, min: 0, max: 600, unit: '분' }))}</section></div>`;
  }

  // ---------- 새 시험 ----------
  function newExam(S) {
    const used = new Set(S.exams.map(e => e.sid)), free = S.subjects.filter(s => !used.has(s.id));
    return `<div class="panel detail"><div class="dh"><h2>시험 추가</h2></div>
      ${free.length ? `<div class="fl"><label>과목<select id="ex-sid">${free.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label>
        <label>시험 날짜 <small class="muted">(몰라도 돼요)</small><input type="date" id="ex-date"></label></div><button class="btn primary" data-action="addExam">추가</button>`
    : '<div class="hint">모든 과목에 시험이 이미 있어요. 설정에서 과목을 먼저 추가하세요.</div>'}</div>`;
  }

  // ---------- 과제 ----------
  function task(S, id, today) {
    const i = S.tasks.findIndex(t => t.id === id);
    if (i < 0) return empty();
    const t = S.tasks[i], b = `tasks.${i}`, rem = Math.max(0, (t.totalMin || 0) - (t.spent || 0));
    const pct = t.totalMin ? Math.min(100, Math.round((t.spent || 0) / t.totalMin * 100)) : 0;
    return `<div class="panel detail">
      <div class="dh"><i class="dot big" style="background:#d97706"></i><h2>${esc(t.title)}</h2><button class="btn sm ghost danger" data-action="delTask" data-i="${i}">삭제</button></div>
      <div class="prog"><i style="width:${pct}%;background:#d97706"></i></div><div class="hint">${t.done ? '끝난 과제예요' : `남은 ${h.fmtMin(rem)} / 전체 ${h.fmtMin(t.totalMin || 0)} (${pct}%)`}</div>
      ${h.schedText(S, 'task:' + t.id, t.due) ? `<div class="hint">${h.schedText(S, 'task:' + t.id, t.due)} <small class="muted">(계획 탭에서 날짜를 누르고 ‘일정 추가’로 잡아요)</small></div>` : ''}
      <section class="grp"><h3>기본</h3>
        <div class="fl"><label>이름<input type="text" data-bind="${b}.title" data-render="1" value="${esc(t.title)}" style="min-width:16rem"></label>
          <label>마감<input type="date" data-bind="${b}.due" data-render="1" value="${esc(t.due || '')}"></label>${t.due ? `<span class="pill warn">${h.dday(t.due, today)}</span>` : ''}</div>
        ${row('총 필요 시간', '이 일을 끝내는 데 드는 전체 시간', h.step(`${b}.totalMin`, t.totalMin || 0, { hours: true, step: 30, min: 30, max: 6000, unit: '시간' }))}
        ${row('중요도', '시간이 모자랄 때 먼저 챙길 정도', h.seg(`${b}.priority`, t.priority || 2, [[3, '상'], [2, '중'], [1, '하']], 'int'))}
        ${h.sw(`${b}.done`, t.done, '끝났어요', '켜면 계획에서 빠져요', true)}</section>
      <section class="grp"><h3>나눠서 하는 방식</h3>
        ${row('한 번에 최소', '이보다 짧게 쪼개 하지 않아요', h.step(`${b}.minChunk`, t.minChunk || 30, { step: 10, min: 10, max: 180, unit: '분' }))}
        ${row('하루 최대', '', h.step(`${b}.maxPerDay`, t.maxPerDay || 180, { step: 30, min: 30, max: 480, unit: '분' }))}
        <div class="fl"><label>관련 과목 <select data-bind="${b}.sid" data-render="1">${subjOptions(S, t.sid || '', true)}</select></label></div></section>
      ${t.items && t.items.length ? `<section class="grp"><h3>세부 항목 <small>${t.items.filter(x => x.done).length}/${t.items.length}</small></h3><ul class="chk">${t.items.map((it, j) => `<li><label><input type="checkbox" data-action="taskitem" data-t="${esc(t.id)}" data-i="${j}" ${it.done ? 'checked' : ''}><span class="tx ${it.done ? 'done' : ''}">${esc(it.text)}${it.min != null ? ` <small class="muted">${it.min}분</small>` : ''}</span></label></li>`).join('')}</ul></section>` : ''}</div>`;
  }

  function newTask(S) {
    if (!A.ui.taskForm) A.ui.taskForm = {};
    const f = A.ui.taskForm;
    if (f.min == null) f.min = 180;
    if (!f.prio) f.prio = 2;
    if (f.split == null) f.split = true;
    return `<div class="panel detail"><div class="dh"><h2>대회·과제 추가</h2></div>
      <section class="grp"><div class="fl"><label>이름<input type="text" data-bind="ui.taskForm.title" value="${esc(f.title || '')}" placeholder="예: KSEF 제출" style="min-width:16rem"></label>
        <label>마감<input type="date" data-bind="ui.taskForm.due" value="${esc(f.due || '')}"></label></div>
        ${row('총 필요 시간', '이 일을 끝내는 데 드는 전체 시간', h.step('ui.taskForm.min', f.min, { hours: true, step: 30, min: 30, max: 6000, unit: '시간' }))}
        ${row('중요도', '', h.seg('ui.taskForm.prio', f.prio, [[3, '상'], [2, '중'], [1, '하']], 'int'))}
        ${h.sw('ui.taskForm.split', f.split, '나눠서 해도 돼요', '꺼두면 한 번에 몰아서 하도록 잡아요', true)}
        <div class="fl"><label>관련 과목 <select data-bind="ui.taskForm.sid">${subjOptions(S, f.sid || '', true)}</select></label></div></section>
      <button class="btn primary" data-action="addTask">추가</button>
      <div class="hint" style="margin-top:10px">공지문이 길면 <button class="link" data-action="tab" data-tab="notes">노트 탭</button>에서 ‘할일 프롬프트’로 Claude에게 정리시킨 뒤 붙여넣을 수도 있어요.</div></div>`;
  }

  // ---------- 달력 일정 ----------
  function milestone(S, id) {
    const i = S.milestones.findIndex(m => m.id === id);
    if (i < 0) return empty();
    const m = S.milestones[i], b = `milestones.${i}`;
    const hasTask = S.tasks.some(t => t.msId === m.id);
    return `<div class="panel detail"><div class="dh"><h2>${esc(m.title)}</h2><button class="btn sm ghost danger" data-action="delMs" data-i="${i}">삭제</button></div>
      <section class="grp"><div class="fl"><label>이름<input type="text" data-bind="${b}.title" data-render="1" value="${esc(m.title)}" style="min-width:16rem"></label></div>
        <div class="fl"><label>날짜<input type="date" data-bind="${b}.date" data-render="1" value="${esc(m.date)}"></label>
          <label>끝나는 날 <small class="muted">(며칠이면)</small><input type="date" data-bind="${b}.end" value="${esc(m.end || '')}"></label></div>
        ${row('종류', '', h.seg(`${b}.kind`, m.kind || 'etc', [['etc', '일반'], ['deadline', '마감'], ['exam', '시험']]))}</section>
      ${m.kind === 'deadline' && !hasTask ? `<button class="btn primary" data-action="msToTask" data-i="${i}">이 마감을 작업으로 추가해 시간 배정받기</button>` : ''}</div>`;
  }
  function newMs() {
    const f = A.ui.msForm || (A.ui.msForm = { kind: 'etc' });
    return `<div class="panel detail"><div class="dh"><h2>일정 추가</h2></div>
      <section class="grp"><div class="fl"><label>이름<input type="text" data-bind="ui.msForm.title" value="${esc(f.title || '')}" style="min-width:16rem"></label>
        <label>날짜<input type="date" data-bind="ui.msForm.date" value="${esc(f.date || '')}"></label></div>
        ${row('종류', '', h.seg('ui.msForm.kind', f.kind || 'etc', [['etc', '일반'], ['deadline', '마감'], ['exam', '시험']]))}</section>
      <button class="btn primary" data-action="addMs">추가</button></div>`;
  }
  const empty = () => `<div class="panel empty">왼쪽에서 항목을 고르거나 추가하세요.</div>`;

  A.views.work = function (S, PLAN) {
    let k = A.ui.workSel;
    const valid = key => { const [t, id] = key.split(':'); return (t === 'exam' && S.exams.some(e => e.id === id)) || (t === 'task' && S.tasks.some(x => x.id === id)) || (t === 'ms' && S.milestones.some(m => m.id === id))  || ['newexam', 'newtask', 'newms'].includes(key); };
    if (!k || !valid(k)) {
      const first = S.exams.slice().sort((a, b) => (a.date || '9').localeCompare(b.date || '9'))[0];
      k = first ? 'exam:' + first.id : 'newtask';
    }
    const [t, id] = k.split(':');
    const body = t === 'exam' ? exam(S, id, PLAN.today) : t === 'task' ? task(S, id, PLAN.today) : t === 'ms' ? milestone(S, id)
      : t === 'newexam' ? newExam(S) : t === 'newtask' ? newTask(S) : newMs();
    return `<div class="md"><nav class="navlist">${list(S, PLAN, k)}</nav><section class="mdmain">${h.alerts(S, PLAN).urgent}${body}</section></div>`;
  };

  // ---------- 액션 ----------
  const Ac = A.actions;
  Ac.worksel = el => { A.ui.workSel = el.dataset.k; A.render(); window.scrollTo(0, 0); };

  Ac.addExam = () => {
    const sid = h.val('ex-sid'), date = h.val('ex-date');
    if (!sid) return;
    const id = 'e_' + sid;
    A.S.exams.push({ id, sid, date: date || '', confirmed: !!date, scope: [], budgetMin: A.S.settings.minDefaults.exam, finalMin: A.S.settings.minDefaults.final, partial: 0, finalSpent: 0, finalDone: false });
    A.ui.workSel = 'exam:' + id; A.save(); A.render();
  };
  Ac.delExam = el => {
    const e = A.S.exams[+el.dataset.i], sb = e && P.subj(A.S, e.sid);
    if (!e || !window.confirm(`${sb ? sb.name : ''} 시험을 목록에서 지울까요?`)) return;
    A.S.exams.splice(+el.dataset.i, 1); A.ui.workSel = null; A.save(); A.render();
  };
  Ac.addChapters = el => {
    const e = A.S.exams.find(x => x.id === el.dataset.ex), ta = document.getElementById('ch-' + el.dataset.ex);
    if (!e || !ta) return;
    const lines = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { A.toast('단원을 한 줄에 하나씩 입력하세요', true); return; }
    for (const l of lines) {
      const [title, min] = l.split('|').map(s => s.trim());
      e.scope.push({ id: P.uid(), title, min: parseInt(min, 10) || A.S.settings.minDefaults.chapter, done: false });
    }
    A.save(); A.render();
  };
  Ac.delChapter = el => {
    const e = A.S.exams.find(x => x.id === el.dataset.ex);
    if (e) { e.scope.splice(+el.dataset.i, 1); A.save(); A.render(); }
  };

  Ac.addTask = () => {
    const f = A.ui.taskForm || {}, title = (f.title || '').trim();
    if (!title || !(f.min > 0)) { A.toast('이름과 필요한 시간을 정하세요', true); return; }
    const id = P.uid(), total = f.min;
    A.S.tasks.push({
      id, title, due: f.due || '', totalMin: total, spent: 0, priority: f.prio || 2, sid: f.sid || '', msId: f.msId || '',
      minChunk: f.split ? 30 : Math.min(total, 180), maxPerDay: f.split ? 180 : Math.min(total, 240), items: [], done: false
    });
    A.ui.taskForm = null; A.ui.workSel = 'task:' + id;
    A.save(); A.render();
    A.toast('추가했어요. 오늘·계획 탭에 반영돼요.');
  };
  Ac.delTask = el => {
    const t = A.S.tasks[+el.dataset.i];
    if (!t || !window.confirm(`‘${t.title}’을(를) 지울까요?`)) return;
    A.S.tasks.splice(+el.dataset.i, 1); A.ui.workSel = null; A.save(); A.render();
  };

  Ac.addMs = () => {
    const f = A.ui.msForm || {};
    if (!f.date || !(f.title || '').trim()) { A.toast('날짜와 이름을 입력하세요', true); return; }
    const id = P.uid();
    A.S.milestones.push({ id, date: f.date, title: f.title.trim(), kind: f.kind || 'etc' });
    A.ui.msForm = null; A.ui.workSel = 'ms:' + id; A.save(); A.render();
  };
  Ac.delMs = el => { A.S.milestones.splice(+el.dataset.i, 1); A.ui.workSel = null; A.save(); A.render(); };
  Ac.msToTask = el => {
    const m = A.S.milestones[+el.dataset.i];
    A.ui.taskForm = { title: m.title.replace(/\s*마감$/, ''), due: m.date, min: 180, prio: 3, split: true, msId: m.id };
    A.ui.workSel = 'newtask'; A.setTab('work');
  };
})();
