/* Ядро тренажёра «Минутка»: состояние, факты блокнота, регистрация этапов, очки, словарь, доступ к Claude.
   Контракт для модулей этапов — _dev/CONTRACT.md. */
'use strict';
(function () {
  const TR = window.TR = window.TR || {};

  // ---------- утилиты ----------
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  TR.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  TR.$ = (sel, root) => (root || document).querySelector(sel);
  TR.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  TR.el = html => { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; };
  TR.on = (root, type, sel, fn) => root.addEventListener(type, e => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
  TR.clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  TR.norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9{}/\-_.:+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  TR.hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  TR.rand = seed => { let a = TR.hash(seed) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  TR.shuffle = (arr, seed) => { const r = TR.rand(seed || 'duty'), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  TR.plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many); };
  TR.fmtRub = kop => (kop / 100).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₽';
  TR.sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- события ----------
  const subs = {};
  TR.sub = (ev, fn) => { (subs[ev] = subs[ev] || []).push(fn); return () => { subs[ev] = subs[ev].filter(f => f !== fn); }; };
  TR.emit = (ev, data) => (subs[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

  // ---------- состояние ----------
  const KEY = 'amp-duty-trainer-v1';
  const fresh = () => ({ v: 1, name: '', group: '', trust: 50, xp: 0, facts: {}, notes: '', stages: {}, decisions: [], log: [], teacher: false, started: null });
  let S = fresh();
  try {
    const hot = window.claude && window.claude.hot && window.claude.hot.data;
    const raw = hot && hot.state ? hot.state : JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.v === 1) S = Object.assign(fresh(), raw);
  } catch (e) { /* хранилище недоступно — работаем в памяти */ }
  TR.S = () => S;
  let saveT = 0;
  TR.save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }, 250); };
  TR.reset = () => { S = fresh(); try { localStorage.removeItem(KEY); } catch (e) { } TR.emit('reset'); TR.emit('hud'); };
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ state: S })); } catch (e) { }

  TR.stageState = id => (S.stages[id] = S.stages[id] || { tasks: {}, visited: null, done: null });
  TR.taskState = (sid, tid) => { const st = TR.stageState(sid); return (st.tasks[tid] = st.tasks[tid] || { ans: null, attempts: 0, ok: false, best: 0, revealed: false, done: false }); };
  TR.teacher = () => !!S.teacher;
  TR.setTeacher = on => { S.teacher = !!on; TR.save(); TR.emit('teacher', S.teacher); };

  // ---------- персонажи ----------
  TR.PEOPLE = {
    lena: { name: 'Лена', role: 'продакт «Минутки», заказчик', ini: 'Л' },
    gosha: { name: 'Гоша', role: 'техлид «Минутки», ваш наставник', ini: 'Г' },
    sasha: { name: 'Саша', role: 'дежурный инженер', ini: 'С' },
    nadya: { name: 'Надя', role: 'старшая смены поддержки', ini: 'Н' },
    vika: { name: 'Вика', role: 'аналитик данных', ini: 'В' },
    me: { name: 'Вы', role: 'системный аналитик команды заказов', ini: 'Я' }
  };

  // ---------- факты блокнота ----------
  TR.FACTS = {};
  TR.TOPICS = [];
  TR.fact = (id, def) => { TR.FACTS[id] = Object.assign({ id }, def); if (def.topic && !TR.TOPICS.includes(def.topic)) TR.TOPICS.push(def.topic); return TR.FACTS[id]; };
  TR.facts = {
    get: id => TR.FACTS[id],
    has: id => !!S.facts[id],
    unlock(id, how) {
      if (!TR.FACTS[id] || S.facts[id]) return false;
      S.facts[id] = { at: Date.now(), how: how || 'ask' };
      TR.save(); TR.emit('fact', id); TR.emit('hud');
      return true;
    },
    lock(id) { delete S.facts[id]; TR.save(); TR.emit('fact', id); TR.emit('hud'); },
    count: () => Object.keys(S.facts).filter(id => TR.FACTS[id]).length,
    all: () => Object.values(TR.FACTS)
  };

  // ---------- этапы ----------
  TR.ACTS = [
    { n: 1, title: 'Начало недели · Увидеть', sub: 'Понедельник и вторник: что болит у дежурных, три сигнала наблюдаемости и логи, по которым находят причину' },
    { n: 2, title: 'Середина недели · Измерить', sub: 'Среда — пятница: метрики и перцентили, дашборды, которые отвечают на вопрос, и трассы, которые показывают, где тормозит' },
    { n: 3, title: 'Выходные · Разбудить вовремя', sub: 'Суббота и воскресенье: алерты по симптомам и бюджету ошибок, требования к наблюдаемости в постановке' }
  ];
  const STAGES = [];
  TR.stage = def => {
    if (!def || !def.id) throw new Error('TR.stage: нужен id');
    if (STAGES.some(s => s.id === def.id)) throw new Error('TR.stage: повтор id ' + def.id);
    def.tasks = def.tasks || [];
    def.tasks.forEach((t, i) => { if (!t.id) t.id = 't' + (i + 1); });
    STAGES.push(def);
    STAGES.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (def.glossary) TR.glossary(def.glossary, def.id);
    TR.emit('stages');
    return def;
  };
  TR.stages = () => STAGES.slice();
  TR.stageById = id => STAGES.find(s => s.id === id) || null;
  // теория — вводные разделы «Как это работает» (id how-*) или подходы с theory: true; в прогресс и зачёт не входят
  TR.isTheory = t => !!(t && (t.theory || /^how-/.test(t.id)));
  TR.practiceTasks = def => def.tasks.filter(t => !TR.isTheory(t));
  TR.stageProgress = id => {
    const def = TR.stageById(id); if (!def) return { done: 0, total: 0, ratio: 0 };
    const st = TR.stageState(id), list = TR.practiceTasks(def);
    const total = list.length, done = list.filter(t => (st.tasks[t.id] || {}).done).length;
    return { done, total, ratio: total ? done / total : 0, score: total ? list.reduce((s, t) => s + ((st.tasks[t.id] || {}).best || 0), 0) / total : 0 };
  };

  // ---------- очки ----------
  TR.score = (dTrust, dXp, reason) => {
    S.trust = Math.max(0, Math.min(100, S.trust + (dTrust || 0)));
    S.xp = Math.max(0, S.xp + (dXp || 0));
    if (reason) S.log.push({ at: Date.now(), t: reason, d: dTrust || 0, x: dXp || 0 });
    if (S.log.length > 400) S.log = S.log.slice(-400);
    TR.save(); TR.emit('hud', { dTrust, dXp, reason });
  };
  TR.decide = (stageId, label, value) => {
    S.decisions = S.decisions.filter(d => !(d.stage === stageId && d.label === label));
    S.decisions.push({ stage: stageId, label, value: String(value), at: Date.now() });
    TR.save();
  };

  // ---------- словарь ----------
  TR.GLOSSARY = [];
  TR.glossary = (list, stageId) => (list || []).forEach(g => {
    if (!g || !g.term) return;
    const ex = TR.GLOSSARY.find(x => TR.norm(x.term) === TR.norm(g.term) && x.stage === (stageId || null));
    if (ex) return;
    TR.GLOSSARY.push(Object.assign({ stage: stageId || null }, g));
  });

  // ---------- Claude (возможность sample) ----------
  let sampleP = null;
  TR.sample = () => {
    if (!sampleP) sampleP = (async () => {
      try { return window.claude && window.claude.use ? (await window.claude.use('sample')) || null : null; } catch (e) { return null; }
    })();
    return sampleP;
  };
  TR.sampleDead = false;
  TR.sampleErr = e => {
    const c = e && e.code;
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)) { TR.sampleDead = true; return 'Claude недоступен в этом окне — работаем без него.'; }
    if (c === 'rate_limited') return 'Слишком много вопросов подряд. Подождите минуту.';
    if (c === 'cancelled') return '';
    if (c === 'session_expired') return 'Сессия истекла — войдите в claude.ai заново.';
    return 'Не получилось получить ответ. Попробуйте ещё раз.';
  };
  let dlP = null;
  TR.downloads = () => {
    if (!dlP) dlP = (async () => { try { return window.claude && window.claude.use ? (await window.claude.use('downloads')) || null : null; } catch (e) { return null; } })();
    return dlP;
  };

  // ---------- код работы для преподавателя ----------
  // Снимок ответов, который преподаватель вставляет в инструмент проверки. Там проверки прогоняются заново
  // по тем же модулям, поэтому «засчитано» в коде — только для сверки, а не на веру.
  // Формат: DTY1.<deflate-raw → base64url>.<контрольная сумма> или DTY0.<base64url без сжатия>.<сумма>.
  // Сумма ловит обрезанный при копировании код, а не подделку: подделать снимок из браузера можно всегда.
  const b64u = bytes => { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = str => { const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  const pipe = async (bytes, Stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'))).arrayBuffer());
  const sum = body => TR.hash('duty:' + body).toString(36);
  TR.workSnapshot = () => {
    const st = {};
    Object.keys(S.stages).forEach(id => {
      const x = S.stages[id], k = {};
      Object.keys(x.tasks || {}).forEach(tid => { const t = x.tasks[tid]; if (!t || (t.ans == null && !t.attempts && !t.done)) return; k[tid] = { a: t.ans, n: t.attempts || 0, ok: !!t.ok, r: !!t.revealed, p: !!t.peek, m: t.miss == null ? null : t.miss, d: !!t.done }; });
      st[id] = { d: x.done || null, k };
    });
    const f = {}; Object.keys(S.facts).forEach(id => { f[id] = S.facts[id].how || 'ask'; });
    return { v: 1, t: 'duty', at: Date.now(), n: S.name || '', g: S.group || '', tr: S.trust, xp: S.xp, f, st, dc: S.decisions.map(d => [d.stage, d.label, d.value]), nt: S.notes || '' };
  };
  TR.workCode = async () => {
    const raw = new TextEncoder().encode(JSON.stringify(TR.workSnapshot()));
    if (typeof CompressionStream === 'function') { try { const body = b64u(await pipe(raw, CompressionStream)); return 'DTY1.' + body + '.' + sum(body); } catch (e) { } }
    const body = b64u(raw); return 'DTY0.' + body + '.' + sum(body);
  };
  // Найти и прочитать все коды в тексте (отчёт целиком, несколько отчётов подряд, один код).
  TR.readWorkCodes = async text => {
    const found = String(text || '').match(/DTY[01]\.[A-Za-z0-9_-]+\.[a-z0-9]+/g) || [];
    const out = [];
    for (const code of found) {
      const [ver, body, chk] = code.split('.');
      if (sum(body) !== chk) { out.push({ code, error: 'код повреждён: обрезан или изменён при копировании' }); continue; }
      try {
        let bytes = unb64u(body);
        if (ver === 'DTY1') bytes = await pipe(bytes, DecompressionStream);
        const snap = JSON.parse(new TextDecoder().decode(bytes));
        if (!snap || snap.t !== 'duty' || snap.v !== 1) throw new Error('это не код «Дежурства»');
        out.push({ code, snap });
      } catch (e) { out.push({ code, error: 'не читается: ' + (e.message || e) }); }
    }
    return out;
  };

  TR.go = id => TR.emit('go', id);
})();
