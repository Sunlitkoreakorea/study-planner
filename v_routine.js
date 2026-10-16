/* v_routine.js — 루틴 탭: 시간축이 있는 1주일 시간표에 루틴을 놓고(끌어서 요일·시각·길이), 오른쪽에서 세부사항까지 한 번에 정한다 */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc;
  const PPM = 1.2, SNAP = 5, DAYS = [0, 1, 2, 3, 4, 5, 6];
  const row = (label, desc, ctl) => `<div class="swrow"><span class="swt"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span>${ctl}</div>`;
  const ensure = r => { r.starts = r.starts || {}; r.durs = r.durs || {}; return r; };
  const subjOpts = (S, sel) => S.subjects.map(s => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const colorOf = (S, r) => { const sb = P.subj(S, r.sid); return sb ? sb.color : '#94a3b8'; };

  // 루틴·복습 편집 패널용 1자습·2자습 키 (그 요일 템플릿의 공부 시간대)
  const tmplBlocks = (S, day) => (day === 0 || day === 6 ? S.settings.weekendBlocks : S.settings.weekdayBlocks).map(b => [P.toMin(b[0]), P.toMin(b[1])]).filter(b => b[1] > b[0]);
  function tmplKeys(S, rid, day, action) {
    const bl = tmplBlocks(S, day);
    if (bl.length < 2) return '';
    return `<span class="sess">${bl.map(([a, b], i) => `<button type="button" class="sk" data-action="${action || 'rtsess'}" data-rid="${esc(rid)}" data-day="${day}" data-i="${i}" title="${i + 1}자습 (${P.t12(a)}~${P.t12(b)})으로 이동">${i + 1}자습으로</button>`).join('')}</span>`;
  }
  const reviewDef = (S, sid) => P.effMin(S, sid, 'review').min;
  // 과목별 '수업 후 복습': 시간표(수업 요일)에 맞춰 자동으로 생기고, 시각·길이는 과목에 요일별로 저장한다 (sb.rvStarts / sb.rvDurs)
  function reviewOccs(S) {
    const out = [];
    for (const sb of S.subjects) {
      if (!sb.review) continue;
      sb.rvStarts = sb.rvStarts || {}; sb.rvDurs = sb.rvDurs || {};
      const def = reviewDef(S, sb.id);
      for (let w = 1; w <= 5; w++) {
        if (!(S.timetable[w - 1] || []).includes(sb.id)) continue;
        out.push({
          r: { id: 'rv:' + sb.id, title: `${sb.short || sb.name} 복습`, sid: sb.id, amount: '수업 후 복습', isReview: true, min: def, on: true },
          d: w, start: sb.rvStarts[w] != null ? sb.rvStarts[w] : (sb.rvStart != null ? sb.rvStart : null), min: Math.max(5, sb.rvDurs[w] != null ? sb.rvDurs[w] : def)
        });
      }
    }
    return out;
  }
  // 요일별 한 번의 루틴(occurrence) 목록
  function occs(S) {
    const out = [];
    for (const r of S.routines) {
      if (r.on === false) continue;
      ensure(r);
      for (const d of r.days) out.push(Object.assign({ r, d }, P.occ(r, d)));
    }
    return out.concat(reviewOccs(S));
  }

  // ---------- 1주일 시간표 (시간축) ----------
  function gridHtml(S) {
    const all = occs(S);
    const avail = d => (d === 0 || d === 6 ? S.settings.weekendBlocks : S.settings.weekdayBlocks).map(b => [P.toMin(b[0]), P.toMin(b[1])]);
    let lo = 18 * 60;
    for (const d of DAYS) for (const [a] of avail(d)) lo = Math.min(lo, a);
    for (const o of all) if (o.start != null) lo = Math.min(lo, o.start);
    lo = Math.max(0, Math.floor((lo - 30) / 60) * 60);
    const hi = P.DAY_END, H = (hi - lo) * PPM;
    const total = d => all.filter(o => o.d === d).reduce((a, o) => a + o.min, 0);
    const isSel = o => A.ui.rtSel === o.r.id && A.ui.rtDay === o.d;
    const hours = [];
    for (let m = lo; m <= hi; m += 60) hours.push(m);

    const head = `<div class="wk-row wk-head"><span></span>${DAYS.map(d => `<div class="wk-dh ${d === 0 ? 'sun' : d === 6 ? 'sat' : ''}"><b>${P.DOW[d]}</b><small>${total(d) ? h.fmtMin(total(d)) : '&nbsp;'}</small></div>`).join('')}</div>`;
    const un = `<div class="wk-row wk-un"><span class="wk-lab">시간<br>미정</span>${DAYS.map(d => `<div class="wk-ucol" data-day="${d}">${all.filter(o => o.d === d && o.start == null).map(o =>
      `<div class="wu ${isSel(o) ? 'sel' : ''}" data-rid="${esc(o.r.id)}" data-day="${d}" data-d="${o.min}" style="--c:${colorOf(S, o.r)}" title="아래 시간표로 끌어 시각을 정하세요"><span>${esc(o.r.title)}</span><b>${o.min}분</b></div>`).join('')}</div>`).join('')}</div>`;
    const cols = DAYS.map(d => `<div class="wk-col" data-day="${d}" data-t0="${lo}">
        ${avail(d).map(([a, b]) => { const s = Math.max(a, lo); return b > s ? `<div class="wk-av" style="top:${(s - lo) * PPM}px;height:${(b - s) * PPM}px"></div>` : ''; }).join('')}
        ${hours.map(m => `<div class="wk-hr" style="top:${(m - lo) * PPM}px"></div>`).join('')}
        ${all.filter(o => o.d === d && o.start != null).map(o => {
    const c = colorOf(S, o.r), hpx = Math.max(o.min * PPM - 2, 20);
    return `<div class="wb ${isSel(o) ? 'sel' : ''} ${hpx < 44 ? 'sm' : ''}" data-rid="${esc(o.r.id)}" data-day="${d}" data-s="${o.start}" data-d="${o.min}" style="top:${(o.start - lo) * PPM}px;height:${hpx}px;--c:${c};--cb:${h.rgba(c, 0.22)}" title="${esc(o.r.title)}">
          <div class="tt">${esc(o.r.title)}</div><div class="tm">${P.range12(o.start, o.start + o.min)} · ${o.min}분</div>${o.r.amount ? `<div class="tp">${esc(o.r.amount)}</div>` : ''}<i class="wrz" title="아래쪽 끝을 끌어 길이 조절"></i></div>`;
  }).join('')}</div>`).join('');
    return `<div class="wk" data-t0="${lo}">${head}${un}<div class="wk-wrap"><div class="wk-body" style="height:${H}px"><div class="wk-hours">${hours.map(m => `<span style="top:${(m - lo) * PPM}px">${P.t12s(m)}</span>`).join('')}</div>${cols}</div></div></div>`;
  }

  // ---------- 오른쪽 패널 ----------
  function dayChips(r, i) {
    return [1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="dchip ${r.days.includes(d) ? 'on' : ''}" data-action="rtday" data-i="${i}" data-d="${d}">${P.DOW[d]}</button>`).join('');
  }
  function editor(S) {
    const r = S.routines.find(x => x.id === A.ui.rtSel);
    ensure(r);
    const i = S.routines.indexOf(r), b = `routines.${i}`, sb = P.subj(S, r.sid);
    const sorted = r.days.slice().sort((x, y) => x - y);
    const day = r.days.includes(A.ui.rtDay) ? A.ui.rtDay : (sorted.length ? sorted[0] : null);
    const preset = (name, days) => `<button type="button" class="btn sm" data-action="rtpreset" data-i="${i}" data-days="${days.join(',')}">${name}</button>`;
    const perDay = day == null ? '' : `<section class="grp"><h3>${P.DOW[day]}요일만 다르게 <small>예외로 따로 정할 때만 써요 — 평소엔 위의 ‘모든 요일’ 값이 반복돼요</small></h3>
        <div class="fl"><label>시작 시각${h.tsel(`${b}.starts.${day}`, r.starts[day] != null ? P.hm(r.starts[day]) : '', false, { none: r.start != null ? `기본값 (${P.t12(r.start)})` : '시간 미정', tmin: true })}</label>${tmplKeys(S, r.id, day)}</div>
        ${row('길이', `비워 두면 기본 ${r.min}분`, h.step(`${b}.durs.${day}`, r.durs[day], { step: 5, min: 5, max: 480, unit: '분', def: r.min }))}
        <div class="fl"><button class="btn sm" data-action="rtsameall" data-i="${i}" data-d="${day}">이 요일 값을 모든 요일의 기본으로</button><button class="btn sm ghost" data-action="rtresetday" data-i="${i}" data-d="${day}">이 요일 설정 지우기</button></div></section>`;
    return `<div class="panel detail">
      <div class="dh"><i class="dot big" style="background:${sb ? sb.color : '#94a3b8'}"></i><h2>${esc(r.title)}</h2><button class="btn sm ghost" data-action="rtclose">닫기</button><button class="btn sm ghost danger" data-action="delRoutine" data-i="${i}">삭제</button></div>
      <div class="hint">${esc(sb ? sb.name : '')} · ${P.daysText(r.days)}${r.start != null ? ' · ' + P.t12(r.start) + ' 시작' : ' · 시간 미정'} · ${r.min}분${r.amount ? ' · ' + esc(r.amount) : ''}</div>
      <section class="grp"><h3>무엇을</h3>
        <div class="fl"><label>이름<input type="text" data-bind="${b}.title" data-render="1" value="${esc(r.title)}" style="min-width:12rem"></label>
          <label>과목<select data-bind="${b}.sid" data-render="1">${subjOpts(S, r.sid)}</select></label></div>
        <div class="fl"><label class="wide">목표량 · 메모 <small class="muted">(예: 단어 30개 — 오늘 탭에도 보여요)</small><input type="text" data-bind="${b}.amount" data-render="1" value="${esc(r.amount || '')}"></label></div></section>
      <section class="grp"><h3>요일 · 시각 · 길이 <small>한 번 정하면 선택한 요일마다 반복돼요</small></h3>
        <div class="dchips">${dayChips(r, i)}</div>
        <div class="fl">${preset('매일', [0, 1, 2, 3, 4, 5, 6])}${preset('평일', [1, 2, 3, 4, 5])}${preset('주말', [6, 0])}</div>
        <div class="fl"><label>시작 시각 (모든 요일)${h.tsel(`${b}.start`, r.start != null ? P.hm(r.start) : '', false, { none: '시간 미정', tmin: true })}</label>${tmplKeys(S, r.id, r.days.find(d => d >= 1 && d <= 5) != null ? r.days.find(d => d >= 1 && d <= 5) : 1, 'rtsessdef')}</div>
        ${row('길이 (모든 요일)', '요일별로 따로 정하지 않았을 때', h.step(`${b}.min`, r.min, { step: 5, min: 5, max: 300, unit: '분' }))}</section>
      ${perDay}
      <section class="grp"><h3>기간</h3>
        <div class="fl"><label>시작<input type="date" data-bind="${b}.from" data-render="1" value="${esc(r.from || '')}"></label>
          <label>끝 <small class="muted">(비우면 계속)</small><input type="date" data-bind="${b}.until" data-render="1" value="${esc(r.until || '')}"></label></div>
        ${h.sw(`${b}.on`, r.on !== false, '이 루틴 켜기', '끄면 시간표와 계획에서 잠시 빠져요', true)}</section></div>`;
  }

  function reviewEditor(S) {
    const sb = P.subj(S, A.ui.rtSel.slice(3));
    if (!sb) return idle(S);
    sb.rvStarts = sb.rvStarts || {}; sb.rvDurs = sb.rvDurs || {}; sb.mins = sb.mins || {};
    const i = S.subjects.indexOf(sb), b = `subjects.${i}`, def = reviewDef(S, sb.id);
    const days = [1, 2, 3, 4, 5].filter(w => (S.timetable[w - 1] || []).includes(sb.id));
    const day = days.includes(A.ui.rtDay) ? A.ui.rtDay : days[0];
    const perDay = day == null ? '' : `<section class="grp"><h3>${P.DOW[day]}요일만 다르게 <small>예외로 따로 정할 때만 써요 — 평소엔 아래 ‘모든 수업 요일’ 값이 반복돼요</small></h3>
        <div class="fl"><label>시작 시각${h.tsel(`${b}.rvStarts.${day}`, sb.rvStarts[day] != null ? P.hm(sb.rvStarts[day]) : '', false, { none: sb.rvStart != null ? `기본값 (${P.t12(sb.rvStart)})` : '시간 미정', tmin: true })}</label>${tmplKeys(S, 'rv:' + sb.id, day)}</div>
        ${row('길이', `비워 두면 기본 ${def}분`, h.step(`${b}.rvDurs.${day}`, sb.rvDurs[day], { step: 5, min: 5, max: 240, unit: '분', def }))}
        <div class="fl"><button class="btn sm" data-action="rvsameall" data-sid="${esc(sb.id)}" data-d="${day}">이 요일 값을 모든 수업 요일의 기본으로</button><button class="btn sm ghost" data-action="rvresetday" data-sid="${esc(sb.id)}" data-d="${day}">이 요일 설정 지우기</button></div></section>`;
    return `<div class="panel detail">
      <div class="dh"><i class="dot big" style="background:${sb.color}"></i><h2>${esc(sb.name)} 복습</h2><button class="btn sm ghost" data-action="rtclose">닫기</button></div>
      <div class="hint">수업이 있는 날, 그 수업을 복습하는 시간이에요. 시간표(수업 요일)에 맞춰 자동으로 생겨요.</div>
      <section class="grp"><h3>수업 요일</h3><div class="dchips">${days.map(w => `<span class="dchip on static">${P.DOW[w]}</span>`).join('') || '<span class="muted">시간표에 이 과목 수업이 없어요</span>'}</div>
        <div class="hint">수업 요일은 <button class="link" data-action="tab" data-tab="settings">설정</button> → 시간표에서 바꿔요.</div></section>
      ${perDay}
      <section class="grp"><h3>복습 시각 · 설정 <small>수업 요일마다 반복돼요</small></h3>
        <div class="fl"><label>시작 시각 (모든 수업 요일)${h.tsel(`${b}.rvStart`, sb.rvStart != null ? P.hm(sb.rvStart) : '', false, { none: '시간 미정', tmin: true })}</label>${tmplKeys(S, 'rv:' + sb.id, days[0] != null ? days[0] : 1, 'rtsessdef')}</div>
        ${h.sw(`${b}.review`, sb.review, '수업 후 복습', '끄면 이 과목은 복습이 생기지 않아요', true)}
        ${row('기본 길이', `기록이 쌓이면 자동으로 보정돼요 (지금 ${def}분)`, h.step(`${b}.mins.review`, sb.mins.review, { step: 5, min: 5, max: 180, unit: '분', def: S.settings.minDefaults.review }))}</section></div>`;
  }
  function reviewList(S) {
    const subs = S.subjects.filter(sb => sb.review);
    if (!subs.length) return '';
    return `<h3>수업 후 복습 <small class="muted">수업 요일마다 자동으로 생겨요</small></h3>${subs.map(sb => {
      const days = [1, 2, 3, 4, 5].filter(w => (S.timetable[w - 1] || []).includes(sb.id));
      return `<button class="mi" data-action="rtpick" data-id="rv:${esc(sb.id)}" style="--c:${sb.color}"><i class="dot" style="background:${sb.color}"></i><span class="mt">${esc(sb.name)} 복습</span><span class="muted small">${days.map(w => P.DOW[w]).join('·') || '수업 없음'}</span><span class="mm">${reviewDef(S, sb.id)}분</span></button>`;
    }).join('')}`;
  }

  function newForm(S) {
    const f = A.ui.rtNew;
    const chips = [1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="dchip ${f.days.includes(d) ? 'on' : ''}" data-action="rnday" data-d="${d}">${P.DOW[d]}</button>`).join('');
    return `<div class="panel detail"><div class="dh"><h2>새 루틴</h2><button class="btn sm ghost" data-action="rncancel">취소</button></div>
      <section class="grp"><div class="fl"><label class="wide">이름<input type="text" id="rn-title" data-bind="ui.rtNew.title" value="${esc(f.title)}" placeholder="예: 단어 암기, Math 문제풀이"></label></div>
        <div class="fl"><label>과목<select data-bind="ui.rtNew.sid">${subjOpts(S, f.sid)}</select></label></div>
        <div class="fl"><label class="wide">목표량 · 메모 <small class="muted">(선택)</small><input type="text" data-bind="ui.rtNew.amount" value="${esc(f.amount)}" placeholder="예: 단어 30개"></label></div></section>
      <section class="grp"><h3>언제, 얼마나</h3><div class="dchips">${chips}</div>
        <div class="fl"><label>시작 시각${h.tsel('ui.rtNew.start', f.start, false, { none: '시간 미정' })}</label></div>
        ${row('길이', '', h.step('ui.rtNew.min', f.min, { step: 5, min: 5, max: 300, unit: '분' }))}</section>
      <button class="btn primary" data-action="rncreate">만들기</button></div>`;
  }

  function satForm(S) {
    const f = A.ui.satForm || (A.ui.satForm = { date: '', vocab: true, rw: true, math: true, mock: true });
    return `<div class="panel detail"><div class="dh"><h2>SAT 준비 추가</h2><button class="btn sm ghost" data-action="rncancel">취소</button></div>
      <div class="hint">시험 날짜와 어떤 공부를 할지만 고르면 기본 루틴이 만들어져요. 시각·요일·길이는 왼쪽 시간표에서 끌어서 정해요. 시험 날짜는 캘린더에서 시험 라벨을 끌어 옮겨도 돼요.</div>
      <section class="grp"><div class="fl"><label>SAT 시험 날짜<input type="date" data-bind="ui.satForm.date" value="${esc(f.date)}"></label></div></section>
      <section class="grp"><h3>만들 루틴</h3>
        ${h.sw('ui.satForm.vocab', f.vocab, '단어 암기', '매일 20분 · 단어 30개', true)}
        ${h.sw('ui.satForm.rw', f.rw, 'Reading & Writing 문제풀이', '월·수·금 40분', true)}
        ${h.sw('ui.satForm.math', f.math, 'Math 문제풀이', '화·목·일 40분', true)}
        ${h.sw('ui.satForm.mock', f.mock, '모의고사', '토요일 3시간 (풀이 + 오답 정리)', true)}</section>
      <button class="btn primary" data-action="addSat">SAT 준비 만들기</button></div>`;
  }

  function idle(S) {
    return `<div class="panel detail"><div class="dh"><h2>루틴</h2></div>
      <div class="hint">왼쪽 시간표에서 <b>블록을 끌어</b> 요일·시각을 정하고, <b>아래쪽 끝을 끌어</b> 길이를 바꿔요. <b>빈 곳을 두 번 누르면</b> 그 시간에 새 루틴을 만들어요. ‘시간 미정’ 칸의 루틴은 아래 시간표로 끌어 내려 시각을 정하세요. 블록을 끌면 그 루틴의 <b>모든 요일이 함께 움직여 반복</b>돼요 (한 요일만 바꾸려면 <b>Alt 또는 Shift</b>를 누른 채 끌어요). 블록을 누르면 여기서 이름·과목·목표량·요일별 시간까지 고쳐요. <b>과목별 수업 후 복습</b>도 수업 요일마다 시간표에 올라와 있어서 똑같이 끌어서 시각·길이를 정해요.</div>
      ${S.routines.length ? `<h3>루틴 ${S.routines.length}개</h3>${S.routines.map(r => { const sb = P.subj(S, r.sid); return `<button class="mi" data-action="rtpick" data-id="${esc(r.id)}" style="--c:${colorOf(S, r)}"><i class="dot" style="background:${colorOf(S, r)}"></i><span class="mt">${esc(r.title)}</span><span class="muted small">${esc(sb ? sb.short || sb.name : '')} · ${P.daysText(r.days)}${r.on === false ? ' · 꺼짐' : ''}</span><span class="mm">${r.min}분</span></button>`; }).join('')}` : '<div class="hint">아직 루틴이 없어요. ‘＋ 새 루틴’ 또는 ‘＋ SAT 준비 추가’로 시작하세요.</div>'}${reviewList(S)}</div>`;
  }

  A.views.routine = function (S) {
    S.routines.forEach(ensure);
    let right;
    if (A.ui.rtMode === 'sat') right = satForm(S);
    else if (A.ui.rtNew) right = newForm(S);
    else if (A.ui.rtSel && String(A.ui.rtSel).startsWith('rv:')) right = reviewEditor(S);
    else if (A.ui.rtSel && S.routines.some(r => r.id === A.ui.rtSel)) right = editor(S);
    else right = idle(S);
    return `<div class="split rt-split"><section class="pane-l">
      <div class="rt-top"><h2>주간 루틴 시간표</h2><div class="rt-btns"><button class="btn sm primary" data-action="rtnew">＋ 새 루틴</button><button class="btn sm" data-action="rtsat">＋ SAT 준비 추가</button></div></div>
      <div class="rt-hint">블록을 끌면 그 루틴의 <b>모든 요일에 반복</b>돼요 · 한 요일만 바꾸려면 <b>Alt(또는 Shift)</b>를 누른 채 끌어요 · 아래 끝을 끌면 길이</div>
      <div class="wkscroll">${gridHtml(S)}</div></section><aside class="pane-r">${right}</aside></div>`;
  };

  // ---------- 모델 변경 ----------
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
  // 시간표에서 끌어 옮길 때의 규칙
  //  · 같은 요일에서 시각을 바꾸면 → 그 루틴의 '기본 시각'이 바뀌어 모든 요일에 반복 (그 요일에 따로 정한 값이 있으면 그 값만). opt.only(Alt/Shift) 면 그 요일만.
  //  · '시간 미정' 칩을 시간표에 놓으면 → 기본 시각이 정해져 모든 요일에 반복 (놓은 요일이 없었으면 요일도 추가)
  //  · 다른 요일로 끌면 → 그 한 번을 다른 요일로 옮김 · '시간 미정' 칸에 놓으면 → 시각을 모두 지움
  //  · 길이도 같은 규칙: 기본 길이가 바뀌고, opt.only 이거나 이미 따로 정한 요일이면 그 요일만
  A.moveOcc = function (rid, from, to, start, dur, opt) {
    opt = opt || {};
    const S = A.S, rv = String(rid).startsWith('rv:');
    const obj = rv ? P.subj(S, rid.slice(3)) : S.routines.find(x => x.id === rid);
    if (!obj) return;
    if (rv && from !== to) { A.toast('복습은 수업이 있는 요일에만 해요 (수업 요일은 설정 → 시간표에서 바꿔요)', true); A.render(); return; }
    if (rv) { obj.rvStarts = obj.rvStarts || {}; obj.rvDurs = obj.rvDurs || {}; obj.mins = obj.mins || {}; } else ensure(obj);
    const st = () => (rv ? obj.rvStarts : obj.starts), du = () => (rv ? obj.rvDurs : obj.durs);
    const defStart = rv ? obj.rvStart : obj.start, defMin = rv ? reviewDef(S, obj.id) : obj.min;
    if (start != null) {
      const others = occs(S).filter(o => o.d === to && o.start != null && !(o.r.id === rid && o.d === from)).map(o => [o.start, o.start + o.min]);
      start = resolve(start, dur, others);
    }
    if (start == null) {
      if (rv) { obj.rvStart = null; obj.rvStarts = {}; } else { obj.start = null; obj.starts = {}; }
    } else if (opt.fromTray) {
      if (rv) obj.rvStart = start; else { obj.start = start; if (!obj.days.includes(to)) obj.days.push(to); }
    } else if (from === to) {
      if (opt.only || st()[to] != null) st()[to] = start; else if (rv) obj.rvStart = start; else obj.start = start;
    } else {
      obj.days = obj.days.filter(x => x !== from); delete st()[from]; delete du()[from];
      if (!obj.days.includes(to)) obj.days.push(to);
      if (defStart != null && start === defStart) delete st()[to]; else st()[to] = start;
    }
    if (dur === defMin) delete du()[to];
    else if (opt.only || du()[to] != null || from !== to) du()[to] = dur;
    else if (rv) obj.mins.review = dur; else obj.min = dur;
    A.ui.rtSel = rid; A.ui.rtDay = to; A.ui.rtNew = null; A.ui.rtMode = null;
    A.save(); A.render();
  };

  // ---------- 끌기 (블록·미정 칩) ----------
  let drag = null;
  document.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.target.closest('[data-action]')) return;
    const el = ev.target.closest('.wb, .wu');
    if (!el || !el.closest('.wk')) return;
    const r = el.getBoundingClientRect(), isBlock = el.classList.contains('wb');
    drag = { el, isBlock, rid: el.dataset.rid, day: +el.dataset.day, s: isBlock ? +el.dataset.s : null, d: +el.dataset.d, x0: ev.clientX, y0: ev.clientY, grab: Math.min(ev.clientY - r.top, isBlock ? 9999 : 10), mode: ev.target.closest('.wrz') ? 'resize' : 'move', moved: false, h0: r.height };
    ev.preventDefault();
  });
  document.addEventListener('pointermove', ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; A.ui.dragging = true; drag.el.classList.add('drag'); }
    if (drag.mode === 'resize' && drag.isBlock) {
      const dm = Math.round(dy / PPM / SNAP) * SNAP, dur = Math.max(5, drag.d + dm);
      drag.el.style.height = Math.max(dur * PPM - 2, 20) + 'px';
      const tm = drag.el.querySelector('.tm'); if (tm) tm.textContent = `${P.range12(drag.s, drag.s + dur)} · ${dur}분`;
    } else drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  function finish(ev, cancel) {
    if (!drag) return;
    const d = drag;
    drag = null; A.ui.dragging = false;
    d.el.classList.remove('drag'); d.el.style.transform = '';
    if (cancel) { A.render(); return; }
    if (!d.moved) { A.ui.rtSel = d.rid; A.ui.rtDay = d.day; A.ui.rtNew = null; A.ui.rtMode = null; A.render(); return; }
    if (d.mode === 'resize' && d.isBlock) {
      const dm = Math.round((ev.clientY - d.y0) / PPM / SNAP) * SNAP;
      A.moveOcc(d.rid, d.day, d.day, d.s, Math.max(5, d.d + dm), { only: ev.altKey || ev.shiftKey });
      return;
    }
    const els = document.elementsFromPoint(ev.clientX, ev.clientY);
    const col = els.find(e => e.classList && e.classList.contains('wk-col'));
    const un = els.find(e => e.classList && e.classList.contains('wk-ucol'));
    if (col) {
      const t0 = +col.dataset.t0, top = col.getBoundingClientRect().top;
      const start = Math.round((t0 + (ev.clientY - d.grab - top) / PPM) / SNAP) * SNAP;
      A.moveOcc(d.rid, d.day, +col.dataset.day, Math.max(0, start), d.d, { only: ev.altKey || ev.shiftKey, fromTray: !d.isBlock });
    } else if (un) A.moveOcc(d.rid, d.day, +un.dataset.day, null, d.d);
    else A.render();
  }
  document.addEventListener('pointerup', ev => finish(ev, false));
  document.addEventListener('pointercancel', ev => finish(ev, true));

  // 빈 곳을 두 번 누르면 그 요일·시각에 새 루틴
  function openNew(day, startMin) {
    const S = A.S;
    A.ui.rtMode = null; A.ui.rtSel = null;
    A.ui.rtNew = { title: '', sid: (P.subj(S, 'sat') ? 'sat' : (S.subjects[0] || {}).id) || '', days: [day], start: startMin == null ? '' : P.hm(Math.max(0, Math.min(P.DAY_END - 15, Math.round(startMin / 15) * 15))), min: 30, amount: '' };
    A.render();
    const t = document.getElementById('rn-title'); if (t) t.focus();
  }
  document.addEventListener('dblclick', ev => {
    const col = ev.target.closest('.wk-col');
    if (col && !ev.target.closest('.wb')) {
      const top = col.getBoundingClientRect().top;
      openNew(+col.dataset.day, +col.dataset.t0 + (ev.clientY - top) / PPM);
    }
    const un = ev.target.closest('.wk-ucol');
    if (un && !ev.target.closest('.wu')) openNew(+un.dataset.day, null);
  });

  // ---------- 액션 ----------
  const Ac = A.actions;
  Ac.rtnew = () => openNew(P.dow(P.today()), null);
  Ac.rtsat = () => { A.ui.rtMode = 'sat'; A.ui.rtSel = null; A.ui.rtNew = null; A.render(); };
  Ac.rncancel = () => { A.ui.rtMode = null; A.ui.rtNew = null; A.render(); };
  Ac.rtclose = () => { A.ui.rtSel = null; A.ui.rtDay = null; A.render(); };
  Ac.rtpick = el => { A.ui.rtSel = el.dataset.id; A.ui.rtDay = null; A.render(); };
  Ac.rnday = el => {
    const f = A.ui.rtNew, d = +el.dataset.d;
    f.days = f.days.includes(d) ? f.days.filter(x => x !== d) : f.days.concat(d);
    A.render();
  };
  Ac.rncreate = () => {
    const S = A.S, f = A.ui.rtNew, title = (h.val('rn-title') || f.title || '').trim();
    if (!title) { A.toast('이름을 입력하세요', true); return; }
    if (!f.days.length) { A.toast('요일을 하나 이상 고르세요', true); return; }
    if (!P.subj(S, f.sid)) { A.toast('과목을 고르세요', true); return; }
    const r = { id: P.uid(), title, sid: f.sid, days: f.days.slice(), min: f.min || 30, amount: (f.amount || '').trim(), from: P.today(), until: '', on: true, start: null, starts: {}, durs: {} };
    if (f.start) r.start = P.toMin(f.start);
    S.routines.push(r);
    A.ui.rtNew = null; A.ui.rtSel = r.id; A.ui.rtDay = r.days[0];
    A.save(); A.render(); A.toast('루틴을 만들었어요');
  };

  Ac.rtday = el => {
    const r = A.S.routines[+el.dataset.i], d = +el.dataset.d;
    if (!r) return;
    ensure(r);
    if (r.days.includes(d)) { r.days = r.days.filter(x => x !== d); delete r.starts[d]; delete r.durs[d]; } else r.days.push(d);
    A.ui.rtDay = r.days.includes(d) ? d : A.ui.rtDay;
    A.save(); A.render();
  };
  Ac.rtpreset = el => {
    const r = A.S.routines[+el.dataset.i];
    if (!r) return;
    ensure(r);
    const days = el.dataset.days.split(',').map(Number);
    for (const d of r.days) if (!days.includes(d)) { delete r.starts[d]; delete r.durs[d]; }
    r.days = days;
    A.save(); A.render();
  };
  Ac.rtsameall = el => {
    const r = A.S.routines[+el.dataset.i], d = +el.dataset.d;
    if (!r) return;
    ensure(r);
    const st = r.starts[d] != null ? r.starts[d] : r.start, du = r.durs[d] != null ? r.durs[d] : r.min;
    r.start = st != null ? st : null; r.min = du; r.starts = {}; r.durs = {};
    A.save(); A.render(); A.toast('이 요일 값을 모든 요일의 기본으로 만들었어요');
  };
  Ac.rtresetday = el => {
    const r = A.S.routines[+el.dataset.i], d = +el.dataset.d;
    if (!r) return;
    ensure(r); delete r.starts[d]; delete r.durs[d];
    A.save(); A.render();
  };
  Ac.rvsameall = el => {
    const sb = P.subj(A.S, el.dataset.sid), d = +el.dataset.d;
    if (!sb) return;
    sb.rvStarts = sb.rvStarts || {}; sb.rvDurs = sb.rvDurs || {}; sb.mins = sb.mins || {};
    const st = sb.rvStarts[d] != null ? sb.rvStarts[d] : sb.rvStart;
    sb.rvStart = st != null ? st : null;
    if (sb.rvDurs[d] != null) sb.mins.review = sb.rvDurs[d];
    sb.rvStarts = {}; sb.rvDurs = {};
    A.save(); A.render(); A.toast('이 요일 값을 모든 수업 요일의 기본으로 만들었어요');
  };
  Ac.rvresetday = el => {
    const sb = P.subj(A.S, el.dataset.sid), d = +el.dataset.d;
    if (!sb) return;
    sb.rvStarts = sb.rvStarts || {}; sb.rvDurs = sb.rvDurs || {};
    delete sb.rvStarts[d]; delete sb.rvDurs[d];
    A.save(); A.render();
  };
  Ac.rtsess = el => {
    const S = A.S, rid = el.dataset.rid, day = +el.dataset.day, i = +el.dataset.i, bl = tmplBlocks(S, day)[i];
    const all = occs(S), o = all.find(x => x.r.id === rid && x.d === day);
    if (!bl || !o) return;
    const taken = all.filter(x => x.d === day && x.start != null && x.r.id !== rid).map(x => [x.start, x.start + x.min]);
    const start = P.firstFit(bl[0], bl[1], taken, o.min);
    if (start == null) { A.toast(`${i + 1}자습(${P.t12(bl[0])}~${P.t12(bl[1])})에는 빈 자리가 부족해요`, true); return; }
    A.moveOcc(rid, day, day, start, o.min, { only: true });
  };
  Ac.rtsessdef = el => {
    const S = A.S, rid = el.dataset.rid, day = +el.dataset.day, i = +el.dataset.i, bl = tmplBlocks(S, day)[i];
    const all = occs(S), o = all.find(x => x.r.id === rid && x.d === day);
    if (!bl || !o) return;
    const taken = all.filter(x => x.d === day && x.start != null && x.r.id !== rid).map(x => [x.start, x.start + x.min]);
    const start = P.firstFit(bl[0], bl[1], taken, o.min);
    if (start == null) { A.toast(`${i + 1}자습(${P.t12(bl[0])}~${P.t12(bl[1])})에는 빈 자리가 부족해요`, true); return; }
    if (rid.startsWith('rv:')) { const sb = P.subj(S, rid.slice(3)); if (sb) sb.rvStart = start; }
    else { const r = S.routines.find(x => x.id === rid); if (r) r.start = start; }
    A.save(); A.render(); A.toast(`모든 요일 ${i + 1}자습 ${P.t12(start)} 시작으로 정했어요`);
  };
  Ac.delRoutine = el => {
    const r = A.S.routines[+el.dataset.i];
    if (!r || !window.confirm(`‘${r.title}’ 루틴을 지울까요?`)) return;
    A.S.routines.splice(+el.dataset.i, 1); A.ui.rtSel = null; A.ui.rtDay = null;
    A.save(); A.render();
  };

  Ac.addSat = () => {
    const f = A.ui.satForm || {}, S = A.S;
    if (!f.date) { A.toast('SAT 시험 날짜를 선택하세요', true); return; }
    if (f.date <= P.today()) { A.toast('시험 날짜는 오늘 이후여야 해요', true); return; }
    if (S.exams.some(e => e.id === 'e_sat')) { A.ui.rtMode = null; A.render(); A.toast('이미 SAT 준비가 있어요. 시간표에서 고치세요'); return; }
    if (!P.subj(S, 'sat')) {
      const used = new Set(S.subjects.map(x => x.color)), color = P.COLORS.find(c => !used.has(c)) || P.COLORS[S.subjects.length % P.COLORS.length];
      S.subjects.push({ id: 'sat', short: 'SAT', name: 'SAT', folder: 'SAT', aliases: ['SAT', '새트'], review: false, preview: false, weight: 4, hard: false, mins: {}, color });
    }
    // 시험 항목은 날짜 표시용 (공부 시간은 루틴으로만 잡는다)
    S.exams.push({ id: 'e_sat', sid: 'sat', label: '준비', date: f.date, confirmed: true, scope: [], budgetMin: 0, finalMin: 0, partial: 0, finalSpent: 0, finalDone: false });
    const until = P.addDays(f.date, -1);
    const mk = (title, days, min, amount) => S.routines.push({ id: P.uid(), title, sid: 'sat', days, min, amount, from: P.today(), until, on: true, start: null, starts: {}, durs: {} });
    let n = 0;
    if (f.vocab) { mk('단어 암기', [0, 1, 2, 3, 4, 5, 6], 20, '단어 30개'); n++; }
    if (f.rw) { mk('Reading & Writing 문제풀이', [1, 3, 5], 40, ''); n++; }
    if (f.math) { mk('Math 문제풀이', [2, 4, 0], 40, ''); n++; }
    if (f.mock) { mk('모의고사', [6], 180, '풀이 + 오답 정리'); n++; }
    A.ui.satForm = null; A.ui.rtMode = null; A.ui.rtSel = null;
    A.save(); A.render(); A.toast(`SAT 준비를 만들었어요 (루틴 ${n}개). ‘시간 미정’ 칸에서 아래 시간표로 끌어 시각을 정하세요`);
  };
})();
