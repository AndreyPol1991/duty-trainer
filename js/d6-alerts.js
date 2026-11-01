/* День 6 · Суббота. Алерты и SLO: бюджет ошибок, скорость сгорания, шумные алерты, правило «будить по симптомам».
   Ключ преподавателя — _dev/KEY.md, раздел «Суббота». */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc, O = TR.obs;
  const ID = 'alerts';

  document.head.insertAdjacentHTML('beforeend', `<style>
  .al-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .al-stat{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);min-width:0}
  .al-stat span{display:block;font-size:12px;color:var(--text-muted)}.al-stat b{font:700 20px/1.2 var(--f-brand);font-variant-numeric:tabular-nums}
  .al-stat.bad b{color:var(--bad)}.al-stat.ok b{color:var(--ok)}
  .al-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
  .al-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
  .al-f{display:grid;gap:4px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface)}
  .al-f.ok{border-color:var(--ok);background:var(--ok-soft)}.al-f.bad{border-color:var(--bad);background:var(--bad-soft)}
  .al-f label{font-size:13px;color:var(--text-2)}
  @media (max-width:640px){.al-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
  </style>`);

  // Сутки доли неуспешных оплат по 5 минут: шумовые всплески, медленное сгорание, настоящий инцидент.
  const DAY = (() => {
    const r = TR.rand('al-day'), n = 288, d = [];
    for (let i = 0; i < n; i++) {
      let v = 0.15 + r() * 0.25;
      if ([31, 77, 140, 203, 251].includes(i)) v = 3 + r() * 2.5;                 // всплеск на одну точку: сеть моргнула
      if (i >= 168 && i < 175) v = 13 + r() * 3;                                    // 14:00–14:35 — понедельник
      if (i >= 216 && i < 252) v = 1.1 + r() * 0.5;                                 // 18:00–21:00 — медленное сгорание
      d.push(Math.round(v * 100) / 100);
    }
    return d;
  })();
  const DAY_LAB = Array.from({ length: 288 }, (_, i) => String(Math.floor(i / 12)).padStart(2, '0') + ':' + String(i % 12 * 5).padStart(2, '0'));
  const REAL = [{ from: 168, to: 175, t: 'инцидент 14:00' }, { from: 216, to: 252, t: 'сгорание 18:00–21:00' }];
  /** Прогон правила по суткам: сколько раз сработало, сколько из них по делу, через сколько поймали инцидент. */
  function simulate(thr, forPts) {
    let run = 0, firing = false;
    const fires = [];
    DAY.forEach((v, i) => { if (v > thr) run++; else run = 0; const now = run > forPts; if (now && !firing) fires.push(i); firing = now; });
    const real = fires.filter(i => REAL.some(x => i >= x.from && i < x.to + 2));
    const caught = REAL.map(x => { const f = fires.find(i => i >= x.from && i < x.to + 2); return f == null ? null : (f - x.from) * 5; });
    return { fires, real: real.length, noise: fires.length - real.length, caught };
  }

  // =====================================================================
  // Теория 1. SLO и бюджет ошибок
  const PER_DAY = 20000;
  const howSlo = {
    id: 'how-slo', title: 'Как это работает: SLO и бюджет ошибок', covers: ['budget', 'rule'], free: true, noReset: true,
    simple: { icon: '💰', plain: 'SLO — обещание: «за 30 дней не больше 0,5 % неуспешных оплат». Всё, что ниже, — бюджет ошибок: сколько сбоев можно себе позволить. Тратится он на инциденты и рискованные выкатки. Важно не только сколько потратили, но и как быстро тратим: если бюджет месяца сгорит за сутки — будить людей надо сейчас.', analogy: 'Бюджет на такси на месяц. Потратить сто рублей — нормально. Потратить за один вечер треть месячного бюджета — повод остановиться и разобраться, даже если в кошельке ещё есть деньги.', tech: 'SLI (доля успешных событий) → SLO (цель за окно, например 99,5 % за 30 дней) → error budget (1 − SLO). Burn rate — во сколько раз текущая доля ошибок выше допустимой: 1 = бюджет кончится ровно к концу окна. Google SRE Workbook: алертить по burn rate в двух окнах (например, 14,4× за 1 час и 6× за 6 часов).' },
    lead: ui.brief({ situation: `Лена в понедельник сказала: не больше 0,5 % сбоев оплаты за 30 дней. Оплат в обычный день — около ${O.fmt(PER_DAY)}.`, todo: ['Двигайте SLO и долю ошибок «сейчас».', 'Смотрите на бюджет и на то, за сколько он сгорит.'], look: 'Сколько стоит одна девятка и что значит скорость сгорания 27.' }),
    render(el, ctx) {
      const a = ctx.ans; a.slo = a.slo || 99.5; a.err = a.err == null ? 13.5 : a.err;
      const month = PER_DAY * 30, budget = Math.round(month * (100 - a.slo) / 100), burn = a.err / (100 - a.slo), hours = burn > 0 ? 30 * 24 / burn : Infinity;
      el.innerHTML = `<div class="stack"><div class="al-ctl"><label class="field"><span>SLO: <b class="tnum">${a.slo} %</b> успешных за 30 дней</span><input type="range" min="0" max="3" step="1" value="${[99, 99.5, 99.9, 99.99].indexOf(a.slo)}" data-slo ${ctx.readonly ? 'disabled' : ''}></label>
        <label class="field"><span>Доля неуспешных сейчас: <b class="tnum">${a.err} %</b></span><input type="range" min="0" max="20" step="0.5" value="${a.err}" data-err ${ctx.readonly ? 'disabled' : ''}></label></div>
        <div class="al-stats"><div class="al-stat"><span>Оплат за 30 дней</span><b>${O.fmt(month)}</b></div><div class="al-stat"><span>Бюджет ошибок</span><b>${O.fmt(budget)}</b></div><div class="al-stat ${burn > 6 ? 'bad' : burn > 1 ? '' : 'ok'}"><span>Скорость сгорания</span><b>${burn.toFixed(1)}×</b></div><div class="al-stat ${hours < 72 ? 'bad' : 'ok'}"><span>Бюджет месяца кончится через</span><b>${hours === Infinity ? '—' : hours < 48 ? hours.toFixed(1) + ' ч' : (hours / 24).toFixed(1) + ' дн'}</b></div></div>
        <p class="small">${burn <= 1 ? 'Скорость сгорания не больше 1 — к концу месяца бюджет как раз уложится. Будить никого не нужно.' : burn < 6 ? 'Тратим быстрее нормы, но не катастрофично: это задача на рабочий день, а не ночной звонок.' : 'Бюджет горит так быстро, что к утру его не останется. Это повод будить дежурного прямо сейчас.'} Каждая девятка в SLO уменьшает бюджет в десять раз: 99,9 % — это всего ${O.fmt(Math.round(month * 0.001))} сбоев на месяц.</p></div>`;
      el.addEventListener('input', e => { if (e.target.matches('[data-slo]')) a.slo = [99, 99.5, 99.9, 99.99][+e.target.value]; if (e.target.matches('[data-err]')) a.err = +e.target.value; a.moved = (a.moved || 0) + 1; ctx.save(); ctx.rerender(); });
      if ((a.moved || 0) >= 2 || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Теория 2. Редактор алерта
  const howAlert = {
    id: 'how-alert', title: 'Как это работает: порог и «держится N минут»', covers: ['noisy', 'rule'], free: true, noReset: true,
    simple: { icon: '🚨', plain: 'Алерт — правило: «если доля ошибок выше порога и держится дольше N минут — позвонить дежурному». Порог слишком низкий — звонит от каждого моргания сети. Окно «держится» слишком длинное — настоящий инцидент поймают через час. Хороший алерт будит редко и всегда по делу.', analogy: 'Пожарная сигнализация, которая срабатывает от тостера, через месяц оказывается заклеенной. Сигнализация, которая ждёт полчаса «убедиться», — бесполезна.', tech: 'Prometheus alerting rule: expr (условие), for (сколько условие должно держаться, состояние pending → firing), labels (severity), annotations (summary, runbook_url). Alertmanager маршрутизирует: page (звонок) или ticket (чат/задача), группирует и подавляет дубли.' },
    lead: ui.brief({ situation: 'Сутки доли неуспешных оплат, точка — 5 минут. В них пять случайных всплесков на одну точку, инцидент в 14:00 и медленное сгорание вечером с 18:00 до 21:00.', todo: ['Двигайте порог и «держится».', 'Добейтесь, чтобы оба настоящих случая ловились, а ложных срабатываний было не больше одного.'], look: 'Розовые полосы на графике — настоящие проблемы. Красные точки — когда алерт сработал.' }),
    render(el, ctx) {
      const a = ctx.ans; a.thr = a.thr == null ? 1 : a.thr; a.for = a.for == null ? 0 : a.for;
      const sim = simulate(a.thr, a.for);
      el.innerHTML = `<div class="stack"><div class="al-ctl"><label class="field"><span>Порог: доля неуспешных больше <b class="tnum">${a.thr} %</b></span><input type="range" min="0.5" max="10" step="0.5" value="${a.thr}" data-thr ${ctx.readonly ? 'disabled' : ''}></label>
        <label class="field"><span>Держится дольше: <b class="tnum">${a.for * 5} мин</b></span><input type="range" min="0" max="12" step="1" value="${a.for}" data-for ${ctx.readonly ? 'disabled' : ''}></label></div>
        ${dayChart(a.thr, sim)}
        ${statsOf(sim)}</div>`;
      O.hover(el);
      el.addEventListener('input', e => { if (e.target.matches('[data-thr]')) a.thr = +e.target.value; if (e.target.matches('[data-for]')) a.for = +e.target.value; ctx.save(); ctx.rerender(); });
      if ((sim.caught.every(x => x != null) && sim.noise <= 1) || ctx.readonly) ctx.ready();
    }
  };
  function dayChart(thr, sim) {
    const html = O.chart({ series: [{ name: 'неуспешные, %', color: 'var(--info)', data: DAY }], labels: DAY_LAB, thresholds: [{ v: thr, label: 'порог ' + thr + ' %' }], yMax: 18, height: 190, yFmt: v => v.toFixed(1) + ' %', aria: 'Доля неуспешных оплат за сутки' });
    const W = 640, L = 44, R = 10, n = DAY.length, x = i => L + i / (n - 1) * (W - L - R);
    const marks = REAL.map(b => `<rect x="${x(b.from).toFixed(1)}" y="10" width="${(x(b.to) - x(b.from)).toFixed(1)}" height="158" style="fill:var(--pink);opacity:.14"/>`).join('') + sim.fires.map(i => `<circle cx="${x(i).toFixed(1)}" cy="16" r="5" style="fill:var(--bad)"><title>сработал в ${DAY_LAB[i]}</title></circle>`).join('');
    return O.panel('Доля неуспешных оплат за сутки, %', html.replace('<path ', marks + '<path '), { wide: true, sub: 'наведите курсор' });
  }
  const statsOf = sim => `<div class="al-stats"><div class="al-stat"><span>Сработал раз за сутки</span><b>${sim.fires.length}</b></div><div class="al-stat ${sim.noise > 1 ? 'bad' : 'ok'}"><span>Ложных</span><b>${sim.noise}</b></div><div class="al-stat ${sim.caught[0] == null ? 'bad' : 'ok'}"><span>Инцидент 14:00 пойман через</span><b>${sim.caught[0] == null ? 'не пойман' : sim.caught[0] + ' мин'}</b></div><div class="al-stat ${sim.caught[1] == null ? 'bad' : 'ok'}"><span>Сгорание 18:00 поймано через</span><b>${sim.caught[1] == null ? 'не поймано' : sim.caught[1] + ' мин'}</b></div></div>`;

  // =====================================================================
  // Практика 1. Разобрать шумные алерты
  const NOISY = [
    { id: 'a1', t: 'Доля неуспешных оплат больше 2 % дольше 5 минут', ok: 'page', because: 'Симптом, который чувствуют клиенты прямо сейчас, и дежурный может действовать: откатить, переключить. Это ровно тот алерт, который проспали в понедельник.' },
    { id: 'a2', t: 'p95 оплаты дольше 2 секунд в течение 10 минут', ok: 'page', because: 'Нарушается требование Лены «две секунды у 95 %» — клиенты бросают корзины. Симптом, по которому надо действовать сейчас.' },
    { id: 'a3', t: 'Диск сервера логов заполнится через 4 часа (по прогнозу)', ok: 'page', because: 'Пока всё работает, но через четыре часа логи перестанут писаться, а ночью никто не почистит. Прогноз исчерпания — редкое исключение «будить по причине»: действовать надо до того, как станет поздно.' },
    { id: 'a4', t: 'Загрузка CPU любого пода выше 80 %', ok: 'drop', because: 'Это причина, а не симптом: под может работать на 90 % и отвечать быстро. Если клиентам плохо, сработает алерт по ошибкам или времени, а CPU — на дашборде для разбора.' },
    { id: 'a5', t: 'Под перезапустился', ok: 'drop', because: 'Kubernetes перезапускает поды сам, клиенты этого не замечают. Если перезапуски бьют по клиентам, это увидят алерты по симптомам.' },
    { id: 'a6', t: 'В любом логе появилась строка ERROR', ok: 'drop', because: 'Единичная ошибка бывает всегда, и раньше сюда же попадали отказы банка. Это шум: считают долю ошибок, а не отдельные строки.' },
    { id: 'a7', t: 'Диск сервера логов заполнен на 85 %', ok: 'ticket', because: 'Ещё есть время — нужна задача в рабочие часы, а не ночной звонок. Если начнёт заканчиваться быстро, сработает прогноз (a3).' },
    { id: 'a8', t: 'Аналитика отстаёт от событий больше чем на 10 минут', ok: 'ticket', because: 'Аналитике нужен отчёт к 9 утра — отставание ночью клиентов не задевает. Сообщение в рабочий чат команды, а будить — только если к утру не догонит.' }
  ];
  const ACTS = [{ v: 'page', t: 'Будить дежурного' }, { v: 'ticket', t: 'Задача в рабочие часы' }, { v: 'drop', t: 'Удалить, оставить на дашборде' }];
  const ACT_WHY = {
    page: 'будят только по симптому, который чувствуют клиенты прямо сейчас и с которым дежурный может что-то сделать',
    ticket: 'задача в рабочие часы — для того, что может подождать до утра, но требует действия',
    drop: 'удаляют то, что не требует действия человека или не говорит о клиентах'
  };
  const noisy = {
    id: 'noisy', title: 'Разберите алерты, которые Саша выключил',
    lead: ui.brief({ situation: 'Из двухсот алертов в сутки Саша выключил половину. Среди выключенных был и тот, что должен был разбудить его в понедельник.', todo: ['Для каждого алерта выберите, что с ним делать.', 'Нажмите «Проверить». Засчитывается от семи верных из восьми.'], look: 'Что Саша сказал про ночь (блокнот): будить, только если клиенты страдают прямо сейчас.' }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(NOISY.map(r => [r.id, r.ok])) }),
    render(el, ctx) {
      const a = ctx.ans; a.m = a.m || {};
      let rv = null;
      if (ctx.result || ctx.readonly) { rv = {}; NOISY.forEach(r => { const g = a.m[r.id]; if (g) rv[r.id] = { s: g === r.ok ? 'ok' : 'bad', why: '' }; }); }
      ui.match(el, { rows: NOISY.map(r => ({ id: r.id, t: esc(r.t) })), choices: ACTS, value: a.m, reveal: rv, readonly: ctx.readonly, placeholder: 'Что делать…', onChange: v => { a.m = v; ctx.save(); } });
    },
    check(ans) {
      const m = ans.m || {}, good = NOISY.filter(r => m[r.id] === r.ok).length, notes = [];
      const empty = NOISY.filter(r => !m[r.id]).length;
      if (empty) notes.push({ ok: false, html: `Без решения: ${empty}.` });
      if (m.a1 && m.a1 !== 'page') notes.push({ ok: false, html: 'Доля неуспешных оплат — главный симптом. Его проспали в понедельник.' });
      NOISY.forEach(r => { const g = m[r.id]; if (g && g !== r.ok && r.id !== 'a1') notes.push({ ok: 'warn', html: `«${esc(r.t)}»: ${esc(ACT_WHY[g])}.` }); });
      const pages = NOISY.filter(r => m[r.id] === 'page' && r.ok !== 'page').length;
      return { ok: good >= 7 && m.a1 === 'page', score: good / NOISY.length, notes, summary: `Верно ${good} из ${NOISY.length}.${pages ? ` Будить по лишним: ${pages}.` : ''}` };
    },
    flags: ans => { const m = ans.m || {}, f = []; if (m.a4 === 'page' || m.a6 === 'page') f.push('Будит дежурного по причине (CPU, строка ERROR), а не по симптому'); if (m.a1 && m.a1 !== 'page') f.push('Не будит по доле неуспешных оплат'); return f; },
    answers: ans => ui.matchAnswers(NOISY, ACTS, ans.m, (r, g) => ui.cap(ACT_WHY[g]) + '.'),
    viz: (el, ans) => {
      // Ночь дежурного с вашими настройками: сколько раз позвонят и по какому поводу.
      const m = ans.m || {};
      const PER_NIGHT = { a1: 0, a2: 0, a3: 0, a4: 14, a5: 6, a6: 48, a7: 1, a8: 2 };
      const night = NOISY.map(x => ({ x, n: PER_NIGHT[x.id], act: m[x.id] || '—' }));
      const calls = night.filter(z => z.act === 'page').reduce((s, z) => s + z.n, 0);
      el.innerHTML = `<div class="stack"><p class="small">Обычная ночь без инцидентов, с 00:00 до 08:00. Сколько раз срабатывает каждый алерт — и что получит Саша при ваших решениях.</p>
        ${ui.table(['Алерт', 'Срабатываний за ночь', 'Ваше решение', 'Звонков Саше'], night.map(z => [esc(z.x.t), String(z.n), esc(((ACTS.find(a => a.v === z.act) || {}).t) || 'не решено'), z.act === 'page' ? `<b style="color:${z.n ? 'var(--bad)' : 'var(--ok)'}">${z.n}</b>` : '0']))}
        <div class="al-stats"><div class="al-stat ${calls > 2 ? 'bad' : 'ok'}"><span>Звонков за спокойную ночь</span><b>${calls}</b></div><div class="al-stat ${m.a1 === 'page' ? 'ok' : 'bad'}"><span>Понедельник 14:05 разбудит?</span><b>${m.a1 === 'page' ? 'да, через 5 мин' : 'нет'}</b></div></div>
        <p class="small">${calls > 2 ? 'Спокойной ночью Саша получит ' + calls + ' звонков — через неделю он снова начнёт выключать алерты.' : 'Спокойной ночью — ни одного звонка. Значит, если позвонили, — это всерьёз.'} </p></div>`;
    },
    explain: '<p>Правило: <b>будить по симптомам, по причинам — разбирать</b>. Симптом — то, что чувствует клиент: ошибки, долгое ожидание, недоступность. Причина — CPU, перезапуск, строка в логе: они нужны на дашборде, чтобы понять «почему», но звонок по ним учит дежурного игнорировать звонки. Каждый алерт должен требовать действия и вести к инструкции (runbook). Исключение — прогноз исчерпания ресурса, когда к утру станет поздно.</p>',
    report: ans => NOISY.map(r => `- ${r.t} → ${((ACTS.find(a => a.v === (ans.m || {})[r.id]) || {}).t) || '—'} ${(ans.m || {})[r.id] === r.ok ? '✓' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 2. Бюджет ошибок в числах
  const ERR_NOW = 13.5;
  const BUD = [
    { id: 'budget', t: 'Бюджет ошибок на 30 дней, неуспешных оплат', ok: PER_DAY * 30 * 0.005, tol: 0, show: O.fmt(PER_DAY * 30 * 0.005), because: `${O.fmt(PER_DAY)} оплат в день × 30 дней = ${O.fmt(PER_DAY * 30)}; 0,5 % от них = ${O.fmt(PER_DAY * 30 * 0.005)}. Столько сбоев оплаты можно себе позволить за месяц.` },
    { id: 'burn', t: 'Скорость сгорания в понедельник (доля неуспешных 13,5 %)', ok: ERR_NOW / 0.5, tol: 0.5, show: String(ERR_NOW / 0.5), because: 'Доля ошибок сейчас ÷ допустимая доля: 13,5 % ÷ 0,5 % = 27. Тратим бюджет в 27 раз быстрее, чем можно.' },
    { id: 'hours', t: 'Через сколько часов кончится бюджет месяца при такой скорости', ok: 30 * 24 / (ERR_NOW / 0.5), tol: 1.5, show: (30 * 24 / (ERR_NOW / 0.5)).toFixed(1), because: '30 дней × 24 часа = 720 часов; 720 ÷ 27 ≈ 26,7 часа. Бюджет на месяц сгорел бы за сутки с небольшим — поэтому будить нужно сразу, а не утром.' }
  ];
  const parseNum = v => { const s = String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'); return s === '' ? NaN : +s; };
  const budOk = (r, v) => { const x = parseNum(v); return !isNaN(x) && Math.abs(x - r.ok) <= r.tol; };
  const budget = {
    id: 'budget', title: 'Посчитайте бюджет ошибок и скорость сгорания',
    lead: ui.brief({ situation: `Гоша: «Перед тем как писать алерты, посчитай, что мы обещали Лене и как быстро понедельник это сжигал». Оплат в обычный день — около ${O.fmt(PER_DAY)}.`, todo: ['Посчитайте три числа.', 'Нажмите «Проверить».'], look: 'Порог сбоев из блокнота (что Лена считает бедой) и лаборатория «SLO и бюджет ошибок».' }),
    blank: () => ({ n: {} }),
    reference: () => ({ n: { budget: '3000', burn: '27', hours: '26.7' } }),
    render(el, ctx) {
      const a = ctx.ans; a.n = a.n || {};
      const judged = !!(ctx.result || ctx.readonly), has = TR.facts.has('F-slo') || ctx.readonly;
      el.innerHTML = `<div class="stack">${has ? ui.note('info', 'Из блокнота', esc(TR.FACTS['F-slo'].text)) : ui.note('warn', 'Порога в блокноте нет', 'Вы не спросили Лену, что считать бедой. Нажмите плашку «Что считать бедой: не выяснено» над заданиями, чтобы уточнить.')}
        <div class="al-form">${BUD.map(r => `<div class="al-f ${judged && a.n[r.id] ? (budOk(r, a.n[r.id]) ? 'ok' : 'bad') : ''}"><label for="bd-${r.id}">${esc(r.t)}</label><input id="bd-${r.id}" type="text" inputmode="decimal" data-n="${r.id}" value="${esc(a.n[r.id] || '')}" placeholder="число" ${ctx.readonly ? 'readonly' : ''}></div>`).join('')}</div></div>`;
      el.addEventListener('input', e => { const k = e.target.dataset.n; if (!k) return; a.n[k] = e.target.value; e.target.closest('.al-f').classList.remove('ok', 'bad'); ctx.save(); });
    },
    check(ans) {
      const n = ans.n || {}, res = BUD.map(r => budOk(r, n[r.id])), notes = [];
      if (!res[0]) notes.push({ ok: false, html: 'Бюджет: оплат за 30 дней × 0,5 %.' });
      if (!res[1]) notes.push({ ok: false, html: 'Скорость сгорания: доля ошибок сейчас ÷ допустимая доля.' });
      if (!res[2]) notes.push({ ok: false, html: 'Часы: 30 дней в часах ÷ скорость сгорания.' });
      return { ok: res.every(Boolean), score: res.filter(Boolean).length / 3, notes, summary: `Верно ${res.filter(Boolean).length} из 3.` };
    },
    answers: ans => BUD.map(r => ({ q: r.t, mine: (ans.n || {})[r.id] || '', right: r.show, ok: budOk(r, (ans.n || {})[r.id]), why: r.because })),
    viz: (el) => {
      // Как тает бюджет месяца: понедельник при 2.30 и при 2.31 без отката.
      const st = { hours: 3 };
      const draw = () => {
        const total = PER_DAY * 30 * 0.005, perHour = PER_DAY / 24 * ERR_NOW / 100, n = 31;
        const left = Array.from({ length: n }, (_, h) => Math.max(0, Math.round(total - perHour * Math.min(h, st.hours))));
        const noFix = Array.from({ length: n }, (_, h) => Math.max(0, Math.round(total - perHour * h)));
        el.innerHTML = `<div class="stack"><label class="field"><span>Через сколько часов откатили: <b class="tnum">${st.hours}</b></span><input type="range" min="0" max="30" step="1" value="${st.hours}" data-h></label>
          ${O.panel('Осталось бюджета ошибок на месяц, сбоев', O.chart({ series: [{ name: 'с откатом через ' + st.hours + ' ч', color: 'var(--ok)', data: left }, { name: 'без отката', color: 'var(--bad)', data: noFix }], labels: Array.from({ length: n }, (_, h) => h + ' ч'), yFmt: v => O.fmt(Math.round(v)) }), { wide: true })}
          <p class="small">Без отката бюджет месяца кончается примерно через 27 часов. Откат через ${st.hours} ч оставляет ${O.fmt(left[n - 1])} из ${O.fmt(total)} — ${Math.round(left[n - 1] / total * 100)} %. Двигайте ползунок: каждый час промедления — это ${Math.round(perHour)} неуспешных оплат.</p></div>`;
        O.hover(el);
      };
      el.addEventListener('input', e => { if (e.target.matches('[data-h]')) { st.hours = +e.target.value; draw(); } });
      draw();
    },
    explain: '<p>Бюджет ошибок превращает «надёжно» в число, о котором можно договориться. Пока бюджет есть — команда выкатывается смело; кончился — выкатки только с исправлениями. <b>Скорость сгорания</b> решает, кого будить: 27× — сгорит за сутки, будить сейчас; 2× — задача на утро. Отсюда правило алерта: будить, когда сгорание быстрое и держится несколько минут.</p>',
    report: ans => BUD.map(r => `${r.t}: ${(ans.n || {})[r.id] || '—'}`).join('\n')
  };

  // =====================================================================
  // Практика 3. Правило алерта
  const RF = [
    { id: 'what', t: 'Что измеряем', o: ['долю неуспешных оплат (SLI)', 'загрузку CPU подов payment', 'число строк ERROR в логах'], ok: 'долю неуспешных оплат (SLI)', because: 'Симптом, который чувствует клиент и который входит в обещание Лене. CPU и строки ERROR — причины и шум.' },
    { id: 'win', t: 'За какое окно считаем', o: ['за последние 5 минут', 'за последние сутки', 'за последние 30 дней'], ok: 'за последние 5 минут', because: 'Короткое окно реагирует за минуты. Сутки и месяц сгладят инцидент: в понедельник 35 минут сбоев дали бы за сутки меньше процента.' },
    { id: 'thr', t: 'Порог', o: ['больше 2 % (сгорание в 4 раза быстрее нормы)', 'больше 0 %', 'больше 50 %'], ok: 'больше 2 % (сгорание в 4 раза быстрее нормы)', because: 'Норма — 0,5 %. Порог 2 % — сгорание в четыре раза быстрее допустимого: это уже не случайность. Больше нуля — звонок от каждого единичного сбоя; 50 % — когда уже всё лежит.' },
    { id: 'for', t: 'Сколько должно держаться', o: ['5 минут', 'сразу, с первой точки', '1 час'], ok: '5 минут', because: 'Пять минут отсекают одиночные всплески сети — их в сутках пять, — и инцидент всё равно ловится через считаные минуты. Час — потерянные клиенты.' },
    { id: 'to', t: 'Куда', o: ['звонок дежурному', 'сообщение в чат команды', 'письмо раз в день'], ok: 'звонок дежурному', because: 'Клиенты не могут заплатить прямо сейчас — это повод разбудить. Чат ночью никто не читает.' },
    { id: 'att', t: 'Что приложить к алерту', o: ['ссылку на дашборд «Оплата» и инструкцию: проверить выкатку, откатить', 'ничего, дежурный разберётся', 'весь лог оплаты за час'], ok: 'ссылку на дашборд «Оплата» и инструкцию: проверить выкатку, откатить', because: 'В три часа ночи человек должен за минуту понять, что делать. Ссылка на дашборд и короткая инструкция (runbook) — часть алерта, а не пожелание.' }
  ];
  const ruleOf = v => ({ thr: v.thr === RF[2].ok ? 2 : v.thr === RF[2].o[1] ? 0.01 : v.thr === RF[2].o[2] ? 50 : 2, forPts: v.for === RF[3].ok ? 1 : v.for === RF[3].o[1] ? 0 : v.for === RF[3].o[2] ? 12 : 1 });
  const rule = {
    id: 'rule', title: 'Соберите алерт «оплата не проходит»',
    lead: ui.brief({ situation: 'Последний шаг недели — алерт, который разбудил бы Сашу в понедельник в 14:10, а спокойной ночью молчал бы.', todo: ['Заполните шесть частей правила.', 'Нажмите «Проверить». Засчитывается, когда все шесть верны.'], look: 'Лаборатории «SLO и бюджет ошибок» и «Порог и „держится N минут“».' }),
    blank: () => ({ v: {} }),
    reference: () => ({ v: Object.fromEntries(RF.map(r => [r.id, r.ok])) }),
    render(el, ctx) {
      const a = ctx.ans; a.v = a.v || {};
      const judged = !!(ctx.result || ctx.readonly);
      el.innerHTML = `<div class="al-form">${RF.map(r => `<div class="al-f ${judged && a.v[r.id] ? (a.v[r.id] === r.ok ? 'ok' : 'bad') : ''}"><label for="rf-${r.id}">${esc(r.t)}</label><select id="rf-${r.id}" data-r="${r.id}" ${ctx.readonly ? 'disabled' : ''}><option value="">Выберите…</option>${r.o.map(o => `<option ${a.v[r.id] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`).join('')}</div>
        <div class="gf-q" style="margin-top:10px" data-yaml></div>`;
      const yaml = () => { const v = a.v; TR.$('[data-yaml]', el).textContent = `- alert: PaymentsFailing\n  expr: ${v.what === RF[0].ok ? 'sum(rate(payments_total{status="fail"}[' + (v.win === RF[1].o[1] ? '1d' : v.win === RF[1].o[2] ? '30d' : '5m') + '])) / sum(rate(payments_total[…]))' : v.what === RF[0].o[1] ? 'avg(cpu_usage{service="payment"})' : v.what ? 'sum(increase(log_lines{level="ERROR"}[5m]))' : '…'} > ${v.thr === RF[2].ok ? '0.02' : v.thr === RF[2].o[1] ? '0' : v.thr === RF[2].o[2] ? '0.5' : '…'}\n  for: ${v.for === RF[3].ok ? '5m' : v.for === RF[3].o[1] ? '0m' : v.for === RF[3].o[2] ? '1h' : '…'}\n  labels: { severity: ${v.to === RF[4].ok ? 'page' : v.to ? 'ticket' : '…'} }\n  annotations:\n    summary: Не проходит больше 2 % оплат\n    runbook_url: ${v.att === RF[5].ok ? 'https://wiki.minutka/runbooks/payments' : '—'}`; };
      yaml();
      el.addEventListener('change', e => { const r = e.target.dataset.r; if (!r) return; if (e.target.value) a.v[r] = e.target.value; else delete a.v[r]; e.target.closest('.al-f').classList.remove('ok', 'bad'); ctx.save(); yaml(); });
    },
    check(ans) {
      const v = ans.v || {}, good = RF.filter(r => v[r.id] === r.ok).length, notes = [];
      RF.forEach(r => { if (!v[r.id]) notes.push({ ok: false, html: `«${esc(r.t)}» — не выбрано.` }); else if (v[r.id] !== r.ok) notes.push({ ok: false, html: `«${esc(r.t)}»: ${esc(r.because)}` }); });
      return { ok: good === RF.length, score: good / RF.length, notes, summary: `Верно ${good} из ${RF.length}.` };
    },
    answers: ans => RF.map(r => ({ q: r.t, mine: (ans.v || {})[r.id] || '', right: r.ok, ok: (ans.v || {})[r.id] === r.ok, why: r.because })),
    viz: (el, ans) => {
      // Ваше правило против суток: сработает ли в понедельник и сколько раз зря.
      const v = ans.v || {}, mine = ruleOf(v), good = ruleOf(Object.fromEntries(RF.map(r => [r.id, r.ok])));
      const own = v.what === RF[0].ok && v.win === RF[1].ok;
      const sim = own ? simulate(mine.thr, mine.forPts) : { fires: [], real: 0, noise: 0, caught: [null, null] };
      const right = simulate(good.thr, good.forPts);
      el.innerHTML = `<p class="small">${own ? 'Ваше правило на тех же сутках:' : 'Ваше правило меряет не долю неуспешных оплат за 5 минут — на этих сутках оно просто не про то. Вот как работает верное:'}</p>`
        + dayChart(own ? mine.thr : good.thr, own ? sim : right) + statsOf(own ? sim : right)
        + '<p class="small">Медленное сгорание с 18:00 (1–1,5 %) этот алерт не ловит — и не должен: клиентам почти не больно, будить незачем. Его ловит второй алерт — «бюджет месяца потрачен на 50 %» → задача команде утром. Два уровня вместе и есть двухоконная схема из SRE Workbook.</p>';
      O.hover(el);
    },
    explain: '<p>Хороший алерт отвечает на пять вопросов: <b>что</b> (симптом из SLO), <b>за какое окно</b> (минуты, а не сутки), <b>какой порог</b> (быстрое сгорание бюджета, а не «больше нуля»), <b>сколько держится</b> (отсечь моргания), <b>кому и с чем</b> (звонок дежурному + дашборд + инструкция). Взрослая версия — два окна по скорости сгорания: 14,4× за час (звонок) и 6× за 6 часов (задача). Это ловит и резкий инцидент, и медленное сгорание вечера.</p>',
    report: ans => RF.map(r => `- ${r.t}: ${(ans.v || {})[r.id] || '—'}`).join('\n')
  };

  TR.stage({
    id: ID, act: 3, order: 60, slot: 'Сб', title: 'Алерты и бюджет ошибок',
    when: 'суббота · разбираем, кого и когда будить',
    intro: [
      { who: 'sasha', html: 'Честно: я выключил половину алертов, потому что спать было нельзя. И в понедельник проспал настоящий. Давайте сделаем так, чтобы звонили редко, но всегда по делу.' },
      { who: 'gosha', html: 'Начнём с обещания Лене — бюджета ошибок. От него считается, когда тревога стоит звонка. Потом разберём старые алерты и соберём один правильный.' }
    ],
    facts: ['F-slo', 'F-night', 'F-noise'],
    glossary: [
      { term: 'SLO', simple: 'Обещание о надёжности: «не больше 0,5 % сбоев за 30 дней».', tech: 'Service Level Objective: целевое значение SLI за окно. Внутренняя цель команды; SLA — договорное обязательство с последствиями.' },
      { term: 'Бюджет ошибок', simple: 'Сколько сбоев можно себе позволить по SLO.', tech: 'Error budget = (1 − SLO) × число событий за окно. Тратится на инциденты и риск выкаток; политика бюджета решает, что делать, когда он кончается.' },
      { term: 'Скорость сгорания', simple: 'Во сколько раз быстрее нормы тратим бюджет.', tech: 'Burn rate = доля ошибок ÷ (1 − SLO). 1× — бюджет кончится ровно к концу окна. Алерты по burn rate в двух окнах — подход Google SRE Workbook.' },
      { term: 'Алерт', simple: 'Правило: если плохо и держится — сообщить человеку.', tech: 'Alerting rule (Prometheus/Grafana): expr, for, labels (severity), annotations (summary, runbook_url); маршрутизация — Alertmanager.' },
      { term: 'Симптом и причина', simple: 'Симптом чувствует клиент, причина — внутри системы.', tech: 'Symptom-based alerting: будить по ошибкам и задержке, видимым пользователю; причины (CPU, память) — на дашбордах для диагностики.' },
      { term: 'Runbook', simple: 'Короткая инструкция: что делать, когда сработал алерт.', tech: 'Документ с шагами диагностики и восстановления; ссылка — в аннотации алерта.' }
    ],
    outro: 'Теперь звонить будут редко и всегда по делу, а понедельник разбудил бы Сашу через пять минут. Завтра собираем всё в постановку: какие логи, метрики, дашборды и алерты нужны оплате.',
    tasks: [howSlo, howAlert, noisy, budget, rule]
  });
})();
