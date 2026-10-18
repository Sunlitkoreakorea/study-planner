/* 기말 플래너 — 계획 엔진 (순수 함수, 브라우저/Node 공용)
 *
 * 흐름: 상태(S) → jobs(시험·과제) + 필수 항목(복습·예습) → 일별 시뮬레이션 → 타임라인 배치
 */
(function (root) {
  'use strict';
  const P = {};
  const FRONT = 1.2; // 마감까지 균등 배분량의 120%를 앞당겨 배정해 여유를 만든다
  const pad = n => String(n).padStart(2, '0');

  // ---------- 날짜 / 시간 ----------
  P.pad = pad;
  P.DOW = ['일', '월', '화', '수', '목', '금', '토'];
  P.fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  P.parse = s => { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2], 12); };
  P.addDays = (s, n) => { const d = P.parse(s); d.setDate(d.getDate() + n); return P.fmt(d); };
  P.diffDays = (a, b) => Math.round((P.parse(b) - P.parse(a)) / 864e5);
  P.dow = s => P.parse(s).getDay();
  // 공부하는 하루는 새벽 2시에 바뀐다: 자정~2시는 아직 ‘어제’의 연장이고(시각은 24:00~26:00), 가용 시간·일정도 26:00(= 새벽 2시)까지 정할 수 있다
  P.DAY_ROLL = 120;          // 날짜가 바뀌는 시각(분) = 새벽 2시
  P.DAY_END = 26 * 60;       // 하루의 끝(분) = 다음날 새벽 2시
  P.today = () => P.fmt(new Date(Date.now() - P.DAY_ROLL * 60000));
  P.nowMin = () => { const d = new Date(), m = d.getHours() * 60 + d.getMinutes(); return m < P.DAY_ROLL ? m + 1440 : m; };
  P.toMin = hm => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : NaN; };
  P.hm = min => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  // 화면 표시용 12시간제 (저장·계산은 24시간제 분/'HH:MM' 그대로)
  P.t12 = min => { min = Math.round(min); const hh = Math.floor(min / 60) % 24, mm = min % 60; return `${hh % 12 || 12}:${pad(mm)} ${hh < 12 ? 'AM' : 'PM'}`; };
  P.t12s = min => { min = Math.round(min); const hh = Math.floor(min / 60) % 24; return min % 60 ? P.t12(min) : `${hh % 12 || 12} ${hh < 12 ? 'AM' : 'PM'}`; };
  P.t12str = hm => { const m = P.toMin(hm); return isNaN(m) ? "" : P.t12(m); };
  P.range12 = (a, b) => { const x = P.t12(a), y = P.t12(b); return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)}–${y}` : `${x}–${y}`; };
  P.uid = () => Math.random().toString(36).slice(2, 9);
  P.ceil5 = x => Math.ceil(x / 5 - 1e-9) * 5;
  P.floor5 = x => Math.floor(x / 5 + 1e-9) * 5;
  P.round5 = x => Math.round(x / 5) * 5;
  P.median = arr => {
    const a = arr.slice().sort((x, y) => x - y), n = a.length;
    if (!n) return 0;
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  };
  P.subj = (S, id) => (S.subjects || []).find(s => s.id === id);

  P.COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#9333ea',
    '#db2777', '#0d9488', '#65a30d', '#475569', '#ea580c', '#2563eb'];

  // ---------- 기본 상태 ----------
  P.defaultSettings = function (env) {
    env = env || {};
    return {
      startDate: P.today(),
      classEnd: '2026-12-10',          // 이 날짜 이후엔 수업(복습·예습) 없음 — 기말 기간
      weekdayBlocks: [['18:30', '21:00'], ['21:30', '24:00']],
      weekendBlocks: [['08:00', '24:00']],
      theme: 'system',                 // 화면 모드: system(Windows 설정 따라감) | light | dark
      reviewCapOn: false,              // 켜면 하루 복습·예습 상한(reviewCapMin)과 남은 시간 안에서만 넣고 나머지는 ‘빠진 항목’으로. 끄면(기본) 전부 넣는다
      reviewCapMin: 180,               // 하루 복습+예습 상한 (reviewCapOn 일 때만)
      planFillPct: 85,                 // 가용 시간의 몇 %까지만 계획에 채울지
      breakOn: true, focusMin: 50, breakMin: 10,
      hardFirst: true,                 // 어려운 과목을 먼저 배치
      carryAll: true,                  // 체크리스트 노트를 등록한 복습은 끝내거나 뺄 때까지 계속 이월
      lookback: 2,                     // 노트가 없는 복습(시간표 기준)은 며칠 전 수업까지 다시 보여줄지 (carryAll 이 꺼지면 모든 복습에 적용)
      bufferDays: 3,                   // 시험 N일 전까지 범위를 끝낸다
      finalDays: 4,                    // 시험 N일 전부터 직전 정리를 시작한다
      maxJobsPerDay: 3,
      autoAvg: true,                   // 쌓인 기록의 중앙값으로 예상 시간 보정
      minDefaults: { review: 20, preview: 15, chapter: 90, final: 120, exam: 480 },
      studyRoot: env.studyRoot || '',
      inbox: env.inbox || ''
    };
  };

  P.defaultState = function (env) {
    env = env || {};
    const mk = (id, short, name, folder, aliases, o) =>
      Object.assign({ id, short, name, folder, aliases, review: false, preview: false, weight: 3, hard: false, mins: {} }, o || {});
    const subjects = [
      mk('se', '세생', '세포생물학의 이해', '세포생물학의 이해', ['세생', '세포생물학', '세포생물'], { review: true, weight: 3 }),
      mk('mic', 'AP미경', 'AP 미시경제', 'AP Missy Economics', ['AP미경', 'AP미시경제', '미시경제', 'AP Micro', 'APMicro'], { review: true, weight: 4 }),
      mk('eng', 'AP영어', 'AP 영어학', 'AP 영어학', ['AP영어', 'AP영어학', '영어학'], { review: true, weight: 3 }),
      mk('chem', 'AP화학', 'AP 화학', 'AP 화학', ['AP화학', '화학'], { review: true, preview: true, weight: 5, hard: true }),
      mk('calc', 'AP미적', 'AP 미적분학 II', 'AP 미적분학 II', ['AP미적', 'AP미적분', '미적분'], { review: true, weight: 4, hard: true }),
      mk('self', '성자이', '성격과 자기 이해', '성격과 자기 이해', ['성자이', '성격과자기이해'], { review: true, weight: 2 }),
      mk('stat', 'AP통계', 'AP 통계학', 'AP 통계학', ['AP통계', 'AP통계학', '통계학'], { review: true, weight: 4 }),
      mk('career', '진직', '진직', '', ['진직']),
      mk('fp', '융프', '융합프로젝트', '', ['융프', '융합프로젝트']),
      mk('pe', '체육', '체육', '', ['체육']),
      mk('rafi', '라피네', '라피네', '', ['라피네']),
      mk('psy', '프시케', '프시케', '', ['프시케'])
    ];
    subjects.forEach((s, i) => { s.color = P.COLORS[i % P.COLORS.length]; });
    // 시험 시간표가 나오기 전 임시 날짜 — 시험 기간(12/11~12/18)에 분산한 가정값 (확정 체크 전까지 '미확정'으로 표시)
    const assumed = { se: '2026-12-11', mic: '2026-12-14', eng: '2026-12-15', chem: '2026-12-16', calc: '2026-12-17', self: '2026-12-17', stat: '2026-12-18' };
    const exams = subjects.filter(s => s.review).map(s => ({
      id: 'e_' + s.id, sid: s.id, date: assumed[s.id] || '2026-12-11', confirmed: false,
      scope: [], budgetMin: 480, finalMin: 120, partial: 0, finalSpent: 0, finalDone: false
    }));
    return {
      version: 1,
      settings: P.defaultSettings(env),
      subjects,
      // [요일 월~금][1~8교시]
      timetable: [
        ['', 'calc', 'calc', 'mic', 'fp', 'stat', 'self', 'chem'],
        ['se', 'se', 'career', '', 'chem', 'stat', 'stat', 'self'],
        ['mic', 'self', 'se', 'se', 'eng', 'eng', 'rafi', 'rafi'],
        ['eng', 'calc', '', 'self', 'mic', 'mic', 'psy', 'psy'],
        ['chem', 'chem', 'fp', 'fp', 'pe', 'pe', 'eng', 'stat']
      ],
      dayOverrides: { '2026-12-18': { off: true, note: '귀가 (13:30)' } },
      fixed: [{ id: 'f_mirror', title: 'MIRROR 정기회의', dow: 0, start: '', end: '' }],
      milestones: [
        { id: 'm1', date: '2026-12-11', end: '2026-12-18', title: '1,2학년 기말고사', kind: 'exam' },
        { id: 'm2', date: '2026-12-18', title: '귀가 (13:30)', kind: 'etc' },
        { id: 'm3', date: '2026-12-22', title: 'KSEF 제출 마감', kind: 'deadline' },
        { id: 'm4', date: '2026-12-24', title: '귀가', kind: 'etc' },
        { id: 'm5', date: '2026-12-28', title: '포스터 및 최종보고서 마감', kind: 'deadline' }
      ],
      exams,
      tasks: [],
      lessons: {},     // 'YYYY-MM-DD|sid' → { note, file, importedAt }
      progress: {},    // 'rev|date|sid' / 'pre|date|sid' → { done, actual, doneDate } | { skipped }
      checks: {},      // 체크리스트 항목 상태 'key:i' → true
      acc: {},         // 타이머로 누적된 분 (완료 전)
      work: [],        // 시험·과제에 쓴 시간 기록
      log: [],         // 통계용 기록 { ts,date,key,kind,sid,est,act,src }
      manual: {},      // 손으로 고정한 시간 { 'YYYY-MM-DD': { entryId: { start, dur } | { skip: true } } }
      routines: [],    // 반복 공부(루틴) [{ id, title, sid, days:[0~6], min, amount, from, until, on }]
      layout: {},      // 손댄 날의 블록 위치 고정 { 'YYYY-MM-DD': { entryId: start } } — 한 블록을 옮겨도 나머지가 따라 움직이지 않게
      custom: [],      // 내가 추가한 하루 일정 [{ id, date, title, kind: 'todo'|'event', start(분), dur(분), done }]
      allocs: [],      // 할당(번호 묶음·이름 목록을 날짜에 나눠 배정) [{ id, title, color, min, due, items: [{ id, label, min, done, doneDate }] }]
      important: [],   // 중요 할 일 [{ id, date, title, done }] — 계획 탭에서 날짜별로 적고, 홈 화면에 D-day 로 나온다
      timer: null
    };
  };

  // ---------- 할당 (WS 1~10, R&W 세트처럼 번호 있는 묶음을 날짜에 하나씩 배정) ----------
  // 배정 = 그 항목에 묶인 일정(S.custom 의 c.alloc = { a: 할당id, i: 항목id })이 있는 것. 일정을 지우면 다시 ‘대기’로 돌아간다.
  // 일정에 시각(c.start)이 없으면 그날 빈 시간에 자동 배치되고, 못 끝낸 것은 오늘로 이월된다.
  P.allocFind = function (S, ref) {
    const a = ref && (S.allocs || []).find(x => x.id === ref.a);
    const item = a && a.items.find(x => x.id === ref.i);
    return item ? { a, item } : null;
  };
  P.allocUnits = function (S, a) {
    return a.items.map(item => {
      const c = item.done ? null : (S.custom || []).find(x => x.alloc && x.alloc.a === a.id && x.alloc.i === item.id && !x.done) || null;
      return { item, custom: c, state: item.done ? 'done' : c ? 'assigned' : 'waiting', date: c ? c.date : (item.done ? item.doneDate || null : null) };
    });
  };
  P.allocStats = function (S, a, today) {
    const U = P.allocUnits(S, a);
    const asg = U.filter(u => u.state === 'assigned');
    const done = U.filter(u => u.state === 'done').length, waiting = U.filter(u => u.state === 'waiting').length;
    const dates = asg.map(u => (u.date < today ? today : u.date)).sort();
    const last = dates.length ? dates[dates.length - 1] : null;
    const next = U.find(u => u.state !== 'done') || null;
    return { total: U.length, done, assigned: asg.length, waiting, last, next, overdue: asg.filter(u => u.date < today).length,
      late: !!(a.due && last && last > a.due), min: U.filter(u => u.state !== 'done').reduce((s, u) => s + (u.item.min || a.min || 0), 0) };
  };
  // 대기 중인 n개를 날짜에 나눈다. days = P.plan().days, perDay=0 이면 가능한 날에 고르게(앞날이 조금 더), 아니면 하루 perDay개씩 앞에서부터
  P.allocSpread = function (days, today, due, n, perDay) {
    const lim = due && due >= today ? due : P.addDays(today, 13);
    const el = days.filter(D => D.date >= today && D.date <= lim && D.raw > 0).map(D => D.date);
    if (!el.length || n <= 0) return { dates: [], perDay: 0, eligible: el.length };
    const dates = [];
    if (perDay > 0) { for (const d of el) for (let k = 0; k < perDay && dates.length < n; k++) dates.push(d); }
    else { const base = Math.floor(n / el.length), extra = n % el.length; el.forEach((d, i) => { for (let k = 0; k < base + (i < extra ? 1 : 0); k++) dates.push(d); }); }
    return { dates, perDay: perDay > 0 ? perDay : Math.ceil(n / el.length), eligible: el.length };
  };
  // 시각을 정하지 않은(자동 배치) 할당 일정의 그날 분량 — 못 끝낸 지난 날 것은 오늘로 이월되어 함께 센다
  P.autoAllocMin = function (S, date, isToday) {
    return (S.custom || []).filter(c => c.alloc && !c.done && ((c.date === date && c.start == null) || (isToday && c.date < date))).reduce((a, c) => a + c.dur, 0);
  };

  // 기존 할 일(중요 할 일 'imp:<id>' · 과제 'task:<id>')에 일정(S.custom, c.ref)으로 시간을 잡아 둔 ‘해결 예정’. 아직 안 끝낸 오늘 이후 것만, 빠른 순서
  P.scheduledFor = function (S, ref, today) {
    return (S.custom || []).filter(c => c.ref === ref && !c.done && c.start != null && c.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  };

  // 홈 화면용: 앞으로 남은(또는 아직 못 끝낸) 일정을 날짜순으로 모은다.
  // kind: imp 중요 할 일 · task 마감·대회 · exam 시험 · etc 달력 일정. 기간 일정(기말고사 등)은 시작 전엔 시작일, 진행 중엔 오늘 기준.
  P.upcoming = function (S, today) {
    const L = [], ORDER = { imp: 0, task: 1, exam: 2, etc: 3 };
    for (const it of S.important || []) {
      if (it.done || !it.date) continue;
      L.push({ id: 'imp:' + it.id, kind: 'imp', date: it.date, eff: it.date, title: it.title, overdue: it.date < today, impId: it.id });
    }
    for (const t of S.tasks) if (!t.done && t.due && t.due >= today) L.push({ id: 'task:' + t.id, kind: 'task', date: t.due, eff: t.due, title: t.title });
    for (const e of S.exams) {
      const sb = P.subj(S, e.sid);
      if (!sb || !e.date || e.date < today) continue;
      L.push({ id: 'exam:' + e.id, kind: 'exam', date: e.date, eff: e.date, title: `${sb.name} 시험`, color: sb.color, unconfirmed: !e.confirmed });
    }
    for (const a of S.allocs || []) {
      const st = P.allocStats(S, a, today);
      if (!a.due || a.due < today || st.done >= st.total) continue;
      L.push({ id: 'al:' + a.id, kind: 'task', date: a.due, eff: a.due, title: `${a.title} (${st.done}/${st.total})`, color: a.color });
    }
    for (const m of S.milestones) {
      const end = m.end || m.date;
      if (!m.date || end < today) continue;
      const kind = m.kind === 'exam' ? 'exam' : m.kind === 'deadline' ? 'task' : 'etc';
      L.push({ id: 'ms:' + m.id, kind, date: m.date, end: m.end || null, eff: m.date < today ? today : m.date, ongoing: m.date <= today, title: m.title });
    }
    return L.sort((a, b) => a.eff.localeCompare(b.eff) || ORDER[a.kind] - ORDER[b.kind] || a.title.localeCompare(b.title));
  };

  // ---------- 용량 ----------
  function subtract(iv, s, e) {
    const out = [];
    for (const [a, b] of iv) {
      if (e <= a || s >= b) { out.push([a, b]); continue; }
      if (s > a) out.push([a, s]);
      if (e < b) out.push([e, b]);
    }
    return out;
  }
  function clip(iv, from) {
    return iv.map(([a, b]) => [Math.max(a, from), b]).filter(([a, b]) => b > a);
  }
  P.clip = clip;

  P.fixedHits = function (f, date) {
    if (f.date) return f.date === date;
    if (f.dow == null || f.dow === '') return false;
    return +f.dow === P.dow(date) && (!f.until || date <= f.until) && (!f.from || date >= f.from);
  };

  // 그날의 공부 시간대(자습 시간: 1자습, 2자습 …): 설정·날짜별 예외로 정한 구간. 고정 일정·내 일정을 빼기 전
  P.baseBlocks = function (S, date) {
    const ov = (S.dayOverrides || {})[date];
    if (ov && ov.off) return [];
    const w = P.dow(date), weekend = w === 0 || w === 6;
    const base = ov && ov.blocks && ov.blocks.length ? ov.blocks : (weekend ? S.settings.weekendBlocks : S.settings.weekdayBlocks);
    return base.map(b => [P.toMin(b[0]), P.toMin(b[1])]).filter(b => b[1] > b[0]);
  };
  // 구간 [a,b) 안에서 dur 분이 들어가는 가장 이른 시작 (taken: 이미 차지한 [시작,끝] 목록). 들어갈 자리가 없으면 null
  P.firstFit = function (a, b, taken, dur) {
    const t = taken.filter(([x, y]) => y > a && x < b).sort((p, q) => p[0] - q[0]);
    let start = a;
    for (const [x, y] of t) { if (x - start >= dur) break; start = Math.max(start, y); }
    return start + dur <= b ? start : null;
  };

  P.blocksFor = function (S, date) {
    let iv = P.baseBlocks(S, date);
    const w = P.dow(date);
    for (const f of S.fixed || []) {
      const s = P.toMin(f.start), e = P.toMin(f.end);
      if (!(e > s) || !P.fixedHits(f, date)) continue;
      iv = subtract(iv, s, e);
    }
    for (const c of S.custom || []) {
      if (c.date !== date || c.done || c.start == null) continue;
      iv = subtract(iv, c.start, c.start + c.dur);
    }
    return iv;
  };

  function effMinutes(S, iv) {
    const st = S.settings;
    let tot = 0;
    for (const [a, b] of iv) {
      const L = b - a;
      tot += st.breakOn ? Math.floor(L * st.focusMin / (st.focusMin + st.breakMin)) : L;
    }
    return tot;
  }

  // ---------- 수업 / 시간표 ----------
  P.lessonsOn = function (S, date) {
    const w = P.dow(date);
    if (w === 0 || w === 6) return [];
    const ov = (S.dayOverrides || {})[date];
    if (ov && ov.off) return [];
    if (S.settings.classEnd && date > S.settings.classEnd) return [];
    const row = S.timetable[w - 1] || [];
    const out = [];
    row.forEach((id, i) => {
      if (!id) return;
      let o = out.find(x => x.sid === id);
      if (!o) { o = { sid: id, periods: [] }; out.push(o); }
      o.periods.push(i + 1);
    });
    return out;
  };

  P.nextSchoolDay = function (S, date) {
    for (let i = 1; i <= 14; i++) {
      const d = P.addDays(date, i);
      if (P.lessonsOn(S, d).length) return d;
    }
    return null;
  };

  // ---------- 예상 시간 (직접 입력 → 기록이 쌓이면 중앙값 반영) ----------
  P.sampleStats = function (S, sid, kind) {
    const xs = (S.log || []).filter(l => l.sid === sid && l.kind === kind && l.act > 0).slice(-8).map(l => l.act);
    return { n: xs.length, median: xs.length ? P.median(xs) : 0 };
  };
  P.effMin = function (S, sid, kind) {
    const sb = P.subj(S, sid);
    const manual = (sb && sb.mins && sb.mins[kind]) || S.settings.minDefaults[kind] || 20;
    const st = P.sampleStats(S, sid, kind);
    if (S.settings.autoAvg && st.n >= 3) {
      const w = st.n / (st.n + 3);
      return { min: Math.max(5, P.round5(w * st.median + (1 - w) * manual)), manual, n: st.n, median: st.median, auto: true };
    }
    return { min: manual, manual, n: st.n, median: st.median, auto: false };
  };
  P.stats = function (S) {
    const rows = [];
    for (const sb of S.subjects) {
      for (const kind of ['review', 'preview']) {
        if (!sb[kind]) continue;
        rows.push(Object.assign({ sb, kind }, P.effMin(S, sb.id, kind)));
      }
    }
    let est = 0, act = 0;
    for (const l of S.log || []) if (l.est > 0 && l.act > 0) { est += l.est; act += l.act; }
    return { rows, ratio: est ? act / est : null, nlog: (S.log || []).length };
  };

  function itemsMin(items) {
    return Math.max(10, P.round5(items.reduce((a, i) => a + (i.min != null ? i.min : 5), 0)));
  }

  // 못 끝낸 복습을 며칠 전 수업까지 훑어볼지. carryAll(기본)이면 최대 60일(시작일 이전 제외) — 이 중 노트 없는 복습은 reviewItems 에서 lookback 일까지만 남긴다
  P.carryDays = function (S, date) {
    const st = S.settings;
    if (st.carryAll === false) return Math.max(0, st.lookback || 0);
    return Math.max(st.lookback || 0, Math.min(60, Math.max(0, P.diffDays(st.startDate, date))));
  };

  // 복습노트 합치기: 이미 있는 노트 뒤에 새 내용을 덧붙인다 (같은 항목은 건너뜀). 기존 항목의 순서·번호는 그대로라 체크 상태가 유지된다.
  // 반환: { note, added: 새로 붙은 체크리스트·예습 항목 수, addedAny: 새로 붙은 것이 하나라도 있는지 }
  P.mergeNote = function (oldNote, nw) {
    const txt = x => String(typeof x === 'string' ? x : (x && x.text) || '').trim();
    const cat = (a, b) => {
      a = a || []; b = b || [];
      const seen = new Set(a.map(txt));
      const add = b.filter(x => { const k = txt(x); if (!k || seen.has(k)) return false; seen.add(k); return true; });
      return { list: a.concat(add), n: add.length };
    };
    const note = { priority: nw.priority || (oldNote && oldNote.priority) || '' };
    let added = 0, addedAny = false;
    for (const k of ['summary', 'concepts', 'items', 'questions', 'preview']) {
      const r = cat(oldNote && oldNote[k], nw[k]);
      note[k] = r.list;
      if (r.n) addedAny = true;
      if (k === 'items' || k === 'preview') added += r.n;
    }
    return { note, added, addedAny };
  };

  // ---------- 복습 / 예습 (필수 항목) ----------
  P.reviewItems = function (S, date, isToday) {
    const out = [], st = S.settings;
    const look = isToday ? P.carryDays(S, date) : 0;
    for (let k = 0; k <= look; k++) {
      const d = P.addDays(date, -k);
      const found = [];
      for (const h of P.lessonsOn(S, d)) {
        const L = S.lessons[d + '|' + h.sid];
        if (d >= st.startDate || (L && L.note)) found.push({ sid: h.sid, periods: h.periods });
      }
      for (const key of Object.keys(S.lessons || {})) {
        if (!key.startsWith(d + '|')) continue;
        const sid = key.slice(11);
        if (S.lessons[key].note && !found.find(x => x.sid === sid)) found.push({ sid, periods: [] });
      }
      for (const { sid, periods } of found) {
        const sb = P.subj(S, sid);
        if (!sb || !sb.review) continue;
        const key = `rev|${d}|${sid}`;
        const pg = (S.progress || {})[key] || {};
        if (pg.skipped) continue;
        if (pg.done && !(isToday && pg.doneDate === date)) continue;
        const note = S.lessons[d + '|' + sid] && S.lessons[d + '|' + sid].note;
        if (k > (st.lookback || 0) && !(note && note.items && note.items.length)) continue;   // 노트 없는 복습은 lookback 일까지만 이월 (쌓이는 것 방지)
        let est, estInfo = null;
        if (note && note.items && note.items.some(i => i.min != null)) est = itemsMin(note.items);
        else { estInfo = P.effMin(S, sid, 'review'); est = estInfo.min; }
        const ldow = P.dow(d);
        if (sb.rvDurs && sb.rvDurs[ldow] != null) { est = Math.max(5, sb.rvDurs[ldow]); estInfo = null; }          // 루틴 시간표에서 정한 길이
        const fixedStart = k === 0 ? (sb.rvStarts && sb.rvStarts[ldow] != null ? sb.rvStarts[ldow] : (sb.rvStart != null ? sb.rvStart : null)) : null;           // 그날 수업의 복습은 정한 시각에 고정
        out.push({ key, kind: 'review', sid, date: d, periods, est, estInfo, note, overdue: k, fixedStart, done: !!pg.done, actual: pg.actual || 0 });
      }
    }
    return out;
  };

  P.previewSource = function (S, sid, upto) {
    let best = null;
    for (const key of Object.keys(S.lessons || {})) {
      const d = key.slice(0, 10), s = key.slice(11);
      if (s !== sid || d > upto) continue;
      const items = (S.lessons[key].note && S.lessons[key].note.preview) || [];
      if (items.length && (!best || d > best.date)) best = { date: d, items };
    }
    return best;
  };

  P.previewItems = function (S, date, isToday) {
    const target = P.nextSchoolDay(S, date);
    if (!target) return [];
    const out = [];
    for (const h of P.lessonsOn(S, target)) {
      const sb = P.subj(S, h.sid);
      if (!sb || !sb.preview) continue;
      const key = `pre|${target}|${h.sid}`;
      const pg = (S.progress || {})[key] || {};
      if (pg.skipped) continue;
      if (pg.done && !(isToday && pg.doneDate === date)) continue;
      const src = P.previewSource(S, h.sid, date);
      let est, estInfo = null;
      if (src && src.items.some(i => i.min != null)) est = itemsMin(src.items);
      else { estInfo = P.effMin(S, h.sid, 'preview'); est = estInfo.min; }
      out.push({ key, kind: 'preview', sid: h.sid, date: target, periods: h.periods, est, estInfo, src, done: !!pg.done, actual: pg.actual || 0 });
    }
    return out;
  };

  // ---------- 루틴 (매일/요일별로 반복하는 공부: 단어, 문제풀이, 모의고사 …) ----------
  P.daysText = days => {
    const d = (days || []).slice().sort((a, b) => a - b), k = d.join(',');
    if (d.length === 7) return '매일';
    if (k === '1,2,3,4,5') return '평일';
    if (k === '0,6') return '주말';
    return d.map(x => P.DOW[x]).join('·');
  };
  // 루틴이 그 요일에 갖는 시각(없으면 null = 시간 미정)과 길이. 요일별로 따로 정할 수 있다 (r.starts[요일], r.durs[요일])
  P.occ = (r, dow) => ({
    start: r.starts && r.starts[dow] != null ? r.starts[dow] : (r.start != null ? r.start : null),   // 요일별 예외 > 루틴 기본 시각(모든 요일에 반복) > 미정
    min: Math.max(5, (r.durs && r.durs[dow] != null) ? r.durs[dow] : (r.min || 30))
  });
  P.routineItems = function (S, date, isToday) {
    const out = [], ov = (S.dayOverrides || {})[date];
    if (ov && ov.off) return out;
    const w = P.dow(date);
    for (const r of S.routines || []) {
      if (r.on === false || !(r.days || []).includes(w) || !P.subj(S, r.sid)) continue;
      if (r.from && date < r.from) continue;
      if (r.until && date > r.until) continue;
      const key = `rt|${date}|${r.id}`;
      const pg = (S.progress || {})[key] || {};
      if (pg.skipped) continue;
      if (pg.done && !(isToday && pg.doneDate === date)) continue;
      const oc = P.occ(r, w);
      out.push({ key, kind: 'routine', sid: r.sid, date, est: oc.min, fixedStart: oc.start, routine: r, done: !!pg.done, actual: pg.actual || 0, estInfo: null });
    }
    return out;
  };

  // ---------- 시험 / 과제 (마감이 있는 작업) ----------
  P.examTotal = function (S, e) {
    const st = S.settings;
    if (e.scope && e.scope.length) return e.scope.reduce((a, c) => a + (c.min || st.minDefaults.chapter), 0);
    return e.budgetMin != null ? e.budgetMin : st.minDefaults.exam;
  };
  P.examRemaining = function (S, e) {
    const st = S.settings;
    const undone = e.scope && e.scope.length
      ? e.scope.filter(c => !c.done).reduce((a, c) => a + (c.min || st.minDefaults.chapter), 0)
      : (e.budgetMin != null ? e.budgetMin : st.minDefaults.exam);
    return Math.max(0, undone - (e.partial || 0));
  };
  P.spentOn = (S, key, date) => (S.work || []).filter(w => w.key === key && w.date === date).reduce((a, w) => a + w.min, 0);

  P.jobs = function (S, today) {
    const st = S.settings, out = [];
    for (const e of S.exams || []) {
      const sb = P.subj(S, e.sid);
      if (!sb || !e.date || e.date <= today) continue;
      const buf = Math.max(1, e.buffer != null ? e.buffer : st.bufferDays);
      const last = P.addDays(e.date, -1);
      let dl = P.addDays(e.date, -buf);
      if (dl < today) dl = today;
      const id = 'exam|' + e.id, fid = 'final|' + e.id;
      const rem = P.examRemaining(S, e);
      if (rem > 0 || P.spentOn(S, id, today) > 0) {
        out.push({ id, kind: 'exam', sid: e.sid, title: `${sb.name} ${e.label || '기말 대비'}`, release: today, deadline: dl, rem, minChunk: 30, maxPerDay: 150, weight: sb.weight || 3, hard: !!sb.hard, ref: e });
      }
      if (!e.finalDone) {
        const frem = Math.max(0, (e.finalMin != null ? e.finalMin : st.minDefaults.final) - (e.finalSpent || 0));
        let rel = P.addDays(e.date, -Math.max(1, st.finalDays || 4));
        if (rel < today) rel = today;
        if (frem > 0 || P.spentOn(S, fid, today) > 0) {
          out.push({ id: fid, kind: 'final', sid: e.sid, title: `${sb.name} 직전 정리`, release: rel, deadline: last, rem: frem, minChunk: 30, maxPerDay: 120, weight: (sb.weight || 3) + 1, hard: !!sb.hard, ref: e });
        }
      }
    }
    for (const t of S.tasks || []) {
      if (t.done) continue;
      const id = 'task|' + t.id;
      const rem = Math.max(0, (t.totalMin || 0) - (t.spent || 0));
      if (!(rem > 0 || P.spentOn(S, id, today) > 0)) continue;
      let dl = t.due || P.addDays(today, 30);
      if (dl < today) dl = today;
      let rel = t.start && t.start > today ? t.start : today;
      if (rel > dl) rel = dl;
      const w = { 1: 2, 2: 3, 3: 5 }[t.priority || 2];
      out.push({ id, kind: 'task', sid: t.sid || '', title: t.title, release: rel, deadline: dl, rem, minChunk: Math.min(t.minChunk || 30, 180), maxPerDay: t.maxPerDay || 180, weight: w, hard: false, ref: t });
    }
    return out;
  };

  // ---------- 일별 계획 ----------
  P.manualOf = (S, date) => (S.manual && S.manual[date]) || {};
  P.subjSkipped = (man, date, sid) => !!(man['st|' + date + '|' + sid] && man['st|' + date + '|' + sid].skip);

  P.plan = function (S, opts) {
    opts = opts || {};
    const today = opts.today || P.today();
    const nowMin = opts.nowMin != null ? opts.nowMin : P.nowMin();
    const st = S.settings;
    const jobs = P.jobs(S, today);
    let horizon = 28;
    for (const j of jobs) horizon = Math.max(horizon, P.diffDays(today, j.deadline) + 1);
    for (const c of S.custom || []) if (c.date >= today) horizon = Math.max(horizon, P.diffDays(today, c.date) + 1);
    horizon = Math.min(horizon, 150);

    const days = [];
    for (let t = 0; t < horizon; t++) {
      const date = P.addDays(today, t);
      let blocks = P.blocksFor(S, date);
      if (t === 0) blocks = clip(blocks, Math.ceil(nowMin / 5) * 5);
      const raw = blocks.reduce((a, b) => a + b[1] - b[0], 0);
      const cap = Math.floor(effMinutes(S, blocks) * st.planFillPct / 100);
      days.push({ date, t, blocks, raw, cap, nowMin: t === 0 ? Math.ceil(nowMin / 5) * 5 : 0, mandatory: [], done: [], dropped: [], work: [], used: 0, entries: [] });
    }
    // 날짜별 '남는 용량' = 가용 − 복습·예습 예상치. 시험·과제는 이 용량에 비례해 나눠 배정한다 (주말처럼 긴 날에 더 많이)
    for (const D of days) {
      const isToday = D.t === 0;
      const manD = P.manualOf(S, D.date);
      const all = P.reviewItems(S, D.date, isToday).concat(P.previewItems(S, D.date, isToday)).filter(x => !(manD[x.key] && manD[x.key].skip) && !(x.kind === 'review' && manD['rr' + x.key.slice(3)] && manD['rr' + x.key.slice(3)].skip) && !P.subjSkipped(manD, D.date, x.sid));
      const doneMin = all.filter(x => x.done).reduce((a, x) => a + (x.actual || 0), 0);
      const pendMin = all.filter(x => !x.done).reduce((a, x) => a + x.est, 0);
      const rtMin = P.routineItems(S, D.date, isToday)
        .filter(x => !x.done && !(manD[x.key] && manD[x.key].skip) && !P.subjSkipped(manD, D.date, x.sid)).reduce((a, x) => a + x.est, 0) + P.autoAllocMin(S, D.date, isToday);
      const mand = (st.reviewCapOn ? Math.min(pendMin, Math.max(0, Math.min(D.cap - rtMin, st.reviewCapMin - doneMin))) : pendMin) + rtMin;
      D.free = D.cap - mand >= 15 ? D.cap - mand : 0;
    }
    const freeSum = (t0, dl) => {
      let c = 0;
      for (let t = t0; t < days.length && days[t].date <= dl; t++) c += days[t].free;
      return c;
    };

    const sim = jobs.map((j, i) => {
      const sp = P.spentOn(S, j.id, today);
      return Object.assign({}, j, { sp, cur: j.rem + sp, owed: ((i * 0.37) % 1) * j.minChunk });
    });
    const deficits = [];
    const rank = x => (x.kind === 'review' ? (x.overdue ? 2 : 0) : 1);
    const wt = x => (P.subj(S, x.sid) || {}).weight || 3;

    for (const D of days) {
      const isToday = D.t === 0;
      // 1) 필수 항목: 복습·예습 (하루 상한 적용). 사용자가 그 과목 블록을 옮기거나 늘렸다면 항상 포함
      const man = P.manualOf(S, D.date);
      const all = P.reviewItems(S, D.date, isToday).concat(P.previewItems(S, D.date, isToday))
        .filter(x => !(man[x.key] && man[x.key].skip) && !(x.kind === 'review' && man['rr' + x.key.slice(3)] && man['rr' + x.key.slice(3)].skip) && !P.subjSkipped(man, D.date, x.sid));
      D.skipped = Object.keys(man).filter(k => man[k].skip);
      D.done = all.filter(x => x.done);
      const pending = all.filter(x => !x.done);
      const rts = P.routineItems(S, D.date, isToday)
        .filter(x => !(man[x.key] && man[x.key].skip) && !(man['rb' + x.key.slice(2)] && man['rb' + x.key.slice(2)].skip) && !P.subjSkipped(man, D.date, x.sid));
      const rtPending = rts.filter(x => !x.done);
      const am = P.autoAllocMin(S, D.date, isToday);
      const rtMin = rtPending.reduce((a, x) => a + x.est, 0) + am;
      D.done = D.done.concat(rts.filter(x => x.done));
      const doneMin = D.done.filter(x => x.kind !== 'routine').reduce((a, x) => a + (x.actual || 0), 0);
      const allow = st.reviewCapOn ? Math.max(0, Math.min(D.cap - rtMin, st.reviewCapMin - doneMin)) : Infinity;   // 상한을 끄면 복습·예습은 전부 넣는다 (시간에 못 들어가면 ‘시간 못 정함’)
      pending.sort((a, b) => rank(a) - rank(b) || (b.overdue || 0) - (a.overdue || 0) || wt(b) - wt(a));   // 이월된 복습은 오래된 것부터
      const pinSid = x => !!man['st|' + D.date + '|' + x.sid] || x.fixedStart != null;
      let used = 0;
      for (const it of pending) if (pinSid(it)) { D.mandatory.push(it); used += it.est; }
      for (const it of pending) {
        if (pinSid(it)) continue;
        if (used + it.est <= allow) { D.mandatory.push(it); used += it.est; } else D.dropped.push(it);
      }
      for (const it of rtPending) { D.mandatory.push(it); used += it.est; }
      used += am;
      D.used = used;
      let remCap = D.cap - used;

      // 2) 시험·과제: 마감까지 남은 날짜로 균등 배분 (+ 이월되는 몫). 길이를 고정한 작업은 그 길이대로
      const reviewMin = {};
      for (const it of D.mandatory) reviewMin[it.sid] = (reviewMin[it.sid] || 0) + it.est;
      const act = sim.filter(j => j.cur > 0.5 && j.release <= D.date && D.date <= j.deadline &&
        !(man[j.id] && man[j.id].skip) && !(j.sid && P.subjSkipped(man, D.date, j.sid)));
      // 사용자가 정한 길이: 작업 자체의 길이, 또는 과목 블록 전체 길이에서 복습·예습을 뺀 만큼을 시험 대비에 배정
      const forcedDur = j => {
        const ov = man[j.id];
        if (ov && ov.dur) return ov.dur;
        const os = j.sid && man['st|' + D.date + '|' + j.sid];
        if (os && os.dur && j.kind === 'exam') return Math.max(0, os.dur - (reviewMin[j.sid] || 0));
        return null;
      };
      const forced = act.filter(j => forcedDur(j) != null);
      const auto = act.filter(j => forcedDur(j) == null);
      let njobs = 0;
      for (const j of forced) {
        const sp = isToday ? j.sp : 0;
        const amt = Math.min(forcedDur(j), P.ceil5(j.cur));
        if (amt < 5) continue;
        const todo = Math.max(0, amt - sp);
        D.work.push({ job: j, min: amt, sp, todo, pinned: true });
        remCap -= todo; j.cur = Math.max(0, j.cur - amt); j.owed = 0; njobs++;
      }
      for (const j of auto) {
        const den = freeSum(D.t, j.deadline);
        j.share = den > 0 ? Math.min(j.cur, FRONT * j.cur * D.free / den) : 0;
        j.need = Math.min(j.cur, j.owed + j.share);
        j.last = D.date === j.deadline || freeSum(D.t + 1, j.deadline) === 0;
      }
      auto.sort((a, b) => (+b.last - +a.last) ||
        (b.need * (0.8 + 0.08 * b.weight) - a.need * (0.8 + 0.08 * a.weight)));
      for (const j of auto) {
        const sp = isToday ? j.sp : 0;
        let amt = 0;
        const trigger = j.last || j.need >= j.minChunk || j.need >= j.cur - 1;
        if (trigger && (njobs < st.maxJobsPerDay || j.last) && remCap + sp >= 5) {
          amt = Math.min(P.ceil5(j.need), P.ceil5(j.cur), j.maxPerDay, P.floor5(remCap + sp));
          if (amt < Math.min(j.minChunk, j.cur) && !j.last) amt = 0;
        }
        if (amt >= 5) {
          D.work.push({ job: j, min: amt, sp, todo: Math.max(0, amt - sp) });
          remCap -= Math.max(0, amt - sp);
          j.cur = Math.max(0, j.cur - amt);
          j.owed = Math.max(0, Math.min(j.cur, j.need - amt));
          njobs++;
        } else {
          j.owed = j.need;
        }
      }
      if (isToday) {
        // 오늘 이미 한 만큼이 계획보다 크면 그 초과분도 소진으로 처리
        for (const j of sim) {
          const w = D.work.find(x => x.job === j);
          const planned = w ? w.min : 0;
          if (j.sp > planned) j.cur = Math.max(0, j.cur - (j.sp - planned));
        }
      }
      for (const j of sim) {
        if (j.deadline === D.date && j.cur > 4) deficits.push({ job: j, amount: Math.round(j.cur), date: D.date });
      }
      P.place(S, D);
    }
    return { today, days, jobs: sim, deficits };
  };

  // ---------- 타임라인 배치 ----------
  // 한 과목의 복습·예습·시험 대비는 하루에 블록 하나(과목 블록)로 합친다. 대회·과제와 내 일정은 따로.
  // 순서: ① 내 일정 ② 직접 옮긴 블록 ③ 이전에 놓였던 자리를 그대로 지키는 블록(layout) ④ 나머지는 가장 이른 빈 구간에 자동 배치.
  // ③ 덕분에 한 블록을 옮겨도 다른 블록이 따라 움직이지 않는다. 자리가 겹치는 블록만 자동 배치로 돌아간다.
  // 블록 길이를 target 분으로 줄일 때 각 부분(복습·예습·시험 대비)의 분을 비례해서(5분 단위) 줄인다
  function shrinkParts(parts, target) {
    const tot = parts.reduce((a, p) => a + p.min, 0);
    if (!(tot > target) || tot <= 0) return;
    let left = target;
    if (target < 5 * parts.length) { for (const p of parts) { const m = Math.min(p.min, left); p.min = m; left -= m; } return; }     // 너무 짧으면 앞부분부터 채운다
    parts.forEach((p, i) => {
      const rest = parts.length - 1 - i;
      const m = rest === 0 ? left : Math.max(5, Math.min(P.round5(p.min * target / tot), left - 5 * rest));    // 뒤 부분에 최소 5분씩은 남긴다
      p.min = m; left -= m;
    });
  }

  P.place = function (S, D) {
    const st = S.settings, man = P.manualOf(S, D.date), layout = (S.layout && S.layout[D.date]) || null, entries = [];
    const groups = {};
    const grp = sid => {
      if (!groups[sid]) {
        const sb = P.subj(S, sid);
        groups[sid] = { id: 'st|' + D.date + '|' + sid, kind: 'study', sid, min: 0, hard: !!(sb && sb.hard), order: 0, parts: [] };
        entries.push(groups[sid]);
      }
      return groups[sid];
    };
    for (const it of D.mandatory) {
      if ((it.kind === 'routine' || it.kind === 'review') && it.fixedStart != null) {
        const rid = it.kind === 'routine' ? 'rb' + it.key.slice(2) : 'rr' + it.key.slice(3), ov = man[rid], dur = ov && ov.dur ? ov.dur : it.est;
        const sbj = P.subj(S, it.sid);
        entries.push({ id: rid, kind: 'study', sid: it.sid, min: dur, baseMin: it.est, extra: Math.max(0, dur - it.est), shrunk: Math.max(0, it.est - dur), hard: it.kind === 'review' && !!(sbj && sbj.hard), order: 0, parts: [{ k: it.kind, min: Math.min(it.est, dur), item: it }], spentExam: 0, fixedRoutine: true, fixedStart: it.fixedStart });
        continue;
      }
      const g = grp(it.sid); g.parts.push({ k: it.kind, min: it.est, item: it }); g.min += it.est;
    }
    for (const w of D.work) {
      if (w.todo < 5) continue;
      const j = w.job;
      if (j.kind === 'task') { entries.push({ id: j.id, kind: 'task', sid: j.sid, min: w.todo, planned: w.min, spent: w.sp, hard: false, order: 2, job: j }); continue; }
      const g = grp(j.sid); g.parts.push({ k: j.kind, min: w.todo, job: j, w }); g.min += w.todo;
    }
    const PO = { review: 0, preview: 1, routine: 2, exam: 3, final: 4 };
    for (const g of Object.values(groups)) {
      g.parts.sort((a, b) => PO[a.k] - PO[b.k]);
      g.baseMin = g.min;
      const ov = man[g.id];
      if (ov && ov.dur) {
        g.min = ov.dur;                                              // 직접 정한 길이 (계획보다 줄이는 것도 된다)
        if (g.min < g.baseMin) shrinkParts(g.parts, g.min);          // 줄이면 복습·예습·시험 대비가 비례해서 줄어든다
      }
      g.extra = Math.max(0, g.min - g.baseMin);
      g.shrunk = Math.max(0, g.baseMin - g.min);
      g.spentExam = g.parts.reduce((a, p) => a + (p.w ? p.w.sp : 0), 0);
    }
    for (const c of S.custom || []) {
      if (c.done) continue;
      const carried = !!c.alloc && D.t === 0 && c.date < D.date;               // 못 끝낸 할당은 오늘로 이월
      if (c.date !== D.date && !carried) continue;
      if (c.start == null && !c.alloc) continue;
      entries.push({ id: 'cu|' + c.id, kind: 'custom', sid: '', min: c.dur, hard: false, order: c.alloc ? 1.5 : 4, custom: c, carried, overdue: carried ? P.diffDays(c.date, D.date) : 0 });
    }
    D.customDone = (S.custom || []).filter(c => (c.date === D.date || c.doneDate === D.date) && c.done && c.kind === 'todo');
    for (const e of entries) {
      const ov = man[e.id];
      e.manual = !e.custom && !!ov;
      e.pinStart = e.custom ? (e.carried ? null : e.custom.start) : (ov && ov.start != null ? ov.start : (e.fixedRoutine ? e.fixedStart : null));
      e.frozenStart = (e.pinStart == null && layout && layout[e.id] != null && layout[e.id] >= (D.nowMin || 0)) ? layout[e.id] : null;
      e.pinned = false; e.frozen = false; e.pieces = []; e.unplaced = 0;
    }
    let free = D.blocks.map(([a, b]) => ({ a, b, run: 0 }));
    const taken = [];
    const carve = (e, s) => {
      const f = s + e.min;
      e.pieces.push([s, f]); taken.push([s, f]);
      const nf = [];
      for (const I of free) {
        if (f <= I.a || s >= I.b) { nf.push(I); continue; }
        if (s > I.a) nf.push({ a: I.a, b: s, run: I.run });
        if (f < I.b) nf.push({ a: f, b: I.b, run: 0 });
      }
      free = nf;
    };
    const soft = e => e.fixedRoutine && !(man[e.id] && man[e.id].start != null);
    for (const e of entries) if (e.pinStart != null && !soft(e)) { e.pinned = true; carve(e, e.pinStart); }
    // 시각이 정해진 루틴끼리 겹치면 뒤의 것은 자동 배치로 돌린다
    for (const e of entries.filter(x => x.pinStart != null && soft(x)).sort((a, b) => a.pinStart - b.pinStart)) {
      if (taken.some(([a, b]) => e.pinStart < b && e.pinStart + e.min > a)) { e.pinStart = null; continue; }
      e.pinned = true; carve(e, e.pinStart);
    }
    for (const e of entries.filter(x => x.frozenStart != null).sort((a, b) => a.frozenStart - b.frozenStart)) {
      const s = e.frozenStart, f = s + e.min;
      if (taken.some(([a, b]) => s < b && f > a)) continue;     // 겹치면 이 블록만 자동 배치로
      e.pinned = true; e.frozen = true; carve(e, s);
    }
    const brk = I => (st.breakOn && I.run >= st.focusMin ? st.breakMin : 0);
    const auto = entries.filter(e => !e.pinned)
      .sort((a, b) => (st.hardFirst ? (+b.hard - +a.hard) : 0) || (a.order - b.order));
    for (const e of auto) {
      let rem = e.min;
      for (const I of free) {
        const gap = brk(I);
        if (I.b - I.a >= gap + rem) {
          const s = I.a + gap;
          e.pieces.push([s, s + rem]);
          I.run = (gap ? 0 : I.run) + rem; I.a = s + rem; rem = 0;
          break;
        }
      }
      for (const I of free) {
        if (rem <= 0) break;
        const gap = brk(I), room = I.b - I.a - gap;
        if (room < 5) continue;
        const take = Math.min(rem, room), s = I.a + gap;
        e.pieces.push([s, s + take]);
        I.run = (gap ? 0 : I.run) + take; I.a = s + take; rem -= take;
      }
      e.unplaced = rem;
    }
    entries.sort((a, b) => (a.pieces.length ? a.pieces[0][0] : 1e9) - (b.pieces.length ? b.pieces[0][0] : 1e9));
    D.entries = entries;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  else root.Planner = P;
})(typeof window !== 'undefined' ? window : globalThis);
