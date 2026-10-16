/* v_today.js — 오늘 탭: 왼쪽 할 일 목록 / 오른쪽 시간대별 타임라인 */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc;
  const KIND = h.KIND;

  // 경고/안내. compact 면 급한 것(시간 부족)만 펼쳐 두고 나머지는 접어 둔다
  h.alerts = function (S, PLAN) {
    const urgent = [], info = [];
    for (const d of PLAN.deficits) {
      urgent.push(`<div class="note bad">⚠ <b>${esc(d.job.title)}</b> — 마감(${h.md(d.job.deadline)})까지 약 <b>${h.fmtMin(d.amount)}</b> 부족해요. 마감·범위를 조정하거나 가용 시간을 늘려야 해요.</div>`);
    }
    const unconf = S.exams.filter(e => !e.confirmed && e.date >= PLAN.today);
    if (unconf.length) info.push(`시험 날짜가 <b>미확정</b>인 과목이 ${unconf.length}개예요 (임시 날짜로 계산 중). 시험 시간표가 나오면 <button class="link" data-action="tab" data-tab="work">시험·과제</button>에서 날짜를 고치고 ‘확정’을 체크하세요.`);
    const nofix = S.fixed.filter(f => !(P.toMin(f.start) < P.toMin(f.end)));
    if (nofix.length) info.push(`고정 일정 시간이 비어 있어요: ${nofix.map(f => esc(f.title)).join(', ')} — <button class="link" data-action="tab" data-tab="settings">설정</button>에서 시간을 넣으면 그 시간이 공부 시간에서 빠져요.`);
    const kan = S.tasks.filter(t => !t.done && t.totalMin > 0).length;
    if (!kan && S.milestones.some(m => m.kind === 'deadline' && m.date >= PLAN.today)) info.push(`마감 일정(KSEF·포스터 등)에 작업 시간이 아직 없어요 — <button class="link" data-action="tab" data-tab="work">시험·과제</button>에서 ‘작업으로 추가’를 누르세요.`);
    return { urgent: urgent.join(''), info };
  };
  h.warnings = function (S, PLAN) {
    const a = h.alerts(S, PLAN);
    return a.urgent + a.info.map(t => `<div class="note warn">${t}</div>`).join('');
  };

  function checklist(S, key, items, editable) {
    return `<ul class="chk">${items.map((it, i) => {
      const on = !!S.checks[key + ':' + i];
      return `<li><label><input type="checkbox" data-action="chk" data-key="${esc(key)}" data-i="${i}" ${on ? 'checked' : ''} ${editable ? '' : 'disabled'}>${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}<span class="tx ${on ? 'done' : ''}">${esc(it.text)}${it.min != null ? ` <small class="muted">${it.min}분</small>` : ''}</span></label></li>`;
    }).join('')}</ul>`;
  }
  const bullets = (arr, open, label) => `<details ${open ? 'open' : ''}><summary>${label} (${arr.length})</summary><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`;

  function bodyOf(S, e) {
    if (e.kind === 'routine') { const r = e.item.routine; return r.amount ? `<div class="hint">목표: <b>${esc(r.amount)}</b></div>` : ''; }
    if (e.kind === 'review') {
      const note = e.item.note;
      if (!note) return `<div class="hint">저장된 노트가 없어요. <button class="link" data-action="tab" data-tab="notes">노트 탭</button>에서 다글로 파일과 프롬프트로 체크리스트를 만들 수 있어요. 없이도 복습 후 ✓ 를 누르면 돼요.</div>`;
      let out = '';
      if (note.summary && note.summary.length) out += bullets(note.summary, false, '요약');
      if (note.concepts && note.concepts.length) out += bullets(note.concepts, false, '핵심 개념');
      if (note.items && note.items.length) out += checklist(S, e.id, note.items, true);
      if (note.questions && note.questions.length) out += bullets(note.questions, true, '헷갈린 부분');
      return out;
    }
    if (e.kind === 'preview') {
      const src = e.item.src;
      if (!src) return `<div class="hint">노트에 다음 수업 범위가 없어요. 교재에서 다음 범위를 미리 훑어보세요.</div>`;
      return checklist(S, e.id, src.items, true) + `<div class="muted small">${h.md(src.date)} 수업 노트 기준</div>`;
    }
    const ref = e.job.ref;
    if (e.kind === 'final') return `<div class="hint">전 범위를 훑고, 헷갈린 부분과 틀린 문제를 다시 보세요.</div>`;
    if (e.kind === 'exam') {
      if (!ref.scope || !ref.scope.length) return `<div class="hint">범위(단원)를 입력하면 단원별 진도를 관리해요 → <button class="link" data-action="tab" data-tab="work">시험·과제</button>.</div>`;
      const next = ref.scope.map((c, i) => [c, i]).filter(([c]) => !c.done).slice(0, 3);
      return `<ul class="chk">${next.map(([c, i]) => `<li><label><input type="checkbox" data-action="chapter" data-ex="${esc(ref.id)}" data-i="${i}"><span class="tx">${esc(c.title)} <small class="muted">${c.min || S.settings.minDefaults.chapter}분</small></span></label></li>`).join('')}</ul>`;
    }
    if (ref.items && ref.items.length) {
      return `<ul class="chk">${ref.items.map((it, i) => `<li><label><input type="checkbox" data-action="taskitem" data-t="${esc(ref.id)}" data-i="${i}" ${it.done ? 'checked' : ''}><span class="tx ${it.done ? 'done' : ''}">${esc(it.text)}${it.min != null ? ` <small class="muted">${it.min}분</small>` : ''}</span></label></li>`).join('')}</ul>`;
    }
    return '';
  }

  function subOf(S, e, today) {
    if (e.kind === 'routine') return `${P.daysText(e.item.routine.days)} 루틴 · ${e.item.routine.min}분`;
    if (e.kind === 'review') {
      const it = e.item, per = it.periods.length ? ` ${it.periods.join('·')}교시` : '';
      const when = it.overdue ? `${h.md(it.date)} 수업${per} · ${it.overdue}일 밀림` : `오늘 수업${per}`;
      const inf = it.estInfo && it.estInfo.auto ? ` · 최근 ${it.estInfo.n}회 중앙값 ${Math.round(it.estInfo.median)}분 반영` : '';
      return `${when}${inf}`;
    }
    if (e.kind === 'preview') return `${h.md(e.item.date)} ${e.item.periods.join('·')}교시 수업 대비`;
    const j = e.job, ref = j.ref;
    const rest = `남은 ${h.fmtMin(j.rem)} · 오늘 몫 ${h.fmtMin(e.planned)}${e.spent ? ` (이미 ${e.spent}분)` : ''}`;
    if (e.kind === 'task') return `마감 ${h.md(j.deadline)} ${h.dday(j.deadline, today)} · ${rest}`;
    const when = e.kind === 'exam' ? `시험 ${h.md(ref.date)} ${h.dday(ref.date, today)}${ref.confirmed ? '' : ' (미확정)'}` : `시험 ${h.md(ref.date)} 직전`;
    return `${when} · ${rest}`;
  }

  function chooser(S, e) {
    const f = A.ui.finish;
    if (!f || f.key !== e.id) return '';
    let presets;
    if (f.mode === 'item') {
      presets = [0.5, 1, 1.5, 2].map(x => Math.max(5, P.round5(e.min * x)));
      presets = presets.filter((v, i) => presets.indexOf(v) === i);
    } else presets = [15, 30, 45, 60, 90];
    return `<div class="finish"><span class="muted small">${f.mode === 'item' ? '실제로 얼마나 걸렸나요?' : '얼마나 했나요?'}</span>
      ${presets.map(m => `<button class="btn sm" data-action="finishpick" data-key="${esc(e.id)}" data-min="${m}">${m}분</button>`).join('')}
      <input type="number" id="fin-min" min="1" max="600" placeholder="직접">
      <button class="btn sm ok" data-action="finishpick" data-key="${esc(e.id)}" data-min="custom">확인</button>
      <button class="btn sm ghost" data-action="finishcancel">닫기</button></div>`;
  }

  function timeEdit(S, e, date) {
    const s = e.pieces.length ? e.pieces[0][0] : 1110;
    return `<div class="te"><span class="muted small">시간 직접 설정</span>
      <label>시작 ${h.tsel('', P.hm(s), false, { id: 'tm-s' })}</label>
      <label>길이 <input type="number" id="tm-d" min="5" step="5" value="${e.min}" style="width:4.6rem">분</label>
      <button class="btn sm" data-action="applytime" data-id="${esc(e.id)}" data-date="${date}">적용</button>
      ${e.manual ? `<button class="btn sm ghost" data-action="unpin" data-id="${esc(e.id)}" data-date="${date}">자동 배치로</button>` : ''}</div>`;
  }

  function customRow(S, e, date) {
    const c = e.custom, color = h.colorOf(S, e), slot = e.pieces.length ? P.range12(e.pieces[0][0], e.pieces[0][1]) : (c.alloc ? '시간 못 정함' : '');
    const live = date === P.today(), running = live && S.timer && S.timer.key === e.id;
    const todo = c.kind === 'todo';
    return `<div class="ri ${running ? 'run' : ''} ${A.ui.sel === e.id ? 'sel' : ''}" data-row="${esc(e.id)}" style="--c:${color}"><div class="ri-h">
      ${todo && live ? `<button class="ck" data-action="finish" data-key="${esc(e.id)}" title="완료로 표시">✓</button>` : '<span class="ck-sp"></span>'}
      <span class="ri-main"><span class="ri-t"><i class="dot" style="background:${color}"></i>${esc(c.title)}<span class="pill">${c.alloc ? esc(h.kindLabel(e)) : (todo ? '할 일' : '일정')}</span></span><span class="ri-s">${slot} · ${h.fmtMin(e.min)}${e.carried ? ` · ${h.md(c.date)} 배정 · ${e.overdue}일 밀림` : ''}</span></span>
      ${h.sessionKeys(S, e, date)}
      ${todo && live ? (running ? `<button class="tbtn run" data-action="timerstop">⏸ <span data-timer="${esc(e.id)}"></span></button>` : `<button class="tbtn" data-action="timer" data-key="${esc(e.id)}" data-label="${esc(c.title)}">▶ <span data-timer="${esc(e.id)}"></span></button>`) : ''}
      <button class="x" data-action="delentry" data-date="${date}" data-id="${esc(e.id)}" title="삭제">×</button></div>${todo && live ? chooser(S, e) : ''}</div>`;
  }

  // 한 과목의 복습·예습·시험 대비를 하루에 블록 하나로 보여준다
  const PLBL = { review: '복습', preview: '예습', exam: '시험 대비', final: '직전 정리' };
  const lbl = p => (p.k === 'routine' ? p.item.routine.title : PLBL[p.k]);
  function partEntry(S, e, p) {
    return p.item ? { kind: p.k, id: p.item.key, sid: e.sid, item: p.item, min: p.min }
      : { kind: p.k, id: p.job.id, sid: e.sid, job: p.job, min: p.min, planned: p.w.min, spent: p.w.sp };
  }
  function studyRow(S, e, date, today, open) {
    const live = date === today, color = h.colorOf(S, e), running = live && S.timer && S.timer.key === e.id;
    const slot = e.pieces.length ? e.pieces.map(([a, b]) => P.range12(a, b)).join(' · ') : '시간 못 정함';
    const timerBtn = !live ? '' : running
      ? `<button class="tbtn run" data-action="timerstop" title="정지">⏸ <span data-timer="${esc(e.id)}"></span></button>`
      : `<button class="tbtn" data-action="timer" data-key="${esc(e.id)}" data-label="${esc(h.titleOf(S, e))}" title="타이머 시작">▶ <span data-timer="${esc(e.id)}"></span></button>`;
    let more = '';
    if (open) {
      const sections = e.parts.map(p => {
        const pe = partEntry(S, e, p);
        const skipBtn = p.item ? `<button class="btn sm ghost" data-action="skip" data-key="${esc(p.item.key)}" title="다시 띄우지 않아요">${p.k === 'routine' ? '오늘은 건너뛰기' : `이 ${PLBL[p.k]}은 안 할래요`}</button>` : '';
        return `<div class="part"><div class="part-h"><b>${esc(lbl(p))}</b> <small>${p.min}분</small>${skipBtn}</div><div class="sub">${esc(subOf(S, pe, today))}</div>${bodyOf(S, pe)}</div>`;
      }).join('');
      more = `<div class="ri-b">${sections}${e.extra ? `<div class="hint">자유 공부 ${e.extra}분이 더 잡혀 있어요 (직접 늘린 시간)</div>` : ''}${timeEdit(S, e, date)}${live ? chooser(S, e) : ''}
        <div class="acts"><button class="btn ghost" data-action="delentry" data-date="${date}" data-id="${esc(e.id)}">${live ? '오늘' : '이 날'} 계획에서 빼기</button></div></div>`;
    }
    return `<div class="ri ${open ? 'open' : ''} ${A.ui.sel === e.id ? 'sel' : ''} ${running ? 'run' : ''}" data-row="${esc(e.id)}" style="--c:${color}">
      <div class="ri-h">${live ? `<button class="ck" data-action="finish" data-key="${esc(e.id)}" title="이 과목 공부를 마쳤어요">✓</button>` : '<span class="ck-sp"></span>'}
        <button class="ri-main" data-action="toggleRow" data-id="${esc(e.id)}">
          <span class="ri-t"><i class="dot" style="background:${color}"></i>${esc(h.titleOf(S, e))}<span class="pill">${e.fixedRoutine ? esc(e.parts[0].k === 'review' ? '복습' : ((P.subj(S, e.sid) || {}).name || '')) : esc(h.partsLabel(e))}</span>${e.manual ? '<span class="pill">고정</span>' : ''}</span>
          <span class="ri-s">${slot} · ${h.fmtMin(e.min)}</span></button>${h.sessionKeys(S, e, date)}${timerBtn}</div>${more}</div>`;
  }

  function row(S, e, date, today, open) {
    if (e.custom) return customRow(S, e, date);
    if (e.kind === 'study') return studyRow(S, e, date, today, open);
    const live = date === today, color = h.colorOf(S, e), running = live && S.timer && S.timer.key === e.id;
    const slot = e.pieces.length ? e.pieces.map(([a, b]) => P.range12(a, b)).join(' · ') : '시간 못 정함';
    const isItem = e.kind === 'review' || e.kind === 'preview';
    const check = !live ? '<span class="ck-sp"></span>' : isItem
      ? `<button class="ck" data-action="finish" data-key="${esc(e.id)}" title="완료로 표시">✓</button>`
      : `<button class="ck" data-action="jobdone" data-key="${esc(e.id)}" data-min="${e.min}" title="오늘 몫 ${e.min}분을 했어요">✓</button>`;
    const timerBtn = !live ? '' : running
      ? `<button class="tbtn run" data-action="timerstop" title="정지">⏸ <span data-timer="${esc(e.id)}"></span></button>`
      : `<button class="tbtn" data-action="timer" data-key="${esc(e.id)}" data-label="${esc(h.titleOf(S, e))}" title="타이머 시작">▶ <span data-timer="${esc(e.id)}"></span></button>`;
    let more = '';
    if (open) {
      more = `<div class="ri-b"><div class="sub">${esc(subOf(S, e, today))}</div>${bodyOf(S, e)}${timeEdit(S, e, date)}${live ? chooser(S, e) : ''}
        <div class="acts">${isItem
    ? `<button class="btn ghost" data-action="skip" data-key="${esc(e.id)}">${live ? '오늘은' : '이 날은'} 건너뛰기</button>`
    : `${live ? `<button class="btn" data-action="jobmore" data-key="${esc(e.id)}">시간 기록</button>` : ''}${e.kind === 'task' ? `<button class="btn ghost" data-action="taskfinish" data-t="${esc(e.id.split('|')[1])}">과제 끝!</button>` : ''}`}</div></div>`;
    }
    return `<div class="ri ${open ? 'open' : ''} ${A.ui.sel === e.id ? 'sel' : ''} ${running ? 'run' : ''}" data-row="${esc(e.id)}" style="--c:${color}">
      <div class="ri-h">${check}<button class="ri-main" data-action="toggleRow" data-id="${esc(e.id)}">
        <span class="ri-t"><i class="dot" style="background:${color}"></i>${esc(h.titleOf(S, e))}<span class="pill ${e.kind === 'task' ? 'warn' : ''}">${KIND[e.kind]}</span>${e.manual ? '<span class="pill">고정</span>' : ''}</span>
        <span class="ri-s">${slot} · ${h.fmtMin(e.min)}</span></button>${h.sessionKeys(S, e, date)}${timerBtn}</div>${more}</div>`;
  }

  function todayWork(S) {
    const today = P.today(), by = {};
    for (const w of S.work) if (w.date === today) { by[w.key] = by[w.key] || { key: w.key, min: 0 }; by[w.key].min += w.min; }
    return Object.values(by);
  }

  // ---------- 날짜 이동 (오늘 탭에서 다른 날도 같은 화면으로 보고 고친다) ----------
  const MAXBACK = 60;
  const mdw = d => { const dt = P.parse(d); return `${dt.getMonth() + 1}월 ${dt.getDate()}일`; };
  function dayNav(date, today) {
    const live = date === today;
    return `<div class="daynav"><button class="btn" data-action="daynav" data-d="-1" title="이전 날">◀</button>
      <input type="date" class="daypick" data-bind="ui.dayView" data-render="1" value="${date}" title="날짜 고르기">
      <button class="btn" data-action="daynav" data-d="1" title="다음 날">▶</button>${live ? '' : '<button class="btn primary" data-action="daytoday">오늘로</button>'}</div>`;
  }
  const relLabel = (idx) => (idx === 0 ? '<span class="pill ok">오늘</span>' : idx === 1 ? '<span class="pill">내일</span>' : idx === 2 ? '<span class="pill">모레</span>' : idx > 2 ? `<span class="pill">${idx}일 뒤</span>` : `<span class="pill">${-idx}일 전</span>`);

  // 지난 날: 한 일 기록만 보여준다
  function pastDay(S, PLAN, date) {
    const today = PLAN.today, idx = P.diffDays(today, date), dt = P.parse(date);
    const logs = S.log.filter(l => l.date === date), total = logs.reduce((a, l) => a + l.act, 0);
    const ms = S.milestones.filter(m => m.date <= date && date <= (m.end || m.date)), ov = S.dayOverrides[date];
    const left = `<header class="dayhead"><h1>${dt.getMonth() + 1}월 ${dt.getDate()}일 <span>${P.DOW[dt.getDay()]}요일</span> ${relLabel(idx)}</h1>
        <div>${ms.map(m => `<span class="pill warn">${esc(m.title)}</span>`).join(' ')}${ov && ov.off ? `<span class="pill">쉬는 날${ov.note ? ' · ' + esc(ov.note) : ''}</span>` : ''}</div></header>
      ${dayNav(date, today)}
      <div class="stats"><div><span>한 시간</span><b>${h.fmtMin(total)}</b></div><div><span>기록</span><b>${logs.length}개</b></div></div>
      <div class="card donelist"><h2>한 일</h2>${logs.length ? logs.map(l => `<div class="r"><span>✓ ${esc(h.logLabel(S, l))}</span><span class="muted small right">${l.act}분</span></div>`).join('') : '<div class="hint">기록이 없는 날이에요.</div>'}</div>`;
    const right = `<div class="panel"><div class="ph"><h2>${mdw(date)} 기록</h2></div><div class="hint">지난 날은 기록만 볼 수 있어요. 시간표를 고치려면 오늘이나 앞 날짜로 가세요.</div><div class="fl"><button class="btn primary" data-action="daytoday">오늘로</button></div></div>`;
    return `<div class="split"><div class="pane-l">${left}</div><aside class="pane-r">${right}</aside></div>`;
  }

  A.views.today = function (S, PLAN) {
    const today = PLAN.today, last = PLAN.days[PLAN.days.length - 1].date;
    let date = A.ui.dayView || today;
    if (date > last) date = last;
    if (date < P.addDays(today, -MAXBACK)) date = P.addDays(today, -MAXBACK);
    const idx = P.diffDays(today, date);
    if (idx < 0) return pastDay(S, PLAN, date);
    const live = idx === 0, D = PLAN.days[idx];
    const entries = D.entries;
    const planned = entries.filter(e => !(e.custom && e.custom.kind === 'event')).reduce((a, e) => a + e.min, 0);
    const works = live ? todayWork(S) : [];
    const doneMin = D.done.reduce((a, x) => a + (x.actual || 0), 0) + works.reduce((a, w) => a + w.min, 0);
    const pct = doneMin + planned ? Math.round(doneMin / (doneMin + planned) * 100) : 0;
    const dt = P.parse(date), ms = S.milestones.filter(m => m.date <= date && date <= (m.end || m.date));
    const ov = S.dayOverrides[date];
    const al = h.alerts(S, PLAN);
    const openId = A.ui.open && entries.some(e => e.id === A.ui.open) ? A.ui.open : (live && S.timer && entries.some(e => e.id === S.timer.key) ? S.timer.key : null);
    const who = live ? '오늘' : '이 날';

    const left = `
      <header class="dayhead"><h1>${dt.getMonth() + 1}월 ${dt.getDate()}일 <span>${P.DOW[dt.getDay()]}요일</span> ${relLabel(idx)}</h1>
        <div>${ms.map(m => `<span class="pill warn">${esc(m.title)}</span>`).join(' ')}${ov && ov.off ? `<span class="pill">쉬는 날${ov.note ? ' · ' + esc(ov.note) : ''}</span>` : ''}</div></header>
      ${dayNav(date, today)}
      <div class="stats">
        ${live ? `<div><span>남은 가용</span><b>${h.fmtMin(D.raw)}</b></div>
        <div><span>남은 계획</span><b>${h.fmtMin(planned)}</b></div>
        <div><span>오늘 한 시간</span><b>${h.fmtMin(doneMin)}</b></div>
        <div class="grow"><div class="prog"><i style="width:${pct}%"></i></div><span class="small muted">${pct}% 진행</span></div>`
    : `<div><span>가용</span><b>${h.fmtMin(D.raw)}</b></div><div><span>계획</span><b>${h.fmtMin(planned)}</b></div><div><span>여유</span><b>${h.fmtMin(Math.max(0, D.cap - planned))}</b></div>`}
      </div>
      ${(() => { const lost = entries.reduce((a, e) => a + (e.unplaced || 0), 0); return lost > 0 ? `<div class="note warn">${who} 할 일이 ${live ? '남은 ' : ''}가용 시간보다 <b>${h.fmtMin(lost)}</b> 많아요. 시간에 못 넣은 건 ‘시간 못 정함’으로 표시돼요. 안 할 건 줄을 열어 ‘안 할래요’로 빼거나 끌어서 옮기세요.</div>` : ''; })()}
      ${live ? `${al.urgent}${al.info.length ? `<details class="alerts"><summary>확인할 것 ${al.info.length}개</summary>${al.info.map(t => `<div class="note warn">${t}</div>`).join('')}</details>` : ''}` : ''}
      <div class="list">${entries.length ? entries.map(e => row(S, e, date, today, e.id === openId)).join('') : `<div class="empty">${D.raw === 0 ? `${who}은 ${live ? '남은 ' : ''}가용 시간이 없어요.` : `${who} 계획된 할 일이 없어요.`}</div>`}</div>
      ${D.dropped.length ? `<div class="card"><h2>${live ? '오늘은' : `${mdw(date)}에는`} 시간·상한 때문에 빠진 항목</h2><div class="hint">복습·예습 상한(${S.settings.reviewCapMin}분) 또는 남은 시간이 부족해요. ${S.settings.carryAll === false ? `밀린 복습은 ${S.settings.lookback}일까지 자동으로 다시 나타나요.` : `노트가 있는 복습은 끝낼 때까지, 노트 없는 복습은 ${S.settings.lookback}일까지 다시 나타나요. 안 할 것은 ‘빼기’로 지워요.`}</div>${D.dropped.map(it => `<div class="ms"><span class="dot" style="background:${h.colorOf(S, it)}"></span>${esc(h.titleOf(S, it))} <span class="muted small">${h.fmtMin(it.est)}${it.overdue ? ` · ${h.md(it.date)} 수업 · ${it.overdue}일 밀림` : ''}</span><button class="btn sm ghost right" data-action="dropskip" data-key="${esc(it.key)}" title="이 항목은 다시 띄우지 않아요">빼기</button></div>`).join('')}</div>` : ''}
      ${live && (D.done.length || works.length || (D.customDone || []).length) ? `<div class="card donelist"><h2>오늘 한 것</h2>
        ${(D.customDone || []).map(c => `<div class="r"><span class="dot" style="background:#0ea5e9"></span><span>✓ ${esc(c.title)}</span><span class="muted small">${c.actual || c.dur}분</span><button class="btn sm ghost right" data-action="undo" data-key="cu|${esc(c.id)}">되돌리기</button></div>`).join('')}
        ${D.done.map(it => `<div class="r"><span class="dot" style="background:${h.colorOf(S, it)}"></span><span>✓ ${esc(h.titleOf(S, it))}</span><span class="muted small">${it.actual}분 (예상 ${it.est}분)</span><button class="btn sm ghost right" data-action="undo" data-key="${esc(it.key)}">되돌리기</button></div>`).join('')}
        ${works.map(w => `<div class="r"><span class="dot" style="background:#6366f1"></span><span>${esc(h.jobTitleByKey(S, w.key))}</span><span class="muted small">+${w.min}분</span><button class="btn sm ghost right" data-action="undowork" data-key="${esc(w.key)}">마지막 기록 취소</button></div>`).join('')}</div>` : ''}`;

    const right = `<div class="panel"><div class="ph"><h2>${live ? '오늘' : mdw(date)} 시간표</h2></div>${h.tlTools(S, D)}
      <div class="hint">끌어서 옮기고, 아래 끝을 끌어 길이를 바꿔요 · 빈 곳을 더블클릭하면 일정 추가${live ? '' : ' · 완료 체크와 타이머는 그날이 되면 쓸 수 있어요'}</div>
      <div class="tlwrap">${h.timeline(S, D, { editable: true })}</div></div>`;

    return `<div class="split"><div class="pane-l">${left}</div><aside class="pane-r">${right}</aside></div>`;
  };

  // ---------- 액션 ----------
  const Ac = A.actions;
  A.onShow.today = () => { if (A.ui.dayJump) A.ui.dayJump = false; else A.ui.dayView = null; };   // 오늘 탭을 누르면 항상 오늘부터 (계획 탭의 ‘이 날 열기’만 예외)
  const clampDay = d => { const t = P.today(), last = A.PLAN.days[A.PLAN.days.length - 1].date; return d > last ? last : d < P.addDays(t, -MAXBACK) ? P.addDays(t, -MAXBACK) : d; };
  Ac.daynav = el => { const cur = A.ui.dayView || P.today(), d = clampDay(P.addDays(cur, +el.dataset.d)); A.ui.dayView = d === P.today() ? null : d; A.render(); };
  Ac.daytoday = () => { A.ui.dayView = null; A.render(); };
  Ac.openday = el => { A.ui.dayView = el.dataset.date === P.today() ? null : el.dataset.date; A.ui.dayJump = true; A.setTab('today'); };
  Ac.toggleRow = el => { A.ui.open = A.ui.open === el.dataset.id ? '' : el.dataset.id; A.ui.sel = el.dataset.id; A.render(); };
  Ac.timer = el => A.timerStart(el.dataset.key, el.dataset.label);

  Ac.chk = el => {
    A.S.checks[el.dataset.key + ':' + el.dataset.i] = el.checked;
    const tx = el.closest('label').querySelector('.tx');
    if (tx) tx.classList.toggle('done', el.checked);
    A.save();
  };
  Ac.taskitem = el => {
    const t = A.S.tasks.find(x => x.id === el.dataset.t);
    if (t && t.items[+el.dataset.i]) t.items[+el.dataset.i].done = el.checked;
    const tx = el.closest('label').querySelector('.tx');
    if (tx) tx.classList.toggle('done', el.checked);
    A.save();
  };
  Ac.chapter = el => A.toggleChapter(el.dataset.ex, +el.dataset.i, el.checked);

  Ac.finish = el => {
    const S = A.S, key = el.dataset.key;
    let acc = (S.acc[key] || 0);
    if (S.timer && S.timer.key === key) acc += (Date.now() - S.timer.startedAt) / 60000;
    if (acc >= 0.5) A.finishItem(key, acc);
    else { A.ui.finish = { key, mode: 'item' }; A.ui.open = key; A.render(); }
  };
  Ac.jobmore = el => { A.ui.finish = { key: el.dataset.key, mode: 'job' }; A.render(); };
  Ac.finishcancel = () => { A.ui.finish = null; A.render(); };
  Ac.finishpick = el => {
    const key = el.dataset.key;
    const m = el.dataset.min === 'custom' ? parseInt(h.val('fin-min'), 10) : parseInt(el.dataset.min, 10);
    if (!(m >= 1 && m <= 600)) { A.toast('1~600분 사이로 입력하세요', true); return; }
    const f = A.ui.finish;
    A.ui.finish = null;
    if (A.isJob(key)) A.addWork(key, m, 'tap'); else A.finishItem(key, m);
    if (f && f.mode === 'job') A.toast(`${m}분 기록했어요`);
  };
  Ac.jobdone = el => { A.addWork(el.dataset.key, parseInt(el.dataset.min, 10), 'tap'); A.toast(`${el.dataset.min}분 기록했어요`); };
  Ac.skip = el => { A.S.progress[el.dataset.key] = { skipped: true }; A.save(); A.render(); };
  Ac.dropskip = el => {
    const key = el.dataset.key, S = A.S, it = A.PLAN.days.flatMap(d => d.dropped).find(x => x.key === key);
    S.progress[key] = { skipped: true };
    A.save(); A.render();
    A.toast(`뺐어요 · ${it ? h.titleOf(S, it) : '항목'}`, false, { fn: () => { delete S.progress[key]; A.save(); A.render(); } });
  };
  Ac.undo = el => A.undoItem(el.dataset.key);
  Ac.undowork = el => A.undoWork(el.dataset.key);
  Ac.taskfinish = el => {
    const t = A.S.tasks.find(x => x.id === el.dataset.t);
    if (!t || !window.confirm(`‘${t.title}’을(를) 끝난 과제로 표시할까요?`)) return;
    t.done = true; A.save(); A.render();
  };

  // 숫자로 직접 시간 설정
  Ac.applytime = el => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(h.val('tm-s').trim());
    const dur = parseInt(h.val('tm-d'), 10);
    if (!m || +m[1] > 25 || +m[2] > 59) { A.toast('시작 시간은 HH:MM 형식으로 (예: 19:30)', true); return; }
    if (!(dur >= 5 && dur <= 480)) { A.toast('길이는 5~480분 사이로 입력하세요', true); return; }
    const D = A.PLAN.days.find(x => x.date === el.dataset.date);
    const e = D && D.entries.find(x => x.id === el.dataset.id);
    const start = Math.min(+m[1] * 60 + +m[2], P.DAY_END - dur);
    A.freezeDay(el.dataset.date);
    A.setManual(el.dataset.date, el.dataset.id, { start, dur: dur + ((e && (e.spentExam || e.spent)) || 0) });
  };
})();
