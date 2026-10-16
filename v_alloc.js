/* v_alloc.js — 할당 탭: 번호 묶음(WS 1~10)·이름 목록(R&W 세트들)을 만들어 두고 날짜에 하나씩 배정한다.
   배정 = 그 항목에 묶인 일정(S.custom, c.alloc = { a, i })을 만드는 것. 시각을 안 정하면 그날 빈 시간에 자동 배치되고, 못 끝낸 건 오늘로 이월된다.
   (엔진: planner.js 의 P.allocUnits / allocStats / allocSpread / autoAllocMin) */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc, Ac = A.actions;
  const newId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  const row = (label, desc, ctl) => `<div class="swrow"><span class="swt"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span>${ctl}</div>`;

  // ---------- 배정 / 해제 (다른 화면에서도 쓴다) ----------
  A.assignUnit = function (aid, iid, date, quiet) {
    const S = A.S, a = S.allocs.find(x => x.id === aid), it = a && a.items.find(x => x.id === iid);
    if (!it) return false;
    if (date < P.today()) { A.toast('지난 날짜에는 배정할 수 없어요', true); return false; }
    if (it.done) { A.toast('이미 끝낸 항목이에요', true); return false; }
    const c = S.custom.find(x => x.alloc && x.alloc.a === aid && x.alloc.i === iid && !x.done);
    if (c) { if (c.date === date) return true; c.date = date; c.start = null; }          // 다른 날로 옮기면 시각은 비워 자동 배치
    else {
      A.freezeDay(date);                                                                     // 그날의 다른 블록은 제자리에 둔다
      S.custom.push({ id: P.uid(), date, title: it.label, kind: 'todo', start: null, dur: it.min || a.min, done: false, alloc: { a: aid, i: iid } });
    }
    if (!quiet) { A.save(); A.render(); }
    return true;
  };
  // 배정된 일정 줄을 ‘배정 대기’ 칸으로 끌어오면 배정을 푼다
  A.unassignDrag = function (v) {
    const S = A.S, id = v.slice(v.indexOf('|') + 1).slice(11);                              // 'cu|<일정id>'
    const i = S.custom.findIndex(c => 'cu|' + c.id === id);
    if (i < 0 || !S.custom[i].alloc || S.custom[i].done) { A.toast('배정된 할당 항목만 대기로 돌릴 수 있어요', true); return; }
    const c = S.custom.splice(i, 1)[0];
    A.save(); A.render();
    A.toast(`배정을 풀었어요 · ${c.title}`, false, { fn: () => { S.custom.push(c); A.save(); A.render(); } });
  };

  // ---------- 계획 탭: 배정 대기 칸 ----------
  h.allocTray = S => {
    const groups = S.allocs.map(a => ({ a, w: P.allocUnits(S, a).filter(u => u.state === 'waiting') })).filter(g => g.w.length);
    if (!groups.length) return '';
    const n = groups.reduce((a, g) => a + g.w.length, 0);
    return `<div class="alloc-tray" title="칩을 날짜 칸으로 끌어 놓으면 그날 계획에 들어가요. 배정된 항목은 달력에서 끌어 옮기고, 이 칸으로 끌어오면 배정이 풀려요"><div class="at-h"><b>배정 대기 ${n}개</b><span class="muted small">칩을 날짜 칸으로 끌어 놓으세요</span>
      <button class="btn sm ghost right" data-action="tab" data-tab="alloc">할당 관리 ›</button></div>
      <div class="at-body">${groups.map(g => `<div class="at-g"><span class="at-n" style="--c:${g.a.color}">${esc(g.a.title)}</span>${g.w.map(u => `<span class="at-chip" draggable="true" data-drag="alloc|0000-00-00|${esc(g.a.id)}:${esc(u.item.id)}" style="--c:${g.a.color}">${esc(u.item.label)}</span>`).join('')}</div>`).join('')}</div></div>`;
  };

  // ---------- 홈: 할당 현황 ----------
  h.allocHome = (S, today) => {
    const L = S.allocs.map(a => ({ a, st: P.allocStats(S, a, today) })).filter(x => x.st.total && x.st.done < x.st.total);
    if (!L.length) return '';
    return `<div class="panel home-alloc"><div class="ph"><h2>할당 현황</h2><button class="btn sm ghost" data-action="tab" data-tab="alloc">관리 ›</button></div>
      ${L.slice(0, 5).map(({ a, st }) => {
    const pct = Math.round(st.done / st.total * 100), n = st.next;
    const nx = n ? `다음 ${esc(n.item.label)} · ${n.date ? `${h.md(n.date)}${n.date < today ? ' (밀림)' : ''}` : '배정 안 됨'}` : '';
    return `<div class="hal" role="button" tabindex="0" data-action="alopen" data-id="${esc(a.id)}"><div class="hal-h"><i class="dot" style="background:${a.color}"></i><b>${esc(a.title)}</b><span class="muted small">${st.done}/${st.total}${st.waiting ? ` · 대기 ${st.waiting}` : ''}</span></div>
          <div class="mprog hal-p"><i style="width:${pct}%;background:${a.color}"></i></div><div class="muted small">${nx}${st.late ? ' · <b class="bad">마감보다 늦게 배정됐어요</b>' : ''}</div></div>`;
  }).join('')}</div>`;
  };

  // ---------- 할당 탭 ----------
  const selKey = S => {
    const id = A.ui.allocSel;
    if (id === 'new') return 'new';
    if (S.allocs.some(a => a.id === id)) return id;
    return S.allocs[0] ? S.allocs[0].id : 'new';
  };

  function nav(S, k) {
    const today = P.today();
    return `<div class="navgroup">할당</div>${S.allocs.map(a => {
      const st = P.allocStats(S, a, today), pct = st.total ? Math.round(st.done / st.total * 100) : 0;
      return `<button class="navi li ${k === a.id ? 'on' : ''}" data-action="alsel" data-id="${esc(a.id)}"><i class="dot" style="background:${a.color}"></i><span class="lt">${esc(a.title)}</span><small>${st.done}/${st.total}${st.waiting ? ` · 대기 ${st.waiting}` : ''}</small><span class="mprog"><i style="width:${pct}%;background:${a.color}"></i></span></button>`;
    }).join('')}
      <button class="navi add ${k === 'new' ? 'on' : ''}" data-action="alsel" data-id="new">＋ 할당 만들기</button>`;
  }

  function unitRow(a, u, today) {
    const it = u.item, ids = `data-id="${esc(a.id)}" data-i="${esc(it.id)}"`;
    const fin = `<button class="btn sm ghost" data-action="alfin" ${ids} title="이미 했어요 (완료로 표시)">✓</button>`;
    const del = `<button class="btn sm ghost" data-action="aldelitem" ${ids} title="이 항목 지우기">✕</button>`;
    let status, ctl;
    if (u.state === 'done') {
      status = `<span class="als ok">✓ 완료${it.doneDate ? ' · ' + h.md(it.doneDate) : ''}</span>`;
      ctl = `<button class="btn sm ghost" data-action="alundo" ${ids}>되돌리기</button>`;
    } else if (u.state === 'assigned') {
      const late = u.date < today;
      status = `<span class="als ${late ? 'bad' : ''}">${h.md(u.date)} 배정${late ? ` · ${P.diffDays(u.date, today)}일 밀림` : ''}</span>`;
      ctl = `<input type="date" class="alp" data-alassign="${esc(a.id)}:${esc(it.id)}" value="${u.date < today ? today : u.date}" min="${today}" title="날짜를 바꾸면 옮겨져요"><button class="btn sm ghost" data-action="alunassign" ${ids}>풀기</button>${fin}${del}`;
    } else {
      status = '<span class="als muted">대기</span>';
      ctl = `<input type="date" class="alp" data-alassign="${esc(a.id)}:${esc(it.id)}" value="" min="${today}" title="날짜를 고르면 배정돼요">${fin}${del}`;
    }
    return `<div class="alu ${u.state}"><span class="aln">${esc(it.label)}</span>${status}<span class="alc">${ctl}</span></div>`;
  }

  function detail(S, a) {
    const today = P.today(), st = P.allocStats(S, a, today), i = S.allocs.indexOf(a), b = `allocs.${i}`;
    const U = P.allocUnits(S, a), pct = st.total ? Math.round(st.done / st.total * 100) : 0, per = A.ui.allocPer || 0;
    const eta = st.last ? `배정된 마지막 날 ${h.md(st.last)}${a.due ? (st.late ? ` · <b class="bad">마감(${h.md(a.due)})보다 늦어요</b>` : ` · 마감(${h.md(a.due)}) 안에 끝나요`) : ''}` : '';
    const spread = st.waiting ? `<section class="grp"><h3>자동 나눠주기 <small>대기 중인 ${st.waiting}개를 ${a.due ? `마감(${h.md(a.due)})까지` : '앞으로 2주 안에'} 공부 시간이 있는 날에 나눠요</small></h3>
        <div class="fl">${h.seg('ui.allocPer', per, [[0, '자동'], [1, '하루 1개'], [2, '하루 2개'], [3, '하루 3개']], 'int')}<button class="btn primary" data-action="allocspread" data-id="${esc(a.id)}">대기 ${st.waiting}개 배정하기</button></div>
        <div class="hint">배정한 뒤에 달력에서 끌어 옮기거나, 아래 목록에서 날짜를 바꿔 고칠 수 있어요.</div></section>` : '';
    return `<div class="panel detail">
      <div class="dh"><i class="dot big" style="background:${a.color}"></i><h2>${esc(a.title)}</h2><button class="btn sm ghost danger" data-action="aldel" data-id="${esc(a.id)}">삭제</button></div>
      <div class="prog"><i style="width:${pct}%;background:${a.color}"></i></div>
      <div class="hint">완료 ${st.done} · 배정 ${st.assigned}${st.overdue ? ` (밀린 ${st.overdue})` : ''} · 대기 ${st.waiting} / 전체 ${st.total}${st.min ? ` · 남은 ${h.fmtMin(st.min)}` : ''}</div>
      ${eta ? `<div class="hint">${eta}</div>` : ''}
      ${spread}
      <section class="grp"><h3>항목 <small>${st.total}개 · 날짜를 고르면 배정, 달력에서 끌어도 돼요</small></h3>
        <div class="allist">${U.map(u => unitRow(a, u, today)).join('')}</div>
        <div class="fl"><input type="text" id="al-more" data-enter="al-more-btn" maxlength="40" placeholder="항목 추가 (비우면 다음 번호)"><button class="btn" id="al-more-btn" data-action="aladd" data-id="${esc(a.id)}">추가</button></div></section>
      <section class="grp"><h3>설정</h3>
        <div class="fl"><label>이름<input type="text" data-bind="${b}.title" data-render="1" value="${esc(a.title)}" style="min-width:14rem"></label>
          <label>마감 <small class="muted">(선택)</small><input type="date" data-bind="${b}.due" data-render="1" value="${esc(a.due || '')}"></label></div>
        ${row('한 개당 시간', '새로 배정할 때 잡히는 길이 (이미 배정된 것도 같이 바뀌어요)', `<span class="stp"><button type="button" data-action="almin" data-id="${esc(a.id)}" data-d="-5">−</button><input type="number" value="${a.min}" readonly><em>분</em><button type="button" data-action="almin" data-id="${esc(a.id)}" data-d="5">＋</button></span>`)}
        <div class="fl"><span class="muted small">색</span>${h.swatches(`${b}.color`, a.color)}</div></section></div>`;
  }

  function newForm(S) {
    const f = A.ui.allocForm || (A.ui.allocForm = { mode: 'num', from: 1, to: 10, min: 40, due: '', title: '', prefix: '', list: '', color: P.COLORS[S.allocs.length % P.COLORS.length] });
    return `<div class="panel detail"><div class="dh"><h2>할당 만들기</h2></div>
      <div class="hint">번호가 있는 묶음(예: WS 1~10)이나 이름이 제각각인 세트 목록(예: R&amp;W 세트들)을 만들어 두고, 달력에서 날짜에 하나씩 배정해요.</div>
      <section class="grp"><div class="fl"><label class="wide">이름<input type="text" id="al-title" data-bind="ui.allocForm.title" maxlength="40" value="${esc(f.title)}" placeholder="예: 단어 WS, R&amp;W 문제집"></label></div>
        <div class="fl">${h.seg('ui.allocForm.mode', f.mode, [['num', '번호 묶음'], ['list', '이름 목록']])}</div>
        ${f.mode === 'num'
    ? `<div class="fl"><label>이름표 앞글자 <small>(비우면 이름을 써요)</small><input type="text" id="al-prefix" data-bind="ui.allocForm.prefix" maxlength="20" value="${esc(f.prefix)}" placeholder="예: WS"></label></div>
        ${row('번호 범위', '예: 1 ~ 10', `<span class="rng">${h.step('ui.allocForm.from', f.from, { step: 1, min: 1, max: 500, unit: '번' })}<span class="muted">~</span>${h.step('ui.allocForm.to', f.to, { step: 1, min: 1, max: 500, unit: '번' })}</span>`)}`
    : `<div class="fl"><label class="wide">목록 <small>(한 줄에 하나씩)</small><textarea id="al-list" data-bind="ui.allocForm.list" rows="7" placeholder="Module 1 Easy&#10;Module 1 Hard&#10;Module 2 Easy">${esc(f.list)}</textarea></label></div>`}</section>
      <section class="grp">${row('한 개당 시간', '배정하면 기본으로 잡히는 길이', h.step('ui.allocForm.min', f.min, { step: 5, min: 5, max: 240, unit: '분' }))}
        <div class="fl"><label>마감 <small>(선택)</small><input type="date" data-bind="ui.allocForm.due" value="${esc(f.due)}"></label></div>
        <div class="fl"><span class="muted small">색</span>${h.swatches('ui.allocForm.color', f.color)}</div></section>
      <button class="btn primary" data-action="alcreate">만들기</button></div>`;
  }

  A.views.alloc = function (S) {
    const k = selKey(S);
    const body = k === 'new' ? newForm(S) : detail(S, S.allocs.find(a => a.id === k));
    return `<div class="md"><nav class="navlist">${nav(S, k)}</nav><section class="mdmain">${body}</section></div>`;
  };

  // ---------- 액션 ----------
  Ac.alsel = el => { A.ui.allocSel = el.dataset.id; if (el.dataset.id === 'new') A.ui.allocForm = null; A.render(); window.scrollTo(0, 0); };
  Ac.alopen = el => { A.ui.allocSel = el.dataset.id; A.setTab('alloc'); };

  Ac.alcreate = () => {
    const S = A.S, f = A.ui.allocForm;
    if (!f) return;
    const title = h.val('al-title').trim();
    if (!title) { A.toast('이름을 적어 주세요', true); return; }
    let labels = [];
    if (f.mode === 'list') labels = h.val('al-list').split('\n').map(x => x.trim()).filter(Boolean);
    else {
      const from = +f.from, to = +f.to, pre = h.val('al-prefix'), base = pre.trim() ? pre : title + ' ';
      if (!(to >= from)) { A.toast('번호 범위를 확인해 주세요 (끝 번호가 시작보다 작아요)', true); return; }
      for (let n = from; n <= to; n++) labels.push(`${base}${/\s$/.test(base) ? '' : ' '}${n}`.trim());
    }
    if (!labels.length) { A.toast('항목이 하나도 없어요', true); return; }
    if (labels.length > 200) { A.toast('한 번에 200개까지만 만들 수 있어요', true); return; }
    const min = Math.max(5, +f.min || 40);
    const a = { id: newId(), title, color: f.color, min, due: f.due || '', items: labels.map((label, i) => ({ id: String(i + 1), label, min, done: false })) };
    S.allocs.push(a);
    A.ui.allocSel = a.id; A.ui.allocForm = null;
    A.save(); A.render();
    A.toast(`${title} ${labels.length}개를 만들었어요. 달력에서 날짜로 끌어 배정하세요`);
  };

  Ac.aldel = el => {
    const S = A.S, i = S.allocs.findIndex(a => a.id === el.dataset.id), a = S.allocs[i];
    if (!a || !window.confirm(`‘${a.title}’ 할당을 지울까요? 배정된 일정도 같이 지워져요 (이미 끝낸 기록은 남아요).`)) return;
    S.custom = S.custom.filter(c => !(c.alloc && c.alloc.a === a.id && !c.done));
    S.allocs.splice(i, 1);
    A.ui.allocSel = null;
    A.save(); A.render();
  };

  Ac.almin = el => {
    const a = A.S.allocs.find(x => x.id === el.dataset.id);
    if (!a) return;
    const old = a.min, nw = Math.max(5, Math.min(240, old + +el.dataset.d));
    if (nw === old) return;
    a.min = nw;
    for (const it of a.items) if (!it.done && it.min === old) it.min = nw;                       // 직접 길이를 바꾼 건 그대로 둔다
    for (const c of A.S.custom) if (c.alloc && c.alloc.a === a.id && !c.done && c.dur === old) c.dur = nw;
    A.save(); A.render();
  };

  Ac.aladd = el => {
    const a = A.S.allocs.find(x => x.id === el.dataset.id);
    if (!a) return;
    let label = h.val('al-more').trim();
    if (!label) {                                                                                 // 마지막 항목 이름의 끝 번호를 하나 올린다
      const last = a.items.length ? a.items[a.items.length - 1].label : '', m = /^(.*?)(\d+)\s*$/.exec(last);
      label = m ? `${m[1]}${+m[2] + 1}` : `${a.title} ${a.items.length + 1}`;
    }
    const id = String(a.items.reduce((mx, x) => Math.max(mx, +x.id || 0), 0) + 1);
    a.items.push({ id, label, min: a.min, done: false });
    A.save(); A.render();
    const n = document.getElementById('al-more'); if (n) n.focus();
  };

  Ac.aldelitem = el => {
    const S = A.S, a = S.allocs.find(x => x.id === el.dataset.id), i = a ? a.items.findIndex(x => x.id === el.dataset.i) : -1;
    if (i < 0) return;
    const it = a.items.splice(i, 1)[0], removed = S.custom.filter(c => c.alloc && c.alloc.a === a.id && c.alloc.i === it.id && !c.done);
    S.custom = S.custom.filter(c => !removed.includes(c));
    A.save(); A.render();
    A.toast(`지웠어요 · ${it.label}`, false, { fn: () => { a.items.splice(Math.min(i, a.items.length), 0, it); S.custom.push(...removed); A.save(); A.render(); } });
  };

  Ac.alunassign = el => {
    const S = A.S, i = S.custom.findIndex(c => c.alloc && c.alloc.a === el.dataset.id && c.alloc.i === el.dataset.i && !c.done);
    if (i < 0) return;
    const c = S.custom.splice(i, 1)[0];
    A.save(); A.render();
    A.toast(`배정을 풀었어요 · ${c.title}`, false, { fn: () => { S.custom.push(c); A.save(); A.render(); } });
  };

  // 이미 했던 것을 완료로 표시 / 되돌리기
  Ac.alfin = el => {
    const S = A.S, a = S.allocs.find(x => x.id === el.dataset.id), it = a && a.items.find(x => x.id === el.dataset.i);
    if (!it) return;
    const removed = S.custom.filter(c => c.alloc && c.alloc.a === a.id && c.alloc.i === it.id && !c.done);
    S.custom = S.custom.filter(c => !removed.includes(c));
    it.done = true; it.doneDate = P.today();
    A.save(); A.render();
    A.toast(`끝냈어요 · ${it.label}`, false, { fn: () => { it.done = false; delete it.doneDate; S.custom.push(...removed); A.save(); A.render(); } });
  };
  Ac.alundo = el => {
    const a = A.S.allocs.find(x => x.id === el.dataset.id), it = a && a.items.find(x => x.id === el.dataset.i);
    if (!it) return;
    it.done = false; delete it.doneDate;
    A.save(); A.render();
  };

  // 대기 중인 항목을 날짜에 나눠 배정
  Ac.allocspread = el => {
    const S = A.S, a = S.allocs.find(x => x.id === el.dataset.id);
    if (!a) return;
    const wait = P.allocUnits(S, a).filter(u => u.state === 'waiting');
    if (!wait.length) { A.toast('배정할 항목이 없어요', true); return; }
    const r = P.allocSpread(A.PLAN.days, P.today(), a.due, wait.length, A.ui.allocPer || 0);
    if (!r.dates.length) { A.toast('마감까지 공부 시간이 있는 날이 없어요', true); return; }
    for (const d of new Set(r.dates)) A.freezeDay(d);
    r.dates.forEach((d, k) => A.assignUnit(a.id, wait[k].item.id, d, true));
    A.save(); A.render();
    const left = wait.length - r.dates.length;
    A.toast(`${r.dates.length}개를 ${h.md(r.dates[0])}~${h.md(r.dates[r.dates.length - 1])}에 배정했어요${left ? ` · ${left}개는 자리가 없어 대기` : ''}`);
  };

  // 목록에서 날짜를 고르면 배정 / 옮기기
  document.addEventListener('change', ev => {
    const el = ev.target.closest && ev.target.closest('[data-alassign]');
    if (!el || !el.value) return;
    const [aid, iid] = el.dataset.alassign.split(':');
    if (A.assignUnit(aid, iid, el.value)) A.toast(`${h.md(el.value)}에 배정했어요`);
    else A.render();
  });
  document.addEventListener('keydown', ev => {
    const el = ev.target;
    if ((ev.key === 'Enter' || ev.key === ' ') && el.classList && el.classList.contains('hal')) { ev.preventDefault(); el.click(); }
  });
})();
