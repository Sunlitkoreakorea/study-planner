/* 노트 양식 파서 — Claude가 출력한 `=== 복습노트 ===` / `=== 할일 ===` 텍스트를 구조화한다.
 * 양식이 조금 어긋나도(코드블록, 전각 콜론, 번호 목록 등) 최대한 읽도록 너그럽게 작성.
 */
(function (root) {
  'use strict';
  const Pr = {};
  const pad = n => String(n).padStart(2, '0');

  Pr.normDate = function (s, ref) {
    if (!s) return '';
    s = String(s).trim();
    let m = s.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/(\d{1,2})\s*[/월.\-]\s*(\d{1,2})\s*일?/);
    if (m) return `${(ref || new Date()).getFullYear()}-${pad(m[1])}-${pad(m[2])}`;
    return '';
  };

  // "1시간 30분", "45분", "1.5h" → 분. 인식 못 하면 null
  Pr.duration = function (s) {
    if (s == null) return null;
    s = String(s);
    let min = 0, found = false;
    const h = s.match(/(\d+(?:\.\d+)?)\s*(?:시간|hours?|hr|h)(?![a-z])/i);
    if (h) { min += parseFloat(h[1]) * 60; found = true; }
    const m = s.match(/(\d+(?:\.\d+)?)\s*(?:분|min|m)(?![a-z])/i);
    if (m) { min += parseFloat(m[1]); found = true; }
    return found ? Math.round(min) : null;
  };

  function stripFence(text) {
    return String(text).replace(/\r/g, '').replace(/^﻿/, '')
      .split('\n').filter(l => !/^\s*```/.test(l)).join('\n');
  }

  function extractBlock(text, name) {
    const m = new RegExp('={2,}\\s*' + name + '\\s*={2,}').exec(text);
    if (!m) return null;
    const rest = text.slice(m.index + m[0].length);
    const e = /={2,}\s*끝\s*={2,}/.exec(rest);
    return e ? rest.slice(0, e.index) : rest;
  }

  function parseHeader(lines) {
    const h = {};
    for (const l of lines) {
      const m = l.match(/^\s*[-*]?\s*([가-힣A-Za-z ]{1,10})\s*[:：]\s*(.*)$/);
      if (m) h[m[1].replace(/\s+/g, '')] = m[2].trim();
    }
    return h;
  }

  function plain(l) {
    return l.trim().replace(/^(?:[-*•·]|\d+[.)])\s*/, '').replace(/^\[( |x|X|✓|✔)\]\s*/, '').trim();
  }

  function parseItem(raw) {
    let t = plain(raw), tag = '', min = null, m;
    m = t.match(/^\[([^\]\[]{1,8})\]\s*/);
    if (m) { tag = m[1].trim(); t = t.slice(m[0].length); }
    else {
      m = t.match(/^(개념|암기|문제|이해|심화|정리|풀이|서술)\s*[:：]\s*/);
      if (m) { tag = m[1]; t = t.slice(m[0].length); }
    }
    m = t.match(/\s*[(（]([^()（）]{1,14})[)）]\s*$/);
    if (m) {
      const d = Pr.duration(m[1]);
      if (d != null) { min = d; t = t.slice(0, m.index).trim(); }
    }
    if (min == null) {
      m = t.match(/\s+[~약]?\s*(\d+)\s*분\s*$/);
      if (m) { min = +m[1]; t = t.slice(0, m.index).trim(); }
    }
    return { text: t.trim(), tag, min };
  }

  function sectionKey(title) {
    const t = title.replace(/\s+/g, '');
    if (/예습/.test(t)) return 'preview';
    if (/헷갈|질문|확인|약점|모르/.test(t)) return 'questions';
    if (/체크|할일|복습/.test(t)) return 'items';
    if (/핵심|개념|용어|키워드/.test(t)) return 'concepts';
    if (/요약|정리|내용|개요/.test(t)) return 'summary';
    if (/세부|단계|작업/.test(t)) return 'items';
    return 'other';
  }

  const isNone = s => /^\(?\s*없음\s*\)?\.?$/.test(s);
  const headingOf = l => {
    const m = l.match(/^\s*#{1,4}\s+(.*)$/) || l.match(/^\s*\*\*([^*]+)\*\*\s*$/);
    return m ? m[1] : null;
  };

  Pr.detect = function (text) {
    const t = String(text || '');
    if (/={2,}\s*할\s*일\s*={2,}/.test(t)) return 'task';
    if (/={2,}\s*복습\s*노트\s*={2,}/.test(t)) return 'note';
    if (/^\s*#{1,4}\s*.*(체크리스트|요약)/m.test(t) && /\[[ xX]\]/.test(t)) return 'note';
    return null;
  };

  Pr.parseNote = function (raw, ref) {
    const text = stripFence(raw);
    let body = extractBlock(text, '복습\\s*노트');
    if (body == null) body = text;
    const lines = body.split('\n');
    const warnings = [];
    let i = 0;
    const head = [];
    for (; i < lines.length; i++) { if (headingOf(lines[i]) != null) break; head.push(lines[i]); }
    const hd = parseHeader(head);
    const res = {
      type: 'note', subject: hd['과목'] || '', date: Pr.normDate(hd['날짜'] || '', ref),
      priority: hd['우선순위'] || '', summary: [], concepts: [], items: [], questions: [], preview: [], warnings
    };
    let key = null;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim()) continue;
      const hh = headingOf(l);
      if (hh != null) { key = sectionKey(hh); continue; }
      if (!key || key === 'other') continue;
      if (key === 'items' || key === 'preview') {
        const it = parseItem(l);
        if (it.text && !isNone(it.text)) res[key].push(it);
      } else {
        const t = plain(l);
        if (t && !isNone(t)) res[key].push(t);
      }
    }
    if (!res.subject) warnings.push('과목을 찾지 못했어요. 아래에서 직접 고르세요.');
    if (!res.date) warnings.push('날짜를 찾지 못했어요. 아래에서 직접 입력하세요.');
    if (!res.items.length) warnings.push('복습 체크리스트 항목이 없어요.');
    if (!res.summary.length && !res.concepts.length && !res.items.length) warnings.push('내용을 거의 읽지 못했어요. 양식을 확인하세요.');
    return res;
  };

  function priorityOf(s) {
    s = String(s || '').trim();
    if (/^(상|높|high|3)/i.test(s)) return 3;
    if (/^(하|낮|low|1)/i.test(s)) return 1;
    return 2;
  }

  Pr.parseTask = function (raw, ref) {
    const text = stripFence(raw);
    let body = extractBlock(text, '할\\s*일');
    if (body == null) body = text;
    const lines = body.split('\n');
    const warnings = [];
    let i = 0;
    const head = [];
    for (; i < lines.length; i++) { if (headingOf(lines[i]) != null) break; head.push(lines[i]); }
    const hd = parseHeader(head);
    const items = [];
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim() || headingOf(l) != null) continue;
      const it = parseItem(l);
      if (it.text && !isNone(it.text)) items.push({ text: it.text, tag: it.tag, min: it.min, done: false });
    }
    let totalMin = null;
    const est = hd['예상시간'] || hd['소요시간'] || '';
    if (est) {
      totalMin = Pr.duration(est);
      if (totalMin == null && /^\s*\d+(\.\d+)?\s*$/.test(est)) {
        const n = parseFloat(est);
        totalMin = Math.round(n <= 40 ? n * 60 : n);
        warnings.push('예상시간 단위가 없어 ' + (n <= 40 ? '시간' : '분') + '으로 읽었어요.');
      }
    }
    if (totalMin == null) {
      const s = items.reduce((a, x) => a + (x.min || 0), 0);
      if (s) { totalMin = s; warnings.push('예상시간이 없어 세부 항목의 합으로 계산했어요.'); }
    }
    const res = {
      type: 'task', title: hd['제목'] || '', due: Pr.normDate(hd['마감'] || '', ref), start: Pr.normDate(hd['시작'] || '', ref),
      totalMin: totalMin || 0, splittable: !/불가|아니|^no|false/i.test(hd['쪼개기'] || ''),
      priority: priorityOf(hd['중요도']), items, warnings
    };
    if (!res.title) warnings.push('제목을 찾지 못했어요.');
    if (!res.due) warnings.push('마감일을 찾지 못했어요.');
    if (!res.totalMin) warnings.push('예상 시간을 찾지 못했어요.');
    return res;
  };

  Pr.parse = function (text, ref) {
    const kind = Pr.detect(text);
    if (kind === 'task') return Pr.parseTask(text, ref);
    if (kind === 'note') return Pr.parseNote(text, ref);
    return null;
  };

  // 과목 별칭 매칭 (공백·기호 제거 후 가장 긴 별칭 포함 여부)
  Pr.norm = s => String(s || '').toLowerCase().replace(/[\s\-_·.,()[\]]+/g, '');
  Pr.matchSubject = function (subjects, title) {
    const t = Pr.norm(title);
    if (!t) return '';
    let best = '', bl = 0;
    for (const sb of subjects) {
      const names = [sb.name, sb.short, sb.folder].concat(sb.aliases || []);
      for (const n of names) {
        const a = Pr.norm(n);
        if (a && t.includes(a) && a.length > bl) { best = sb.id; bl = a.length; }
      }
    }
    return best;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Pr;
  else root.NoteParser = Pr;
})(typeof window !== 'undefined' ? window : globalThis);
