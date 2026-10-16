/* v_notes.js — 노트 탭: 프롬프트 복사 → 답변 붙여넣기 → 체크리스트 등록, 다글로 파일 정리, 노트 모음 */
(function () {
  'use strict';
  const A = window.App, P = window.Planner, Pr = window.NoteParser, h = A.h, esc = h.esc;

  A.onShow.notes = () => { A.loadInbox(); A.loadImports(); };

  const subjOpts = (S, sel) => `<option value="">— 과목 선택 —</option>` + S.subjects.map(s => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

  function prompts() {
    const pr = A.ui.prompts || {};
    return `<section class="card"><h2>① 프롬프트 복사</h2>
      <div class="hint">다글로 txt 파일과 함께 이 프롬프트를 Claude에게 보내세요. Claude가 양식에 맞춰 출력하면 ②에 붙여넣으면 돼요. (Claude Code에서 파일 경로와 함께 보내면 결과를 <code>${esc((A.ENV.dataDir || 'data') + '\\imports')}</code> 폴더에 파일로 바로 저장해 주는 방법도 있어요 → ③에 자동으로 떠요.)</div>
      <div class="grid2">
        <div><b>복습 노트</b> <span class="muted small">수업 1개 → 요약·체크리스트</span><pre class="prompt">${esc(pr.note || '(프롬프트 파일을 찾을 수 없어요)')}</pre><button class="btn primary" data-action="copyPrompt" data-k="note">복습노트 프롬프트 복사</button></div>
        <div><b>대회·과제</b> <span class="muted small">공지문 → 할 일·예상 시간</span><pre class="prompt">${esc(pr.task || '(프롬프트 파일을 찾을 수 없어요)')}</pre><button class="btn primary" data-action="copyPrompt" data-k="task">할일 프롬프트 복사</button></div>
      </div></section>`;
  }

  function preview(S) {
    const p = A.ui.imp.parsed;
    if (!p) return '';
    const warn = p.warnings.length ? `<div class="note warn">${p.warnings.map(esc).join('<br>')}</div>` : '';
    if (p.type === 'note') {
      const sid = A.ui.imp.sid != null ? A.ui.imp.sid : Pr.matchSubject(S.subjects, p.subject);
      const date = A.ui.imp.date != null ? A.ui.imp.date : p.date;
      const exist = sid && date && S.lessons[date + '|' + sid] && S.lessons[date + '|' + sid].note;
      return `<div class="card" style="background:var(--bg)"><b>복습노트로 인식했어요</b> ${warn}
        <div class="form"><label>과목 <select id="imp-sid" data-bind="ui.imp.sid" data-render="1">${subjOpts(S, sid)}</select></label><label>수업 날짜 <input type="date" id="imp-date" data-bind="ui.imp.date" data-render="1" value="${esc(date)}"></label>
        <span class="muted small">요약 ${p.summary.length} · 핵심 개념 ${p.concepts.length} · 체크리스트 ${p.items.length} · 헷갈린 부분 ${p.questions.length} · 예습 ${p.preview.length}</span></div>
        ${exist ? `<div class="note info">이 날짜·과목에는 이미 노트가 있어요 (체크 ${exist.items.length}개). 새 내용은 <b>기존 노트 뒤에 추가</b>되고, 똑같은 항목은 건너뛰어요. 기존 체크 표시는 그대로 남아요.</div>` : ''}
        <ul class="chk">${p.items.map(it => `<li><span class="tag">${esc(it.tag || '·')}</span> ${esc(it.text)} ${it.min != null ? `<small class="muted">${it.min}분</small>` : ''}</li>`).join('')}</ul>
        <button class="btn primary" data-action="applyImport">${exist ? '노트에 추가' : '체크리스트에 등록'}</button></div>`;
    }
    return `<div class="card" style="background:var(--bg)"><b>대회·과제로 인식했어요</b> ${warn}
      <div class="form"><input type="text" id="imp-title" value="${esc(p.title)}" placeholder="이름" style="min-width:200px">
        <label>마감 <input type="date" id="imp-due" value="${esc(p.due)}"></label>
        <label>총 <input type="number" id="imp-hours" min="0.5" step="0.5" value="${p.totalMin ? p.totalMin / 60 : ''}"> 시간</label>
        <span class="muted small">중요도 ${['', '하', '중', '상'][p.priority]} · ${p.splittable ? '나눠서 가능' : '몰아서'} · 세부 ${p.items.length}개</span></div>
      <ul class="chk">${p.items.map(it => `<li>${esc(it.text)} ${it.min != null ? `<small class="muted">${it.min}분</small>` : ''}</li>`).join('')}</ul>
      <button class="btn primary" data-action="applyImport">대회·과제로 등록</button></div>`;
  }

  function importer(S) {
    const im = A.ui.imports;
    return `<section class="card"><h2>② 답변 붙여넣기</h2>
      <textarea id="imp-text" rows="9" placeholder="=== 복습노트 === 또는 === 할일 === 로 시작하는 Claude의 답변을 여기에 붙여넣으세요">${esc(A.ui.imp.text)}</textarea>
      <div class="form"><button class="btn primary" data-action="parse">읽기</button><button class="btn ghost" data-action="clearImp">비우기</button></div>
      ${preview(S)}
      ${im && im.files && im.files.length ? `<h3>③ imports 폴더에 도착한 파일 (${im.files.length})</h3>${im.files.map((f, i) => `<div class="ms"><b style="min-width:0">${esc(f.name)}</b><span class="muted small">${esc(f.text.replace(/\s+/g, ' ').slice(0, 70))}…</span><button class="btn sm right" data-action="loadImportFile" data-i="${i}">불러오기</button><button class="x" data-action="archiveImport" data-i="${i}" title="보관함으로 이동">×</button></div>`).join('')}` : ''}
    </section>`;
  }

  function inbox(S) {
    const ib = A.ui.inbox;
    if (!ib) return `<section class="card"><h2>다글로 파일 정리</h2><div class="hint">불러오는 중…</div></section>`;
    return `<section class="card"><h2>다글로 파일 정리</h2>
      <div class="hint">‘${esc(ib.inbox || '(폴더 미지정)')}’ 안의 <code>날짜. 과목.txt</code> 형태 파일을 과목 폴더로 옮겨요. 이름이 같은 파일이 있으면 덮어쓰지 않고 번호를 붙여요. 옮기기 전에는 아무것도 건드리지 않아요.</div>
      ${ib.error ? `<div class="note warn">${esc(ib.error)}</div>` : ''}
      ${ib.files.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>파일</th><th>날짜</th><th>과목</th><th></th></tr></thead><tbody>
        ${ib.files.slice(0, 60).map((f, i) => `<tr><td>${esc(f.name)}<div class="muted small">${Math.round(f.size / 1024)}KB</div></td><td>${h.md(f.date)}</td>
          <td><select id="ib-sid-${i}">${subjOpts(S, f.sid)}</select></td><td><button class="btn sm" data-action="moveFile" data-i="${i}">옮기기</button></td></tr>`).join('')}</tbody></table></div>
        ${ib.files.length > 60 ? `<div class="hint">최근 60개만 보여요 (전체 ${ib.files.length}개)</div>` : ''}` : '<div class="hint">옮길 파일이 없어요.</div>'}
      <div class="form"><button class="btn sm" data-action="reloadInbox">새로고침</button></div></section>`;
  }

  function lessons(S) {
    const keys = Object.keys(S.lessons).filter(k => S.lessons[k].note).sort().reverse();
    if (!keys.length) return `<section class="card"><h2>저장된 노트</h2><div class="hint">아직 등록된 노트가 없어요.</div></section>`;
    return `<section class="card"><h2>저장된 노트 (${keys.length})</h2>${keys.map(k => {
      const [d, sid] = [k.slice(0, 10), k.slice(11)], L = S.lessons[k], n = L.note, sb = P.subj(S, sid), open = A.ui.openLesson === k;
      return `<div class="ms" style="flex-wrap:wrap"><b style="min-width:100px">${h.md(d)}</b><span class="dot" style="background:${sb ? sb.color : '#999'}"></span><span>${esc(sb ? sb.name : sid)}</span>
        <span class="muted small">체크 ${n.items.length} · 개념 ${n.concepts.length}${n.preview.length ? ' · 예습 ' + n.preview.length : ''}</span>
        <button class="btn sm right" data-action="openLesson" data-k="${esc(k)}">${open ? '접기' : '열기'}</button>
        <button class="x" data-action="delLesson" data-k="${esc(k)}" title="삭제">×</button></div>
        ${open ? `<div style="padding:4px 0 10px 8px">${[['요약', n.summary], ['핵심 개념', n.concepts], ['헷갈린 부분', n.questions]].filter(x => x[1].length).map(([t, a]) => `<details open><summary>${t}</summary><ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}
          ${n.items.length ? `<details open><summary>복습 체크리스트</summary><ul>${n.items.map(i => `<li>${i.tag ? `[${esc(i.tag)}] ` : ''}${esc(i.text)}${i.min != null ? ` (${i.min}분)` : ''}</li>`).join('')}</ul></details>` : ''}
          ${n.preview.length ? `<details open><summary>예습 체크리스트</summary><ul>${n.preview.map(i => `<li>${esc(i.text)}${i.min != null ? ` (${i.min}분)` : ''}</li>`).join('')}</ul></details>` : ''}
          ${L.file ? `<button class="btn sm" data-action="openPath" data-path="${esc(L.file)}">원문 파일 열기</button>` : ''}</div>` : ''}`;
    }).join('')}</section>`;
  }

  A.views.notes = S => `<div class="single">${prompts() + importer(S) + inbox(S) + lessons(S)}</div>`;

  // ---------- 액션 ----------
  const Ac = A.actions;
  Ac.copyPrompt = async el => {
    const t = (A.ui.prompts || {})[el.dataset.k] || '';
    A.toast((await h.copy(t)) ? '프롬프트를 복사했어요. Claude에게 파일과 함께 붙여넣으세요.' : '복사에 실패했어요. 직접 선택해서 복사하세요.', false);
  };
  Ac.clearImp = () => { A.ui.imp = { text: '', parsed: null }; A.render(); };
  function doParse(text) {
    A.ui.imp.text = text;
    const r = Pr.parse(text, new Date());
    if (!r) { A.ui.imp.parsed = null; A.render(); A.toast('양식을 인식하지 못했어요. “=== 복습노트 ===” 또는 “=== 할일 ===”로 시작해야 해요.', true); return; }
    A.ui.imp.parsed = r;
    A.ui.imp.sid = r.type === 'note' ? Pr.matchSubject(A.S.subjects, r.subject) : null;
    A.ui.imp.date = r.type === 'note' ? r.date : null;
    A.render();
  }
  Ac.parse = () => doParse(h.val('imp-text'));
  Ac.applyImport = () => {
    const S = A.S, p = A.ui.imp.parsed;
    if (!p) return;
    if (p.type === 'note') {
      const sid = h.val('imp-sid'), date = h.val('imp-date');
      if (!sid || !date) { A.toast('과목과 수업 날짜를 확인하세요', true); return; }
      const key = date + '|' + sid;
      const old = S.lessons[key], had = !!(old && old.note);
      const m = P.mergeNote(had ? old.note : null, p);
      if (had && !m.addedAny) { A.toast('이미 등록된 내용이에요. 새로 추가된 항목이 없어요.', true); return; }
      S.lessons[key] = Object.assign(old || {}, { importedAt: Date.now(), note: m.note });   // 기존 항목 뒤에 덧붙이므로 체크 표시는 그대로 유지
      // 이미 끝냈거나 ‘안 할래요’ 했던 복습이라도 새 항목이 붙었으면 다시 연다
      const rk = `rev|${date}|${sid}`, pg = S.progress[rk];
      let reopened = false;
      if (had && pg && (pg.done || pg.skipped)) { reopened = true; if (pg.skipped) delete S.progress[rk]; else { delete pg.done; delete pg.doneDate; } }
      A.ui.imp = { text: '', parsed: null };
      A.save(); A.render();
      const today = P.today(), age = P.diffDays(date, today);
      const shown = age >= 0 && age <= P.carryDays(S, today);
      A.toast(had ? `기존 노트에 추가했어요 (체크 ${m.added}개 추가${reopened ? ' · 복습을 다시 열었어요' : ''})` : shown ? '등록했어요. 오늘 탭의 복습에 반영됐어요.' : '노트를 저장했어요. (복습 기간이 지난 날짜라 오늘 목록엔 안 나와요)');
    } else {
      const title = h.val('imp-title').trim(), due = h.val('imp-due'), hours = parseFloat(h.val('imp-hours'));
      if (!title || !(hours > 0)) { A.toast('이름과 예상 시간을 확인하세요', true); return; }
      const total = Math.round(hours * 60);
      S.tasks.push({
        id: P.uid(), title, due, totalMin: total, spent: 0, priority: p.priority, sid: '',
        minChunk: p.splittable ? 30 : Math.min(total, 180), maxPerDay: p.splittable ? 180 : Math.min(total, 240),
        items: p.items.map(i => ({ text: i.text, min: i.min, done: false })), done: false
      });
      A.ui.imp = { text: '', parsed: null };
      A.save(); A.render();
      A.toast('대회·과제로 등록했어요. 계획 탭에서 확인하세요.');
    }
  };

  Ac.loadImportFile = el => {
    const f = A.ui.imports.files[+el.dataset.i];
    if (!f) return;
    doParse(f.text);
  };
  Ac.archiveImport = async el => {
    const f = A.ui.imports.files[+el.dataset.i];
    if (!f) return;
    try { await A.api('/api/imports/archive', { name: f.name }); A.loadImports(); } catch (e) { A.toast(e.message, true); }
  };

  Ac.reloadInbox = () => { A.ui.inbox = null; A.render(); A.loadInbox(); };
  Ac.moveFile = async el => {
    const i = +el.dataset.i, f = A.ui.inbox.files[i];
    const sid = h.val('ib-sid-' + i);
    if (!f || !sid) { A.toast('과목을 선택하세요', true); return; }
    try {
      await A.flush();
      const r = await A.api('/api/move', { src: f.path, sid });
      const key = f.date + '|' + sid;
      A.S.lessons[key] = Object.assign(A.S.lessons[key] || {}, { file: r.path });
      A.save();
      A.toast('옮겼어요 → ' + r.path.split('\\').slice(-2).join('\\'));
      A.loadInbox();
    } catch (e) { A.toast(e.message, true); }
  };

  Ac.openLesson = el => { A.ui.openLesson = A.ui.openLesson === el.dataset.k ? '' : el.dataset.k; A.render(); };
  Ac.delLesson = el => {
    if (!window.confirm('이 노트를 삭제할까요? (원문 파일은 그대로예요)')) return;
    const k = el.dataset.k;
    delete A.S.lessons[k];
    A.save(); A.render();
  };
  Ac.openPath = async el => { try { await A.api('/api/open', { path: el.dataset.path }); } catch (e) { A.toast(e.message, true); } };
})();
