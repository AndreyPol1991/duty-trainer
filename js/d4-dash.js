/* День 4 · Четверг. Дашборды: RED и USE, переменные и отметки выкаток, чтение инцидента по графикам.
   Ключ преподавателя — _dev/KEY.md, раздел «Четверг». */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc, O = TR.obs;
  const ID = 'dash';

  document.head.insertAdjacentHTML('beforeend', `<style>
  .ds-cb{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--border);border-radius:9px;padding:8px 10px;background:var(--surface);cursor:pointer;min-width:0}
  .ds-cb input{margin-top:3px}.ds-cb small{display:block;color:var(--text-muted);font-size:12px}
  .ds-cb.ok{border-color:var(--ok);background:var(--ok-soft)}.ds-cb.bad{border-color:var(--bad);background:var(--bad-soft)}.ds-cb.miss{border-style:dashed;border-color:var(--warn)}
  .ds-cbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:6px}
  .ds-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
  .ds-f{display:grid;gap:4px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface)}
  .ds-f.ok{border-color:var(--ok);background:var(--ok-soft)}.ds-f.bad{border-color:var(--bad);background:var(--bad-soft)}
  .ds-f label{font-size:13px;color:var(--text-2)}
  .ds-row-h{font:600 11px/1.4 var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);margin:6px 0 -2px}
  </style>`);

  const S = () => O.series();
  const pct = v => v.toFixed(v < 10 ? 1 : 0) + ' %';
  const ms = v => O.fmt(Math.round(v)) + ' мс';

  // Панели дашборда «Оплата»: одна функция — один ответ на вопрос дежурного.
  function panelDefs(svc) {
    const s = S(), lab = O.labels(s.n), ann = deploy => deploy ? [{ i: s.deployIdx, label: 'payment 2.31' }] : [];
    const r = TR.rand('ds-' + svc), k = svc === 'checkout' ? 1 : 0;
    return {
      orders: { t: 'Оплаченные заказы в минуту', q: 'бизнес', mk: d => O.chart({ series: [{ name: 'заказов/мин', color: 'var(--accent)', data: s.paid }], labels: lab, annotations: ann(d) }) },
      abandon: { t: 'Брошено корзин на шаге оплаты, %', q: 'бизнес', mk: d => O.chart({ series: [{ name: 'брошено, %', color: 'var(--warn)', data: s.errPct.map(v => Math.round((v * 0.9 + 2.2) * 10) / 10) }], labels: lab, annotations: ann(d), yFmt: pct }) },
      rate: { t: svc === 'checkout' ? 'Запросы оформления в секунду' : 'Платежи в секунду', q: 'RED: rate', mk: d => O.chart({ series: [{ name: 'в секунду', color: 'var(--info)', data: s.req.map(x => Math.round(x / 60 * 100) / 100) }], labels: lab, annotations: ann(d), yFmt: v => v.toFixed(2) }) },
      errors: { t: svc === 'checkout' ? 'Доля ответов с ошибкой, %' : 'Доля неуспешных платежей, %', q: 'RED: errors', mk: d => O.chart({ series: [{ name: 'ошибки, %', color: 'var(--bad)', data: s.errPct }], labels: lab, annotations: ann(d), thresholds: [{ v: 2, label: 'алерт 2 %' }], yFmt: pct }) },
      p95: { t: svc === 'checkout' ? 'Время оформления, p95' : 'Время оплаты, p95 и p50', q: 'RED: duration', mk: d => O.chart({ series: [{ name: 'p95', color: 'var(--info)', data: s.p95.map(v => v == null ? null : v + k * 210) }, { name: 'p50', color: 'var(--violet)', data: s.p50.map(v => v == null ? null : v + k * 140) }], labels: lab, annotations: ann(d), yMax: 2200, yFmt: ms }) },
      bank: { t: 'Время ответа банка (по данным шлюза), p95', q: 'зависимость', mk: d => O.chart({ series: [{ name: 'банк p95', color: 'var(--warn)', data: s.bankP95 }], labels: lab, annotations: ann(d), yMax: 2200, yFmt: ms }) },
      cpu: { t: 'CPU подов payment, %', q: 'USE: ресурсы', mk: d => O.chart({ series: [{ name: 'CPU, %', color: 'var(--text-muted)', data: s.cpu.map(v => v + Math.round((r() - 0.5) * 4)) }], labels: lab, annotations: ann(d), yMax: 100, yFmt: v => v.toFixed(0) + ' %' }) },
      avg: { t: 'Среднее время ответа', q: 'прячет хвост', mk: d => O.chart({ series: [{ name: 'среднее', color: 'var(--ok)', data: s.avg }], labels: lab, annotations: ann(d), yMax: 2200, yFmt: ms }) },
      logs: { t: 'Строк в логах в минуту', q: 'шум', mk: d => O.chart({ series: [{ name: 'строк/мин', color: 'var(--text-muted)', data: s.req.map(x => x * 4 + Math.round(r() * 6)) }], labels: lab, annotations: ann(d) }) },
      podcpu: { t: 'CPU каждого пода отдельно (24 линии)', q: 'шум', mk: d => O.chart({ series: Array.from({ length: 6 }, (_, h) => ({ name: 'pod-' + (h + 1), color: ['var(--accent)', 'var(--info)', 'var(--violet)', 'var(--warn)', 'var(--cyan)', 'var(--pink)'][h], data: s.cpu.map(v => v + Math.round((r() - 0.5) * 20)) })), labels: lab, annotations: ann(d), yMax: 100 }) },
      uptime: { t: 'Аптайм сервера, дней', q: 'не отвечает ни на что', mk: () => `<div class="gf-stat">143</div>` },
      users: { t: 'Пользователей всего с запуска', q: 'не отвечает ни на что', mk: () => `<div class="gf-stat">1 284 113</div>` }
    };
  }
  const render = (keys, svc, deploy) => { const P = panelDefs(svc); return `<div class="gf-grid">${keys.map(k => O.panel(P[k].t, P[k].mk(deploy), { sub: P[k].q })).join('')}</div>`; };

  // =====================================================================
  // Теория 1. RED, USE и золотые сигналы
  const COMP = [
    { v: 'svc', t: 'Сервис оплаты' }, { v: 'db', t: 'База заказов' }, { v: 'queue', t: 'Очередь бонусов' }
  ];
  function compView(c) {
    const s = S(), lab = O.labels(s.n), r = TR.rand('ds-use-' + c);
    if (c === 'svc') return render(['rate', 'errors', 'p95'], 'payment', true) + '<p class="small"><b>RED</b> — для всего, что отвечает на запросы: <b>Rate</b> (сколько запросов), <b>Errors</b> (какая доля с ошибкой), <b>Duration</b> (сколько ждут — перцентилями). Это то, что чувствует клиент.</p>';
    if (c === 'db') return `<div class="gf-grid">${O.panel('Utilization: загрузка CPU базы, %', O.chart({ series: [{ name: 'CPU', color: 'var(--info)', data: s.req.map(() => 38 + Math.round(r() * 12)) }], labels: lab, yMax: 100 }), { sub: 'USE: U' })}${O.panel('Saturation: запросов ждут соединения', O.chart({ series: [{ name: 'в очереди', color: 'var(--warn)', data: s.req.map(() => Math.round(r() * 1.4)) }], labels: lab, yMax: 20 }), { sub: 'USE: S' })}${O.panel('Errors: ошибок соединения в минуту', O.chart({ series: [{ name: 'ошибки', color: 'var(--bad)', data: s.req.map(() => 0) }], labels: lab, yMax: 5 }), { sub: 'USE: E' })}</div><p class="small"><b>USE</b> — для ресурсов: <b>Utilization</b> (насколько занят), <b>Saturation</b> (сколько ждёт в очереди), <b>Errors</b>. База в понедельник была спокойна — виноватый искался не здесь.</p>`;
    let lag = 40;
    return `<div class="gf-grid">${O.panel('Отставание консюмера бонусов, сообщений', O.chart({ series: [{ name: 'лаг', color: 'var(--violet)', data: s.req.map(() => (lag = Math.max(0, lag + Math.round((r() - 0.5) * 30)))) }], labels: lab }), { sub: 'насыщение' })}${O.panel('Обработано сообщений в секунду', O.chart({ series: [{ name: 'в секунду', color: 'var(--info)', data: s.paid.map(x => Math.round(x / 60 * 100) / 100) }], labels: lab }), { sub: 'пропускная способность' })}</div><p class="small">Для очереди главный сигнал — <b>лаг</b>: сколько не прочитано. Растёт — консюмер не успевает. Это насыщение из USE и «saturation» из четырёх золотых сигналов Google SRE: задержка, трафик, ошибки, насыщение.</p>`;
  }
  const howRed = {
    id: 'how-red', title: 'Как это работает: RED, USE и четыре золотых сигнала', covers: ['build', 'order'], free: true, noReset: true,
    simple: { icon: '🧭', plain: 'Для сервиса смотрят то, что чувствует клиент: сколько запросов, какая доля с ошибкой, сколько ждут. Для ресурса — базы, диска, очереди — насколько он занят, сколько ждёт в очереди и сколько ошибок. Сначала симптомы клиента, потом ресурсы.', analogy: 'Ресторан. Для зала важно: сколько гостей, сколько ушли недовольными, сколько ждали блюдо. Для кухни: насколько загружены повара, сколько заказов ждут, сколько блюд испорчено. Директор смотрит на зал, повар — на кухню.', tech: 'RED (Tom Wilkie): Rate, Errors, Duration — для запросов. USE (Brendan Gregg): Utilization, Saturation, Errors — для ресурсов. Four golden signals (Google SRE book): latency, traffic, errors, saturation. Дашборд сервиса начинают с RED и бизнес-метрик, ресурсы — ниже.' },
    lead: ui.brief({ situation: 'Гоша открывает три компонента «Минутки» и показывает, какие панели нужны каждому.', todo: ['Переключите «Сервис оплаты», «База заказов», «Очередь бонусов».', 'Наведите курсор на графики.'], look: 'Чем панели сервиса отличаются от панелей ресурса.' }),
    render(el, ctx) {
      const a = ctx.ans; a.c = a.c || 'svc'; a.seen = a.seen || {}; a.seen[a.c] = 1;
      el.innerHTML = `<div class="stack">${ui.seg('c', COMP, a.c)}<div>${compView(a.c)}</div><p class="small dim">Посмотрено: ${Object.keys(a.seen).length} из 3.</p></div>`;
      O.hover(el);
      ui.onSeg(el, (n, v) => { a.c = v; ctx.save(); ctx.rerender(); });
      if (Object.keys(a.seen).length >= 3 || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Теория 2. Дашборд: переменная, отметки выкаток
  const howDash = {
    id: 'how-dash', title: 'Как это работает: дашборд — переменные и отметки выкаток', covers: ['read'], free: true, noReset: true,
    simple: { icon: '📊', plain: 'Дашборд — страница графиков на один вопрос: «как дела у оплаты». Сверху переменные: какой сервис показать. На графиках — отметки событий: выкатка, перезапуск. Отметка выкатки превращает «что-то сломалось в 14:05» в «сломалось ровно на выкатке 2.31».', analogy: 'Приборная панель самолёта: приборы сгруппированы по вопросам — высота, скорость, двигатели, — а не «все датчики подряд». И пилот видит отметку «шасси выпущено» на той же шкале времени.', tech: 'Grafana: панели (time series, stat), переменные шаблона ($service, $env) в запросах, аннотации из событий выкатки (CI/CD отправляет их через API или берёт из метрики версии), общий диапазон времени и курсор, общий для всех панелей.' },
    lead: ui.brief({ situation: 'Гоша собрал черновик дашборда «Оплата». Понедельник, 13:50–14:40.', todo: ['Переключите переменную <code>service</code>.', 'Включите «Отметки выкаток».', 'Наведите курсор: подсказка показывает значения в этой минуте.'], look: 'Без отметки выкатки причину пришлось бы искать по логам.' }),
    render(el, ctx) {
      const a = ctx.ans; a.svc = a.svc || 'payment';
      el.innerHTML = `<div class="stack"><div class="gf-bar"><label>service <select data-svc ${ctx.readonly ? 'disabled' : ''}>${['payment', 'checkout'].map(x => `<option ${a.svc === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="toggle"><input type="checkbox" data-ann ${a.ann ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> <span>Отметки выкаток</span></label><span class="small dim">Понедельник 13:50–14:40</span></div>
        ${render(['rate', 'errors', 'p95', 'bank'], a.svc, a.ann)}</div>`;
      O.hover(el);
      el.addEventListener('change', e => { if (e.target.matches('[data-svc]')) { a.svc = e.target.value; a.sw = 1; } if (e.target.matches('[data-ann]')) a.ann = e.target.checked; ctx.save(); ctx.rerender(); });
      if ((a.ann && a.sw) || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 1. Дашборд дежурного
  const PANELS = [
    { id: 'orders', need: true, because: 'Бизнес-метрика из понедельника: Лена видит, что деньги теряются прямо сейчас, даже когда все серверы «зелёные».' },
    { id: 'abandon', need: true, because: 'Вторая бизнес-метрика Лены: брошенные на оплате корзины — прямые потери.' },
    { id: 'rate', need: true, because: 'Трафик: упал поток платежей — проблема может быть ещё до оплаты; вырос — объясняет нагрузку.' },
    { id: 'errors', need: true, because: 'Главный симптом: доля неуспешных платежей. В понедельник она первой показала инцидент.' },
    { id: 'p95', need: true, because: 'Сколько ждут клиенты — перцентилем, как требует Лена: «две секунды у 95 %».' },
    { id: 'bank', need: true, because: 'Главная внешняя зависимость. Без этой панели не ответить, виноват ли банк.' },
    { id: 'cpu', ok: true, because: 'Ресурсы полезны внизу дашборда — чтобы исключить причину. Но на них не алертят и их не ставят первым рядом.' },
    { id: 'avg', bad: true, why: 'Среднее прячет медленных клиентов — в понедельник оно вообще не заметило инцидент.' },
    { id: 'logs', bad: true, why: 'Число строк в логах ни о чём не говорит: оно растёт и от трафика, и от DEBUG.' },
    { id: 'podcpu', bad: true, why: 'Двадцать линий на одной панели никто не читает; ресурсы смотрят суммой или максимумом.' },
    { id: 'uptime', bad: true, why: 'Аптайм сервера ничего не говорит о клиентах: сервер может работать и отдавать ошибки.' },
    { id: 'users', bad: true, why: 'Накопительное число за всё время не меняется от инцидента — на вопрос «как дела сейчас» не отвечает.' }
  ];
  const build = {
    id: 'build', title: 'Соберите дашборд «Оплата» для дежурного',
    lead: ui.brief({ situation: 'Старый дашборд оплаты: аптайм, CPU каждого пода и среднее время. Саша: «Он красивый, но в понедельник ничего не показал». Соберите новый.', todo: ['Отметьте панели, которые должны быть на дашборде.', 'Нажмите «Проверить». Засчитывается, когда все нужные на месте и нет вредных.'], look: 'Что важно Лене (из блокнота) и что чувствует клиент. Ресурсы — можно, но не вместо симптомов.' }),
    blank: () => ({ p: [] }),
    reference: () => ({ p: PANELS.filter(p => p.need || p.ok).map(p => p.id) }),
    render(el, ctx) {
      const a = ctx.ans; a.p = a.p || [];
      const P = panelDefs('payment'), judged = !!(ctx.result || ctx.readonly);
      el.innerHTML = `<div class="ds-cbs">${TR.shuffle(PANELS, 'ds-build').map(p => { const on = a.p.includes(p.id); let cls = ''; if (judged) cls = on ? (p.bad ? 'bad' : 'ok') : (p.need ? 'miss' : ''); return `<label class="ds-cb ${cls}"><input type="checkbox" data-p="${p.id}" ${on ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}><span>${esc(P[p.id].t)}<small>${esc(P[p.id].q)}</small></span></label>`; }).join('')}</div>`;
      el.addEventListener('change', e => { const id = e.target.dataset.p; if (!id) return; a.p = e.target.checked ? a.p.concat(id) : a.p.filter(x => x !== id); e.target.closest('.ds-cb').classList.remove('ok', 'bad', 'miss'); ctx.save(); });
    },
    check(ans) {
      const S2 = new Set(ans.p || []), P = panelDefs('payment'), notes = [];
      const miss = PANELS.filter(p => p.need && !S2.has(p.id)), bad = PANELS.filter(p => p.bad && S2.has(p.id));
      miss.forEach(p => notes.push({ ok: false, html: `Нет панели «${esc(P[p.id].t)}».` }));
      bad.forEach(p => notes.push({ ok: false, html: `«${esc(P[p.id].t)}» — ${esc(p.why)}` }));
      const needN = PANELS.filter(p => p.need).length;
      return { ok: !miss.length && !bad.length, score: Math.max(0, (needN - miss.length) / needN - bad.length * 0.1), notes, summary: `Нужных: ${needN - miss.length} из ${needN} · вредных: ${bad.length}.` };
    },
    answers: ans => { const S2 = new Set(ans.p || []), P = panelDefs('payment'); return PANELS.map(p => { const on = S2.has(p.id); return { q: P[p.id].t, mine: on ? 'на дашборде' : 'нет', right: p.need ? 'нужна' : p.ok ? 'можно, внизу' : 'не нужна', ok: p.bad ? !on : p.need ? on : true, why: esc(p.because || p.why) }; }); },
    viz: (el, ans) => {
      const keys = (ans.p || []).length ? PANELS.filter(p => (ans.p || []).includes(p.id)).map(p => p.id) : [];
      const missing = PANELS.filter(p => p.need && !keys.includes(p.id));
      el.innerHTML = (keys.length ? `<div class="gf-bar"><span class="small">Ваш дашборд «Оплата» · понедельник 13:50–14:40 · отметки выкаток включены</span></div>${render(keys, 'payment', true)}` : '<p class="small">Панели не выбраны — дашборд пуст. Вот каким он должен быть:</p>' + render(PANELS.filter(p => p.need).map(p => p.id), 'payment', true))
        + (missing.length && keys.length ? `<p class="small"><b>Не хватает:</b> ${missing.map(p => esc(panelDefs('payment')[p.id].t)).join(', ')} — без них на вопрос «что сломалось и где» этот дашборд не ответит.</p>` : '');
      O.hover(el);
    },
    explain: '<p>Дашборд дежурного отвечает на три вопроса по порядку: <b>больно ли бизнесу</b> (заказы в минуту, брошенные корзины), <b>что чувствует клиент</b> (RED: поток, доля ошибок, p95), <b>кто виноват</b> (зависимости — банк, склад; ниже ресурсы). Вредные панели — те, что не меняются от инцидента (аптайм, «всего пользователей») или прячут его (среднее). Отметки выкаток — на каждой панели.</p>',
    report: ans => (ans.p || []).map(id => panelDefs('payment')[id].t).join(', ') || '—'
  };

  // =====================================================================
  // Практика 2. Прочитать инцидент по дашборду
  const READQ = [
    { id: 'when', t: 'Когда начались сбои', o: ['13:50', '14:05', '14:20', '14:35'], ok: '14:05', because: 'Доля неуспешных платежей лежит на нуле до 14:05 и подскакивает сразу после — в ту же минуту, что отметка выкатки.', slip: 'на графике доли ошибок подъём ровно у отметки выкатки, а не здесь' },
    { id: 'what', t: 'Что изменилось в это же время', o: ['выкатили payment 2.31', 'выросла нагрузка', 'банк стал отвечать медленнее', 'выросла загрузка CPU'], ok: 'выкатили payment 2.31', because: 'Отметка выкатки стоит ровно на подъёме ошибок. Поток платежей ровный, CPU ровный, время банка прежнее — изменилась только версия.', slip: 'эта панель в 14:05 не изменилась' },
    { id: 'bank', t: 'Виноват ли банк', o: ['нет: время ответа банка не изменилось', 'да: банк отвечает с ошибками', 'да: банк стал медленнее'], ok: 'нет: время ответа банка не изменилось', because: 'p95 ответа банка по данным шлюза — около 1,3–1,5 секунды и до, и после 14:05. Банк отвечает как обычно; изменилось то, сколько мы его ждём.', slip: 'панель «время ответа банка» до и после 14:05 одинаковая' },
    { id: 'clue', t: 'Почему p95 оплаты после 14:05 — ровно 1000 мс', o: ['это таймаут: запросы обрывают на 1000 мс', 'платежи стали быстрее', 'совпадение'], ok: 'это таймаут: запросы обрывают на 1000 мс', because: 'Перцентиль, который лёг ровной полкой на круглом числе, — почти всегда таймаут. Платежи не стали быстрее: тех, кто не успел за секунду, просто оборвали.', slip: 'ровная полка на круглом числе — не скорость, а потолок' },
    { id: 'act', t: 'Первое действие дежурного', o: ['откатить payment на 2.30', 'перезапустить поды payment', 'звонить в банк', 'добавить поды payment'], ok: 'откатить payment на 2.30', because: 'Сбой начался с выкатки — самый быстрый и безопасный способ остановить потери: откатить. Разбираться с таймаутом — потом, днём. Перезапуск и новые поды не помогут: та же версия с тем же таймаутом.', slip: 'это не остановит сбои — версия и таймаут останутся теми же' }
  ];
  const read = {
    id: 'read', title: 'Прочитайте понедельничный инцидент по дашборду',
    lead: ui.brief({ situation: 'Гоша открывает новый дашборд на понедельнике: «Представь, что сейчас 14:12 и тебе позвонили. Что видишь?»', todo: ['Посмотрите на панели, наведите курсор.', 'Ответьте на пять вопросов.', 'Нажмите «Проверить». Засчитывается от четырёх верных из пяти, и первое действие должно быть верным.'], look: 'Отметка выкатки, полка на круглом числе, панель банка.' }),
    blank: () => ({ v: {} }),
    reference: () => ({ v: Object.fromEntries(READQ.map(q => [q.id, q.ok])) }),
    render(el, ctx) {
      const a = ctx.ans; a.v = a.v || {};
      const judged = !!(ctx.result || ctx.readonly);
      el.innerHTML = render(['orders', 'errors', 'p95', 'bank', 'rate', 'cpu'], 'payment', true) + `<div class="ds-form" style="margin-top:12px">${READQ.map(q => `<div class="ds-f ${judged && a.v[q.id] ? (a.v[q.id] === q.ok ? 'ok' : 'bad') : ''}"><label for="rd-${q.id}">${esc(q.t)}</label><select id="rd-${q.id}" data-q="${q.id}" ${ctx.readonly ? 'disabled' : ''}><option value="">Выберите…</option>${q.o.map(o => `<option ${a.v[q.id] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`).join('')}</div>`;
      O.hover(el);
      el.addEventListener('change', e => { const q = e.target.dataset.q; if (!q) return; if (e.target.value) a.v[q] = e.target.value; else delete a.v[q]; e.target.closest('.ds-f').classList.remove('ok', 'bad'); ctx.save(); });
    },
    check(ans) {
      const v = ans.v || {}, good = READQ.filter(q => v[q.id] === q.ok).length, notes = [];
      READQ.forEach(q => { if (!v[q.id]) notes.push({ ok: false, html: `«${esc(q.t)}» — без ответа.` }); else if (v[q.id] !== q.ok) notes.push({ ok: q.id === 'act' ? false : 'warn', html: `«${esc(q.t)}»: ${esc(q.slip)}.` }); });
      return { ok: good >= 4 && v.act === READQ[4].ok, score: good / READQ.length, notes, summary: `Верно ${good} из ${READQ.length}.` };
    },
    flags: ans => (ans.v || {}).act && (ans.v || {}).act !== READQ[4].ok ? ['Первым действием выбрал не откат, хотя сбой начался с выкатки'] : [],
    answers: ans => READQ.map(q => ({ q: q.t, mine: (ans.v || {})[q.id] || '', right: q.ok, ok: (ans.v || {})[q.id] === q.ok, slip: (ans.v || {})[q.id] && (ans.v || {})[q.id] !== q.ok ? ui.cap(q.slip) + '.' : '', why: q.because })),
    viz: (el) => {
      // Поочерёдно подсвечиваем панель, которая отвечает на каждый вопрос.
      const MAP = { when: 'errors', what: 'errors', bank: 'bank', clue: 'p95', act: 'errors' };
      let k = 0;
      const draw = () => {
        const q = READQ[k], P = panelDefs('payment');
        el.innerHTML = `<div class="stack"><div class="row">${READQ.map((x, i) => `<button type="button" class="btn sm ${i === k ? 'primary' : 'ghost'}" data-k="${i}">${i + 1}</button>`).join('')}</div>
          <p class="small"><b>${esc(q.t)}:</b> ${esc(q.ok)}. ${esc(q.because)}</p>
          <div class="gf-grid">${O.panel(P[MAP[q.id]].t, P[MAP[q.id]].mk(true), { wide: true, sub: 'смотрим сюда' })}${q.id === 'bank' || q.id === 'clue' ? O.panel(P.errors.t, P.errors.mk(true), { sub: 'для сравнения' }) : ''}</div></div>`;
        O.hover(el);
      };
      el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { k = +b.dataset.k; draw(); } });
      draw();
    },
    explain: '<p>Порядок чтения: <b>когда началось</b> (симптом — доля ошибок) → <b>что изменилось в эту минуту</b> (отметки выкаток, поток, ресурсы) → <b>зависимости</b> (банк в норме) → <b>улики</b> (p95 полкой на 1000 мс — таймаут) → <b>остановить потери</b> (откат), а разбираться потом. Весь путь — за пару минут, без единого поиска по логам. Логи нужны, чтобы подтвердить: запись о запуске 2.31 с <code>bank.timeout_ms=1000</code>.</p>',
    report: ans => READQ.map(q => `- ${q.t}: ${(ans.v || {})[q.id] || '—'} ${(ans.v || {})[q.id] === q.ok ? '✓' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 3. Порядок рядов дашборда
  const ROWS = [
    { id: 'r1', t: 'Бизнес: оплаченные заказы в минуту, брошенные корзины', because: 'Первым — то, ради чего всё: теряем ли деньги прямо сейчас. Это видит и Лена, и дежурный.' },
    { id: 'r2', t: 'Симптомы клиента: доля ошибок, p95, поток запросов', because: 'Вторым — что чувствует клиент. По этим панелям срабатывают алерты.' },
    { id: 'r3', t: 'Зависимости: банк, склад, промокоды', because: 'Третьим — кто виноват: внешние и соседние сервисы, от которых зависит оплата.' },
    { id: 'r4', t: 'Ресурсы: CPU, память, соединения с базой', because: 'Последним — ресурсы: чтобы исключить или подтвердить причину. Сами по себе они ничего не говорят о клиентах.' }
  ];
  const order = {
    id: 'order', title: 'Расставьте ряды дашборда сверху вниз',
    lead: ui.brief({ situation: 'Дежурный открывает дашборд в три часа ночи. Верх страницы он прочитает точно, до низа может не долистать.', todo: ['Расставьте ряды сверху вниз.', 'Нажмите «Проверить».'], look: 'От «больно ли бизнесу» к «почему».' }),
    blank: () => ({ o: [] }),
    reference: () => ({ o: ROWS.map(r => r.id) }),
    render(el, ctx) {
      const a = ctx.ans; let rv = null;
      if (ctx.result || ctx.readonly) { rv = {}; (a.o || []).forEach((id, i) => { rv[id] = ROWS[i] && ROWS[i].id === id ? 'ok' : 'bad'; }); }
      ui.order(el, { items: ROWS.map(r => ({ id: r.id, t: esc(r.t) })), value: a.o, reveal: rv, readonly: ctx.readonly, seed: 'ds-order', onChange: v => { a.o = v; ctx.save(); } });
    },
    check(ans) {
      const o = ans.o || [];
      if (o.length !== ROWS.length) return { ok: false, score: 0, summary: 'Расставьте все ряды.' };
      const exact = o.every((id, i) => id === ROWS[i].id), notes = [];
      if (o[0] !== 'r1') notes.push({ ok: false, html: 'Сверху — бизнес: деньги теряются или нет. Это первый вопрос и Лены, и дежурного.' });
      if (o.indexOf('r4') !== 3) notes.push({ ok: 'warn', html: 'Ресурсы — внизу: они объясняют причину, но не говорят, плохо ли клиентам.' });
      return { ok: exact, score: ui.orderScore(o, ROWS.map(r => r.id)), notes, summary: exact ? 'Порядок верный.' : 'Порядок не сходится.' };
    },
    answers: ans => { const o = ans.o || []; return ROWS.map((r, i) => { const at = o.indexOf(r.id); return { q: r.t, mine: at < 0 ? '' : 'ряд ' + (at + 1), right: 'ряд ' + (i + 1), ok: at === i, why: r.because }; }); },
    viz: (el, ans) => {
      const o = (ans.o || []).length === ROWS.length ? ans.o : ROWS.map(r => r.id);
      const KEYS = { r1: ['orders', 'abandon'], r2: ['errors', 'p95', 'rate'], r3: ['bank'], r4: ['cpu'] };
      el.innerHTML = `<p class="small">Ваш дашборд в вашем порядке — как его увидит дежурный ночью сверху вниз:</p>` + o.map((id, i) => `<div class="ds-row-h">${i + 1}. ${esc(ROWS.find(r => r.id === id).t)}</div>${render(KEYS[id], 'payment', true)}`).join('');
      O.hover(el);
    },
    explain: '<p>Дашборд читают сверху вниз и часто не до конца. Поэтому порядок — <b>бизнес → симптомы → зависимости → ресурсы</b>: от «больно ли» к «почему». Тот же порядок у алертов: будят по симптомам из второго ряда, а ресурсы из четвёртого — только для разбора.</p>',
    report: ans => (ans.o || []).map((id, i) => `${i + 1}. ${(ROWS.find(r => r.id === id) || {}).t}`).join('\n') || '—'
  };

  TR.stage({
    id: ID, act: 2, order: 40, slot: 'Чт', title: 'Дашборды: ответ на вопрос',
    when: 'четверг · дашборд «Оплата»',
    intro: [
      { who: 'sasha', html: 'Старый дашборд оплаты красивый: аптайм 143 дня, двадцать линий CPU. В понедельник он весь был зелёный.' },
      { who: 'gosha', html: 'Дашборд должен отвечать на вопрос дежурного за минуту: больно ли бизнесу, что чувствуют клиенты, кто виноват. Соберём такой и прочитаем на нём понедельник.' }
    ],
    facts: ['F-biz', 'F-latency', 'F-deploys'],
    glossary: [
      { term: 'Дашборд', simple: 'Страница графиков, отвечающая на один вопрос.', tech: 'Набор панелей (Grafana) с общим диапазоном времени, переменными и аннотациями.' },
      { term: 'RED', simple: 'Поток, ошибки, время — для всего, что отвечает на запросы.', tech: 'Rate, Errors, Duration (Tom Wilkie): минимальный набор метрик сервиса.' },
      { term: 'USE', simple: 'Занятость, очередь, ошибки — для ресурсов.', tech: 'Utilization, Saturation, Errors (Brendan Gregg): метод анализа ресурсов.' },
      { term: 'Золотые сигналы', simple: 'Четыре главных показателя сервиса.', tech: 'Four golden signals (Google SRE): latency, traffic, errors, saturation.' },
      { term: 'Аннотация', simple: 'Отметка события на графике: выкатка, перезапуск.', tech: 'Annotation в Grafana: метка времени с текстом, общая для панелей; часто создаётся CI/CD при выкатке.' },
      { term: 'Переменная дашборда', simple: 'Выпадающий список сверху: какой сервис или окружение показать.', tech: 'Template variable ($service, $env), подставляется в запросы всех панелей.' }
    ],
    outro: 'Дашборд отвечает за минуту: больно ли, кому и почему. Но про один запрос он не расскажет: где по пути ушло время. Завтра — трассы, и жалоба «оформление тормозит», которую графики не объясняют.',
    tasks: [howRed, howDash, build, read, order]
  });
})();
