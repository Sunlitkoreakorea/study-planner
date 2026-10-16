/* widgets.js — 설정/시험·과제 화면에서 쉽게 값을 정하는 공용 위젯 (스위치, ± 스테퍼, 선택 버튼, 색 고르기, 시간 선택) */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, h = A.h, esc = h.esc;

  // 켜고 끄는 스위치 한 줄 (제목 + 설명)
  h.sw = (path, on, label, desc, rerender) =>
    `<label class="swrow"><span class="swt"><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ''}</span>
      <span class="sw"><input type="checkbox" data-bind="${path}" ${rerender ? 'data-render="1"' : ''} ${on ? 'checked' : ''}><i></i></span></label>`;

  // 숫자 − 값 +  (o: step, min, max, unit, def(비어 있을 때 기본값), hours(저장은 분, 표시는 시간))
  h.step = (path, val, o) => {
    o = o || {};
    const step = o.step || (o.hours ? 30 : 5), min = o.min != null ? o.min : 0, max = o.max != null ? o.max : 99999;
    const show = val == null ? '' : (o.hours ? Math.round(val / 6) / 10 : val);
    const btn = (d, t) => `<button type="button" data-action="step" data-path="${path}" data-d="${d}" data-min="${min}" data-max="${max}" data-def="${o.def != null ? o.def : ''}">${t}</button>`;
    return `<span class="stp">${btn(-step, '−')}<input type="number" data-bind="${path}" data-render="1" data-type="${o.hours ? 'hours' : 'int'}" value="${show}" placeholder="${o.def != null ? (o.hours ? o.def / 60 : o.def) : ''}" step="${o.hours ? 0.5 : step}"><em>${o.unit || ''}</em>${btn(step, '＋')}</span>`;
  };

  // 선택 버튼 묶음 (options: [[값, 라벨], ...])
  h.seg = (path, val, options, type) =>
    `<span class="segb">${options.map(([v, n]) => `<button type="button" class="${String(val) === String(v) ? 'on' : ''}" data-action="setval" data-path="${path}" data-val="${esc(v)}" data-type="${type || 'str'}">${esc(n)}</button>`).join('')}</span>`;

  h.swatches = (path, val) =>
    `<span class="swatches">${P.COLORS.map(c => `<button type="button" class="${c === val ? 'on' : ''}" style="background:${c}" data-action="setval" data-path="${path}" data-val="${c}" title="${c}"></button>`).join('')}</span>`;

  // 15분 단위 시간 목록 (다음날 새벽 2시=26:00 까지 고를 수 있다). opt: { render: 바꾸면 화면 갱신, id: 상태와 연결하지 않고 id로만 읽기 }
  h.tsel = (path, val, isEnd, opt) => {
    opt = opt || {};
    const opts = [];
    for (let m = isEnd ? 15 : 0; m <= (isEnd ? P.DAY_END : P.DAY_END - 15); m += 15) opts.push(P.hm(m));
    if (val && !opts.includes(val)) { opts.push(val); opts.sort(); }
    const attr = opt.id ? `id="${opt.id}"` : `data-bind="${path}" ${opt.render || opt.tmin ? 'data-render="1"' : ''} ${opt.tmin ? 'data-type="tmin"' : ''}`;
    return `<select class="tsel" ${attr}>${val && !opt.none ? '' : `<option value="" ${val ? '' : 'selected'}>${opt.none || '시간 선택'}</option>`}${opts.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o === '24:00' ? '12:00 AM (자정)' : P.toMin(o) > 1440 ? P.t12str(o) + ' (다음날)' : P.t12str(o)}</option>`).join('')}</select>`;
  };

  // 하루(0~24시) 막대: 가용 시간대를 한눈에
  h.dayBar = blocks => `<div class="daybar">${blocks.map(([a, b]) => {
    const s = P.toMin(a), e = P.toMin(b);
    return e > s ? `<i style="left:${s / (P.DAY_END / 100)}%;width:${(e - s) / (P.DAY_END / 100)}%" title="${a}~${b}"></i>` : '';
  }).join('')}<span style="left:23%">6 AM</span><span style="left:46%">12 PM</span><span style="left:69%">6 PM</span><span style="left:92%">12 AM</span></div>`;

  // ---------- 액션 ----------
  const Ac = A.actions;
  const rootOf = path => (path.startsWith('ui.') ? A : A.S);
  Ac.step = el => {
    const path = el.dataset.path, root = rootOf(path);
    let cur = A.getPath(root, path);
    if (cur == null || isNaN(cur)) cur = parseFloat(el.dataset.def);
    if (isNaN(cur)) cur = 0;
    const v = Math.max(+el.dataset.min, Math.min(+el.dataset.max, cur + parseFloat(el.dataset.d)));
    A.setPath(root, path, v);
    if (root === A.S) A.save();
    A.render();
  };
  Ac.setval = el => {
    const path = el.dataset.path, root = rootOf(path), t = el.dataset.type;
    const v = t === 'int' ? parseInt(el.dataset.val, 10) : el.dataset.val;
    A.setPath(root, path, v);
    if (root === A.S) A.save();
    A.render();
  };
})();
