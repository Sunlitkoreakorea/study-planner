/* v_settings.js — 설정: 왼쪽에서 항목(과목 하나, 시간표, 가용 시간 …)을 고르면 오른쪽에서 정한다 */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc;
  const DAYN = ['월', '화', '수', '목', '금'];
  const row = (label, desc, ctl) => `<div class="swrow"><span class="swt"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span>${ctl}</div>`;

  A.onShow.settings = () => { A.loadFolders(); if (!A.RO) A.loadPublish(); };
  A.loadFolders = async function () {
    if (A.RO) return;
    await A.flush();
    try { A.ui.folders = (await A.api('/api/folders')).folders; } catch (e) { A.ui.folders = []; }
    if (A.ui.tab === 'settings') A.renderSoon();
  };

  function nav(S, k) {
    const item = (key, label, sub, dot) => `<button class="navi ${k === key ? 'on' : ''}" data-action="setsel" data-k="${esc(key)}">${dot ? `<i class="dot" style="background:${dot}"></i>` : ''}<span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
    return `<div class="navgroup">과목</div>
      ${S.subjects.map(s => item('subj:' + s.id, s.name, [s.review ? '복습' : '', s.preview ? '예습' : ''].filter(Boolean).join('·'), s.color)).join('')}
      <button class="navi add ${k === 'newsubj' ? 'on' : ''}" data-action="setsel" data-k="newsubj">＋ 과목 추가</button>
      <div class="navgroup">시간</div>${item('timetable', '시간표')}${item('avail', '가용 시간')}
      <div class="navgroup">계획</div>${item('rules', '계획 방식')}${item('stats', '걸린 시간 기록')}
      <div class="navgroup">기타</div>${item('look', '화면 모드')}${item('files', '폴더 · 백업')}`;
  }

  // ---------- 과목 하나 ----------
  function subject(S, id) {
    const i = S.subjects.findIndex(s => s.id === id);
    if (i < 0) return `<div class="panel empty">과목을 찾을 수 없어요.</div>`;
    const s = S.subjects[i], b = `subjects.${i}`;
    if (!s.mins) s.mins = {};
    const exam = S.exams.find(e => e.sid === id);
    const where = DAYN.map((d, di) => {
      const ps = (S.timetable[di] || []).map((x, pi) => (x === id ? pi + 1 : 0)).filter(Boolean);
      return ps.length ? `${d} ${ps.join('·')}교시` : '';
    }).filter(Boolean).join(' · ') || '시간표에 없는 과목이에요';
    const eff = k => P.effMin(S, id, k);
    const hint = (k, name) => { const e = eff(k); return e.n ? `${name}: 기록 ${e.n}개 · 중앙값 ${Math.round(e.median)}분${e.auto ? ` → 계획에 ${e.min}분 적용 중` : ' (3개부터 자동 반영)'}` : ''; };
    const folders = (A.ui.folders || []).map(f => `<option value="${esc(f)}">`).join('');
    return `<div class="panel detail">
      <div class="dh"><i class="dot big" style="background:${s.color}"></i><h2>${esc(s.name)}</h2><button class="btn sm ghost danger" data-action="delSubject" data-i="${i}">과목 삭제</button></div>
      <div class="hint">시간표: ${esc(where)}</div>

      <section class="grp"><h3>이름 · 색</h3>
        <div class="fl"><label>이름<input type="text" data-bind="${b}.name" value="${esc(s.name)}" data-render="1"></label>
          <label>시간표 약칭<input type="text" data-bind="${b}.short" value="${esc(s.short)}" style="width:7rem"></label></div>
        <div class="fl"><label>색${h.swatches(`${b}.color`, s.color)}</label></div></section>

      <section class="grp"><h3>공부 방식</h3>
        ${h.sw(`${b}.review`, s.review, '수업 후 복습', '수업이 있던 날 저녁에 복습이 생기고, 시험 대비 대상이 돼요', true)}
        ${h.sw(`${b}.preview`, s.preview, '전날 저녁 예습', '다음 날 이 수업이 있으면 전날 저녁에 예습이 나와요', true)}
        ${h.sw(`${b}.hard`, s.hard, '어려운 과목', '하루 계획에서 앞쪽(집중 잘 되는) 시간에 먼저 놓여요')}
        ${row('중요도', '시간이 모자랄 때 이 과목을 얼마나 먼저 챙길지', h.seg(`${b}.weight`, s.weight, [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 'int'))}</section>

      <section class="grp"><h3>걸리는 시간</h3>
        ${row('복습 한 번에', hint('review', '복습'), h.step(`${b}.mins.review`, s.mins.review, { step: 5, min: 5, max: 180, unit: '분', def: S.settings.minDefaults.review }))}
        ${row('예습 한 번에', hint('preview', '예습'), h.step(`${b}.mins.preview`, s.mins.preview, { step: 5, min: 5, max: 180, unit: '분', def: S.settings.minDefaults.preview }))}
        <div class="hint">비워 두면 기본값(계획 방식에서 정함)을 써요. 완료할 때 기록한 시간이 쌓이면 자동으로 보정돼요.</div></section>

      <section class="grp"><h3>시험</h3>
        ${exam ? `<div class="fl"><span>${exam.date ? h.md(exam.date) : '날짜 없음'} ${exam.confirmed ? '<span class="pill ok">확정</span>' : '<span class="pill warn">미확정</span>'} · 범위 ${exam.scope.length}단원</span>
          <button class="btn sm" data-action="gotoExam" data-id="${esc(exam.id)}">시험·과제에서 날짜·범위 정하기</button></div>`
    : `<div class="fl"><span class="muted">등록된 시험이 없어요</span><button class="btn sm" data-action="newExamFor" data-sid="${esc(id)}">시험 만들기</button></div>`}</section>

      <section class="grp"><h3>다글로 파일 · 폴더</h3>
        <div class="fl"><label>공부 폴더 이름 <small class="muted">(공부 폴더 안에서 이 과목 노트가 모이는 곳)</small>
          <input type="text" list="folders" data-bind="${b}.folder" value="${esc(s.folder)}" placeholder="폴더 이름"></label></div>
        <datalist id="folders">${folders}</datalist>
        <div class="fl"><label>파일명에 이런 말이 있으면 이 과목으로 분류 <small class="muted">(쉼표로 구분)</small>
          <input type="text" data-bind="${b}.aliases" data-type="list" value="${esc((s.aliases || []).join(', '))}"></label></div></section>
    </div>`;
  }

  function newSubject() {
    return `<div class="panel detail"><div class="dh"><h2>과목 추가</h2></div>
      <div class="fl"><label>과목 이름<input type="text" id="sb-name" placeholder="예: AP 물리"></label><button class="btn primary" data-action="addSubject">만들기</button></div>
      <div class="hint">만든 뒤에 색, 복습·예습, 시간표를 정하면 돼요.</div></div>`;
  }

  // ---------- 시간표 ----------
  function timetable(S) {
    const cellSel = (d, p) => {
      const id = (S.timetable[d] || [])[p] || '', sb = P.subj(S, id);
      return `<select class="ttsel" data-bind="timetable.${d}.${p}" data-render="1" style="background:${sb ? h.rgba(sb.color, 0.2) : 'transparent'};border-color:${sb ? sb.color : 'var(--line)'}"><option value="">-</option>${S.subjects.map(x => `<option value="${esc(x.id)}" ${x.id === id ? 'selected' : ''}>${esc(x.short || x.name)}</option>`).join('')}</select>`;
    };
    return `<div class="panel detail"><div class="dh"><h2>시간표</h2></div>
      <div class="hint">칸을 눌러 과목을 고르세요. 연강은 같은 과목을 이어서 고르면 복습이 한 번만 생겨요.</div>
      <div class="scroll"><table class="tbl tt"><thead><tr><th></th>${DAYN.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>
      ${Array.from({ length: 8 }, (_, p) => `<tr><td class="muted">${p + 1}교시</td>${DAYN.map((_, d) => `<td>${cellSel(d, p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }

  // ---------- 가용 시간 ----------
  function blocksGroup(S, key, label, sub) {
    const arr = S.settings[key];
    return `<section class="grp"><h3>${label} <small>${sub}</small></h3>${h.dayBar(arr)}
      ${arr.map((b, i) => `<div class="fl">${arr.length > 1 ? `<b class="sname">${i + 1}자습</b>` : ''}<span class="tr">${h.tsel(`settings.${key}.${i}.0`, b[0], false, { render: true })}<span>부터</span>${h.tsel(`settings.${key}.${i}.1`, b[1], true, { render: true })}<span>까지</span></span>
        <button class="x" data-action="delBlock" data-k="${key}" data-i="${i}" title="이 시간대 삭제">×</button></div>`).join('')}
      <button class="btn sm" data-action="addBlock" data-k="${key}">＋ 시간대 추가</button></section>`;
  }
  function avail(S) {
    const ovs = Object.keys(S.dayOverrides).sort();
    return `<div class="panel detail"><div class="dh"><h2>가용 시간</h2></div>
      <div class="hint">공부할 수 있는 시간대를 정하면, 계획은 이 안에서만 짜져요.</div>
      ${blocksGroup(S, 'weekdayBlocks', '평일', '월~금')}${blocksGroup(S, 'weekendBlocks', '주말', '토·일')}
      <section class="grp"><h3>특정한 날 <small>시험·귀가·행사</small></h3>
        ${ovs.length ? ovs.map(d => { const o = S.dayOverrides[d]; return `<div class="fl"><b>${h.md(d)}</b><span>${o.off ? '쉬는 날 (공부·수업 없음)' : (o.blocks || []).map(b => P.t12str(b[0]) + ' ~ ' + P.t12str(b[1])).join(', ')}</span><span class="muted small">${esc(o.note || '')}</span><button class="x right" data-action="delOverride" data-d="${d}">×</button></div>`; }).join('') : '<div class="hint">예외가 없어요.</div>'}
        <div class="fl"><label>날짜<input type="date" id="ov-date"></label><label>메모(선택)<input type="text" id="ov-note" placeholder="예: 귀가"></label></div>
        <div class="fl"><button class="btn" data-action="addOverrideOff">쉬는 날로 추가</button><span class="muted">또는 이 날만</span>
          <span class="tr">${h.tsel('', '18:30', false, { id: 'ov-s' })}<span>~</span>${h.tsel('', '24:00', true, { id: 'ov-e' })}</span><button class="btn" data-action="addOverrideTime">로 바꾸기</button></div></section>
      <section class="grp"><h3>매주 반복되는 일정 <small>그 시간은 공부 시간에서 빠져요</small></h3>
        ${S.fixed.map((f, i) => `<div class="fl fix"><input type="text" data-bind="fixed.${i}.title" value="${esc(f.title)}" style="width:10rem">
          <select data-bind="fixed.${i}.dow" data-type="int">${P.DOW.map((n, k) => `<option value="${k}" ${+f.dow === k ? 'selected' : ''}>매주 ${n}요일</option>`).join('')}</select>
          <span class="tr">${h.tsel(`fixed.${i}.start`, f.start, false, { render: true })}<span>~</span>${h.tsel(`fixed.${i}.end`, f.end, true, { render: true })}</span>
          ${P.toMin(f.start) < P.toMin(f.end) ? '' : '<span class="pill warn">시간을 골라 주세요</span>'}
          <button class="x" data-action="delFixed" data-i="${i}">×</button></div>`).join('')}
        <button class="btn sm" data-action="addFixed">＋ 반복 일정 추가</button></section></div>`;
  }

  // ---------- 계획 방식 ----------
  function rules(S) {
    const st = S.settings, sp = (path, val, o) => h.step('settings.' + path, val, o);
    return `<div class="panel detail"><div class="dh"><h2>계획 방식</h2></div>
      <section class="grp"><h3>하루 공부량</h3>
        ${h.sw('settings.reviewCapOn', !!st.reviewCapOn, '복습·예습 하루 상한', '끄면 복습·예습을 전부 넣어요 (시간이 모자라면 ‘시간 못 정함’으로 표시). 켜면 상한을 넘는 건 ‘빠진 항목’으로 빼요', true)}
        ${st.reviewCapOn ? row('복습·예습 최대', '하루에 복습과 예습에 쓸 시간의 상한', sp('reviewCapMin', st.reviewCapMin, { step: 10, min: 30, max: 600, unit: '분' })) : ''}
        ${row('가용 시간 중 채울 비율', '나머지는 여유 시간으로 남겨요', sp('planFillPct', st.planFillPct, { step: 5, min: 40, max: 100, unit: '%' }))}</section>
      <section class="grp"><h3>집중과 휴식</h3>
        ${h.sw('settings.breakOn', st.breakOn, '휴식 넣기', '집중 시간이 길어지면 다음 항목 앞에 쉬는 시간을 둬요')}
        ${row('집중 시간', '', sp('focusMin', st.focusMin, { step: 5, min: 20, max: 120, unit: '분' }))}
        ${row('휴식 시간', '', sp('breakMin', st.breakMin, { step: 5, min: 0, max: 30, unit: '분' }))}
        ${h.sw('settings.hardFirst', st.hardFirst, '어려운 과목 먼저', '과목 설정에서 ‘어려운 과목’으로 정한 것을 앞쪽 시간에 놓아요')}</section>
      <section class="grp"><h3>시험 대비</h3>
        ${row('범위 끝내는 날', '시험 며칠 전까지 범위를 끝낼지', sp('bufferDays', st.bufferDays, { step: 1, min: 1, max: 14, unit: '일 전' }))}
        ${row('직전 정리 시작', '시험 며칠 전부터 전 범위를 훑을지', sp('finalDays', st.finalDays, { step: 1, min: 1, max: 14, unit: '일 전' }))}
        ${row('하루에 함께 할 시험·과제', '많을수록 여러 과목을 조금씩 해요', sp('maxJobsPerDay', st.maxJobsPerDay, { step: 1, min: 1, max: 8, unit: '개' }))}
        ${row('단원 하나 기본 시간', '단원별 시간을 따로 안 정했을 때', sp('minDefaults.chapter', st.minDefaults.chapter, { step: 10, min: 10, max: 600, unit: '분' }))}
        ${row('시험 하나 기본 필요 시간', '범위(단원)를 입력하지 않았을 때', sp('minDefaults.exam', st.minDefaults.exam, { hours: true, step: 30, min: 30, max: 6000, unit: '시간', def: 480 }))}
        ${row('직전 정리 기본 시간', '', sp('minDefaults.final', st.minDefaults.final, { step: 10, min: 10, max: 600, unit: '분' }))}</section>
      <section class="grp"><h3>수업과 복습</h3>
        ${row('수업 마지막 날', '이 날 이후엔 복습·예습이 생기지 않아요 (기말 기간)', `<input type="date" data-bind="settings.classEnd" value="${esc(st.classEnd)}">`)}
        ${h.sw('settings.carryAll', st.carryAll !== false, '노트가 있는 복습은 끝낼 때까지 이월', '체크리스트를 등록한 복습은 끝내거나 ‘빼기’ 하기 전까지 다음 날에도 계속 나와요', true)}
        ${row('이월 기간', st.carryAll === false ? '못 한 복습을 며칠 전 수업까지 다시 띄울지' : '노트가 없는 복습(시간표 기준)을 며칠 전 수업까지 다시 띄울지', sp('lookback', st.lookback, { step: 1, min: 0, max: 7, unit: '일' }))}
        ${row('기본 복습 시간', '', sp('minDefaults.review', st.minDefaults.review, { step: 5, min: 5, max: 180, unit: '분' }))}
        ${row('기본 예습 시간', '', sp('minDefaults.preview', st.minDefaults.preview, { step: 5, min: 5, max: 180, unit: '분' }))}
        ${h.sw('settings.autoAvg', st.autoAvg, '걸린 시간 자동 반영', '기록이 3개 이상 쌓이면 실제로 걸린 시간(중앙값)을 예상 시간에 반영해요')}
        ${row('기록 시작일', '이 날부터의 수업만 복습으로 잡아요', `<input type="date" data-bind="settings.startDate" value="${esc(st.startDate)}">`)}</section></div>`;
  }

  // ---------- 통계 ----------
  function stats(S) {
    const st = P.stats(S);
    return `<div class="panel detail"><div class="dh"><h2>걸린 시간 기록</h2></div>
      <div class="hint">완료할 때 적은 시간이 쌓이면 중앙값으로 예상 시간을 보정해요 (기록 3개부터). 지금까지 기록 ${st.nlog}개${st.ratio != null ? ` · 예상 대비 실제 ${Math.round(st.ratio * 100)}%` : ''}</div>
      <div class="scroll"><table class="tbl"><thead><tr><th>과목</th><th>종류</th><th>기록</th><th>중앙값</th><th>내가 정한 값</th><th>계획에 쓰는 값</th><th></th></tr></thead><tbody>
      ${st.rows.map(r => `<tr><td>${esc(r.sb.name)}</td><td>${r.kind === 'review' ? '복습' : '예습'}</td><td>${r.n}개</td><td>${r.n ? Math.round(r.median) + '분' : '-'}</td><td>${r.manual}분</td>
        <td><b>${r.min}분</b> ${r.auto ? '<span class="pill ok">자동</span>' : ''}</td>
        <td>${r.n >= 3 && r.min !== r.manual ? `<button class="btn sm" data-action="applyAvg" data-sid="${esc(r.sb.id)}" data-kind="${r.kind}" data-min="${r.min}">내 값으로 저장</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function look(S) {
    const cur = ['light', 'dark'].includes(S.settings.theme) ? S.settings.theme : 'system';
    const opt = (v, n) => `<button type="button" class="${cur === v ? 'on' : ''}" data-action="settheme" data-val="${v}">${n}</button>`;
    return `<div class="panel detail"><div class="dh"><h2>화면 모드</h2></div>
      <section class="grp"><h3>밝기</h3>
        <div class="fl"><span class="segb">${opt('system', '자동')}${opt('light', '라이트')}${opt('dark', '다크')}</span></div>
        <div class="hint">자동은 Windows의 화면 모드(설정 → 개인 설정 → 색)를 따라가요. 위쪽 오른쪽 끝의 버튼으로도 바로 바꿀 수 있어요.</div></section></div>`;
  }

  // ---------- GitHub 로 올리기 (보기 전용 사이트) ----------
  A.loadPublish = async function () {
    try { A.ui.pub = Object.assign({}, A.ui.pub, await A.api('/api/publish')); } catch (e) { A.ui.pub = Object.assign({}, A.ui.pub, { error: e.message }); }
    if (A.ui.tab === 'settings') A.renderSoon();
  };
  const stamp = iso => (iso ? h.fmtStamp(iso) : '아직 없음');
  function publishSection() {
    const p = A.ui.pub || {};
    if (A.RO) return '';
    if (!p.ready) return `<section class="grp"><h3>GitHub로 올리기 <small>폰·다른 PC에서 보기 전용으로 열어요</small></h3><div class="hint">${p.error ? esc(p.error) : '아직 처음 설정을 안 했어요. Claude에게 ‘GitHub에 올려줘’라고 한 번 말하면 공개 사이트가 만들어지고, 이후에는 여기서 버튼 하나로 올릴 수 있어요.'}</div></section>`;
    return `<section class="grp"><h3>GitHub로 올리기 <small>폰·다른 PC에서 보기 전용으로 열어요</small></h3>
      <div class="hint">주소: <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a> · 저장소 ${esc(p.repo)} (공개) · 마지막 업데이트 ${esc(stamp(p.lastPublished))}</div>
      <div class="fl"><button class="btn primary" data-action="publishNow" ${p.busy ? 'disabled' : ''}>${p.busy ? '올리는 중…' : '지금 올리기'}</button></div>
      ${p.msg ? `<div class="note ${p.ok === false ? 'warn' : 'info'}">${esc(p.msg)}</div>` : ''}
      <div class="hint">올린 시점의 일정·노트가 공개돼요 (내 PC 폴더 경로는 빠져요). 사이트에서는 고쳐도 저장되지 않아요.</div></section>`;
  }

  function files(S) {
    const st = S.settings;
    return `<div class="panel detail"><div class="dh"><h2>폴더 · 백업</h2></div>
      <section class="grp"><h3>폴더</h3>
        <div class="fl"><label class="wide">공부 폴더 <small class="muted">(과목별 폴더가 들어 있는 곳)</small><input type="text" data-bind="settings.studyRoot" value="${esc(st.studyRoot)}"></label></div>
        <div class="fl"><label class="wide">다글로 파일이 내려받아지는 폴더<input type="text" data-bind="settings.inbox" value="${esc(st.inbox)}"></label></div></section>
      ${publishSection()}
      <section class="grp"><h3>백업</h3>
        <div class="fl"><button class="btn" data-action="openPath" data-path="${esc(A.ENV.dataDir || '')}">데이터 폴더 열기</button><button class="btn" data-action="exportState">백업 파일 내려받기</button></div>
        <div class="hint">데이터는 ${esc(A.ENV.dataDir || '')}\\state.json 에 저장돼요. data\\backups 에 30분 간격으로 최대 30개가 자동 보관돼요.</div></section></div>`;
  }

  A.views.settings = function (S) {
    let k = A.ui.set;
    if (!k || (k.startsWith('subj:') && !P.subj(S, k.slice(5)))) k = S.subjects[0] ? 'subj:' + S.subjects[0].id : 'timetable';
    let body;
    if (k.startsWith('subj:')) body = subject(S, k.slice(5));
    else body = ({ newsubj: newSubject, timetable, avail, rules, stats, look, files }[k] || timetable)(S);
    return `<div class="md"><nav class="navlist">${nav(S, k)}</nav><section class="mdmain">${body}</section></div>`;
  };

  // ---------- 액션 ----------
  const Ac = A.actions;
  Ac.publishNow = async () => {
    A.ui.pub = Object.assign({}, A.ui.pub, { busy: true, msg: '' }); A.render();
    try {
      await A.flush();
      const r = await A.api('/api/publish', {});
      A.ui.pub = Object.assign({}, A.ui.pub, { busy: false, ok: r.ok, msg: r.message });
      if (r.ok) A.toast(r.changed ? '올렸어요. 1~2분 뒤 사이트에 반영돼요' : '바뀐 게 없어요');
    } catch (e) { A.ui.pub = Object.assign({}, A.ui.pub, { busy: false, ok: false, msg: e.message }); }
    A.loadPublish();
  };
  Ac.setsel = el => { A.ui.set = el.dataset.k; A.render(); window.scrollTo(0, 0); };
  Ac.addSubject = () => {
    const name = h.val('sb-name').trim();
    if (!name) { A.toast('과목 이름을 입력하세요', true); return; }
    const n = A.S.subjects.length, id = 's_' + P.uid();
    A.S.subjects.push({ id, short: name.slice(0, 5), name, folder: name, aliases: [name], review: false, preview: false, weight: 3, hard: false, mins: {}, color: P.COLORS[n % P.COLORS.length] });
    A.ui.set = 'subj:' + id;
    A.save(); A.render();
  };
  Ac.delSubject = el => {
    const s = A.S.subjects[+el.dataset.i];
    if (!s) return;
    if (A.S.timetable.some(r => r.includes(s.id)) || A.S.exams.some(e => e.sid === s.id)) { A.toast('시간표나 시험에서 쓰는 과목이에요. 먼저 거기서 빼세요.', true); return; }
    if (!window.confirm(`‘${s.name}’ 과목을 삭제할까요?`)) return;
    A.S.subjects.splice(+el.dataset.i, 1); A.ui.set = null; A.save(); A.render();
  };
  Ac.addBlock = el => { A.S.settings[el.dataset.k].push(['19:00', '21:00']); A.save(); A.render(); };
  Ac.delBlock = el => { A.S.settings[el.dataset.k].splice(+el.dataset.i, 1); A.save(); A.render(); };

  Ac.addOverrideOff = () => {
    const date = h.val('ov-date');
    if (!date) { A.toast('날짜를 선택하세요', true); return; }
    A.S.dayOverrides[date] = { off: true, note: h.val('ov-note').trim() };
    A.save(); A.render();
  };
  Ac.addOverrideTime = () => {
    const date = h.val('ov-date'), s = h.val('ov-s'), e = h.val('ov-e');
    if (!date) { A.toast('날짜를 선택하세요', true); return; }
    if (!(P.toMin(s) < P.toMin(e))) { A.toast('끝 시간이 시작보다 늦어야 해요', true); return; }
    A.S.dayOverrides[date] = { off: false, blocks: [[s, e]], note: h.val('ov-note').trim() };
    A.save(); A.render();
  };
  Ac.delOverride = el => { delete A.S.dayOverrides[el.dataset.d]; A.save(); A.render(); };
  Ac.addFixed = () => { A.S.fixed.push({ id: P.uid(), title: '새 일정', dow: 1, start: '', end: '' }); A.save(); A.render(); };
  Ac.delFixed = el => { A.S.fixed.splice(+el.dataset.i, 1); A.save(); A.render(); };

  Ac.applyAvg = el => {
    const sb = P.subj(A.S, el.dataset.sid);
    if (!sb) return;
    sb.mins = sb.mins || {};
    sb.mins[el.dataset.kind] = parseInt(el.dataset.min, 10);
    A.save(); A.render(); A.toast('내 값으로 저장했어요');
  };
  Ac.exportState = () => {
    const blob = new Blob([JSON.stringify(A.S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planner-backup-${P.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  Ac.gotoExam = el => { A.ui.workSel = 'exam:' + el.dataset.id; A.setTab('work'); };
  Ac.newExamFor = el => {
    const sid = el.dataset.sid, id = 'e_' + sid;
    if (!A.S.exams.some(e => e.id === id)) A.S.exams.push({ id, sid, date: '', confirmed: false, scope: [], budgetMin: A.S.settings.minDefaults.exam, finalMin: A.S.settings.minDefaults.final, partial: 0, finalSpent: 0, finalDone: false });
    A.ui.workSel = 'exam:' + id; A.save(); A.setTab('work');
  };
})();
