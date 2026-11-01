/* День 3 · Среда. Метрики: счётчик, датчик, гистограмма; rate; среднее против перцентилей; метки и кардинальность.
   Ключ преподавателя — _dev/KEY.md, раздел «Среда». */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc, O = TR.obs;
  const ID = 'metrics';

  document.head.insertAdjacentHTML('beforeend', `<style>
  .mt-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .mt-stat{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);min-width:0}
  .mt-stat span{display:block;font-size:12px;color:var(--text-muted)}.mt-stat b{font:700 20px/1.2 var(--f-brand);font-variant-numeric:tabular-nums}
  .mt-stat.bad b{color:var(--bad)}
  .mt-q{display:grid;gap:8px}
  .mt-row{display:grid;grid-template-columns:110px repeat(3,minmax(0,1fr));gap:8px;align-items:center}
  .mt-row b{font-size:13px}
  .mt-row select{font:12.5px var(--f-mono);min-width:0}
  @media (max-width:640px){.mt-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.mt-row{grid-template-columns:minmax(0,1fr)}}
  </style>`);

  const S = () => O.series();
  const sum5 = (arr, i) => arr.slice(Math.max(0, i - 4), i + 1).reduce((s, x) => s + x, 0);
  const cumul = (arr, start) => { let c = start; return arr.map(x => (c += x)); };

  // =====================================================================
  // Теория 1. Счётчик, датчик, гистограмма
  const TYPES = [{ v: 'counter', t: 'Счётчик' }, { v: 'gauge', t: 'Датчик' }, { v: 'histogram', t: 'Гистограмма' }];
  function typeView(a) {
    const s = S(), lab = O.labels(s.n);
    if (a.t === 'counter') {
      let raw = cumul(s.req, 183400);
      if (a.restart) { const k = 30; raw = raw.map((v, i) => i < k ? v : v - raw[k - 1]); }
      const rate = s.req.map((x, i) => Math.round(sum5(s.req, i) / 300 * 100) / 100);
      return O.panel(a.rate ? 'rate(payments_total[5m]) — платежей в секунду' : 'payments_total — значение счётчика', O.chart({ series: [{ name: a.rate ? 'платежей/с' : 'payments_total', color: 'var(--accent)', data: a.rate ? rate : raw }], labels: lab, yFmt: v => a.rate ? v.toFixed(2) : O.fmt(Math.round(v)) }), { wide: true })
        + `<p class="small">${a.rate ? 'rate() берёт прирост счётчика за окно и делит на секунды — получается «сколько в секунду». Перезапуск, когда счётчик обнулился, rate() понимает и не показывает провал.' : 'Счётчик только растёт: «сколько платежей с момента запуска». Смотреть на него как есть бесполезно — линия ползёт вверх всегда. Включите rate().'}${a.restart && !a.rate ? ' После перезапуска сервиса счётчик начался с нуля — на графике провал, которого в жизни не было.' : ''}</p>`;
    }
    if (a.t === 'gauge') {
      const r = TR.rand('mt-gauge'); let g = 18;
      const data = s.req.map(x => (g = Math.max(2, Math.round(g + (x - 15) * 0.8 + (r() - 0.5) * 6))));
      return O.panel('orders_in_assembly — заказов в сборке сейчас', O.chart({ series: [{ name: 'в сборке', color: 'var(--violet)', data }], labels: lab }), { wide: true })
        + '<p class="small">Датчик — значение «прямо сейчас»: может расти и падать. Заказов в сборке, свободное место на диске, отставание консюмера. rate() к датчику не применяют — смотрят как есть, среднее или максимум за окно.</p>';
    }
    const b = [0.25, 0.5, 1, 2.5, 5], d = O.logs().filter(x => x.event === 'payment.succeeded' && x['@timestamp'] < O.DEPLOY).map(x => x.duration_ms / 1000);
    const cnt = b.map(le => d.filter(v => v <= le).length).concat(d.length);
    const W = 600, H = 150, bw = W / 6;
    const bars = cnt.map((c, i) => `<rect x="${i * bw + 8}" y="${(H - 24 - c / d.length * (H - 40)).toFixed(1)}" width="${bw - 16}" height="${(c / d.length * (H - 40)).toFixed(1)}" style="fill:var(--info)" opacity=".75"/><text x="${i * bw + bw / 2}" y="${H - 8}" text-anchor="middle" style="fill:var(--text-muted);font:11px var(--f-mono)">le=${i < 5 ? b[i] : '+Inf'}</text><text x="${i * bw + bw / 2}" y="${(H - 28 - c / d.length * (H - 40)).toFixed(1)}" text-anchor="middle" style="fill:var(--text-2);font:11px var(--f-mono)">${c}</text>`).join('');
    return O.panel('payment_duration_seconds_bucket — сколько платежей уложились в «не дольше le»', `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Корзины гистограммы">${bars}</svg>`, { wide: true })
      + `<p class="small">Гистограмма — набор счётчиков-корзин: «уложились в 0,25 с», «в 0,5 с», «в 1 с»… Корзины накопительные: каждая включает предыдущие. Из них считают перцентили: <code>histogram_quantile(0.95, …)</code> — время, быстрее которого прошли 95 % платежей. До выкатки ${d.length} платежей; в 1 секунду уложились ${cnt[2]}.</p>`;
  }
  const howTypes = {
    id: 'how-types', title: 'Как это работает: счётчик, датчик и гистограмма', covers: ['types', 'query'], free: true, noReset: true,
    simple: { icon: '📈', plain: 'Метрика — число, которое сервис сообщает снова и снова. Бывает трёх видов. Счётчик только растёт: «сколько платежей с запуска». Датчик показывает «сейчас»: «сколько заказов в сборке». Гистограмма раскладывает измерения по корзинам: «сколько платежей уложились в полсекунды, в секунду, в две».', analogy: 'Счётчик — пробег автомобиля: только растёт, а скорость считают по приросту. Датчик — спидометр: показывает «сейчас». Гистограмма — табло марафона: сколько бегунов уложились в три часа, в четыре, в пять.', tech: 'Prometheus: counter (монотонный, сбрасывается при перезапуске; смотрят через rate()/increase()), gauge (текущее значение), histogram (корзины _bucket{le}, _sum, _count; перцентили — histogram_quantile). Хранится как временные ряды с метками; опрос (scrape) раз в 15–30 секунд.' },
    lead: ui.brief({ situation: 'Гоша: «Вчера мы считали сбои по логам. Метрика скажет то же за миллисекунду. Но сначала — какие бывают метрики».', todo: ['Переключите «Счётчик», «Датчик», «Гистограмма».', 'У счётчика включите «перезапуск сервиса» и rate().', 'Наведите курсор на график — увидите значения.'], look: 'Почему на счётчик нельзя смотреть «как есть».' }),
    render(el, ctx) {
      const a = ctx.ans; a.t = a.t || 'counter'; a.seen = a.seen || {}; a.seen[a.t] = 1;
      el.innerHTML = `<div class="stack">${ui.seg('t', TYPES, a.t)}
        ${a.t === 'counter' ? `<div class="row"><label class="toggle"><input type="checkbox" data-rate ${a.rate ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> <span>rate(…[5m])</span></label><label class="toggle"><input type="checkbox" data-restart ${a.restart ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> <span>Перезапуск сервиса в 14:20</span></label></div>` : ''}
        <div>${typeView(a)}</div><p class="small dim">Посмотрено: ${Object.keys(a.seen).length} из 3.</p></div>`;
      O.hover(el);
      ui.onSeg(el, (n, v) => { a.t = v; ctx.save(); ctx.rerender(); });
      el.addEventListener('change', e => { if (e.target.matches('[data-rate]')) a.rate = e.target.checked; if (e.target.matches('[data-restart]')) a.restart = e.target.checked; ctx.save(); ctx.rerender(); });
      if (Object.keys(a.seen).length >= 3 || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Теория 2. Среднее против перцентилей
  function latencies(slow) {
    const r = TR.rand('mt-lat'), out = [];
    for (let i = 0; i < 1000; i++) out.push(i < slow * 10 ? 4000 + Math.round(r() * 2000) : Math.round(250 + 600 * Math.pow(r(), 2)));
    return out.sort((a, b) => a - b);
  }
  const howPct = {
    id: 'how-pct', title: 'Как это работает: среднее прячет тех, кому плохо', covers: ['avg'], free: true, noReset: true,
    simple: { icon: '🎯', plain: 'Если 97 платежей прошли за полсекунды, а 3 — за пять секунд, среднее будет около 0,65 секунды: «всё отлично». А три человека бросили корзину. Поэтому время меряют перцентилями: p95 — время, быстрее которого прошли 95 % платежей, p99 — 99 %.', analogy: 'Средняя температура по больнице: у одного жар 40, у двоих 35 — в среднем почти норма. Врач смотрит не на среднее, а на тех, кому плохо.', tech: 'Перцентиль (квантиль) pN — значение, ниже которого N % наблюдений. p50 — медиана. SLO на задержку формулируют перцентилем: «p95 < 2 с». Среднее и максимум для этого не годятся: среднее прячет хвост, максимум — один выброс. В Prometheus — histogram_quantile по корзинам гистограммы.' },
    lead: ui.brief({ situation: 'Тысяча платежей. Часть из них — медленные, по 4–6 секунд: банк иногда задумывается.', todo: ['Двигайте ползунок «доля медленных платежей».', 'Смотрите, как меняются среднее, p50, p95 и p99.'], look: 'При какой доле медленных среднее всё ещё «в норме», а p99 уже кричит.' }),
    render(el, ctx) {
      const a = ctx.ans; a.slow = a.slow == null ? 3 : a.slow;
      const l = latencies(a.slow), avg = Math.round(l.reduce((s, x) => s + x, 0) / l.length), p = q => l[Math.min(l.length - 1, Math.floor(q * l.length))];
      const bins = Array(24).fill(0); l.forEach(v => { bins[Math.min(23, Math.floor(v / 250))]++; });
      const mx = Math.max(...bins), W = 600, H = 120;
      const svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Распределение времени платежей">${bins.map((b, i) => `<rect x="${i * 25 + 1}" y="${(H - 18 - Math.sqrt(b / mx) * (H - 26)).toFixed(1)}" width="23" height="${(Math.sqrt(b / mx) * (H - 26)).toFixed(1)}" style="fill:${i * 250 >= 2000 ? 'var(--bad)' : 'var(--info)'}" opacity=".75"><title>${i * 250}–${i * 250 + 250} мс: ${b}</title></rect>`).join('')}${[0, 2000, 4000, 6000 - 250].map(x => `<text x="${x / 250 * 25}" y="${H - 4}" style="fill:var(--text-muted);font:10.5px var(--f-mono)">${x === 5750 ? '6 с' : x / 1000 + ' с'}</text>`).join('')}<line x1="${avg / 250 * 25}" x2="${avg / 250 * 25}" y1="0" y2="${H - 18}" style="stroke:var(--accent);stroke-width:2"/><text x="${avg / 250 * 25 + 4}" y="12" style="fill:var(--accent);font:11px var(--f-mono)">среднее</text></svg>`;
      el.innerHTML = `<div class="stack"><label class="field"><span>Доля медленных платежей: <b class="tnum">${a.slow} %</b></span><input type="range" min="0" max="10" step="1" value="${a.slow}" data-slow ${ctx.readonly ? 'disabled' : ''}></label>
        ${O.panel('Время платежа, 1000 штук (высота — корень из числа, чтобы был виден хвост)', svg, { wide: true })}
        <div class="mt-stats">${[['среднее', avg], ['p50', p(0.5)], ['p95', p(0.95)], ['p99', p(0.99)]].map(([k, v]) => `<div class="mt-stat ${v > 2000 ? 'bad' : ''}"><span>${k}</span><b>${O.fmt(v)} мс</b></div>`).join('')}</div>
        <p class="small">${a.slow === 0 ? 'Медленных нет — все показатели рядом.' : a.slow < 5 ? `Медленных ${a.slow} % — это ${a.slow * 10} человек из тысячи, которые ждали больше четырёх секунд. Среднее почти не сдвинулось и «в норме», p95 — тоже: медленных меньше пяти процентов. Их видит только p99.` : `Медленных ${a.slow} % — p95 уже за двумя секундами: требование Лены «две секунды у 95 %» нарушено. А среднее всё ещё выглядит терпимо.`}</p></div>`;
      el.addEventListener('input', e => { if (!e.target.matches('[data-slow]')) return; a.slow = +e.target.value; a.moved = Object.assign(a.moved || {}, { [a.slow]: 1 }); ctx.save(); ctx.rerender(); });
      if (Object.keys(a.moved || {}).length >= 2 || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 1. Тип метрики
  const KINDS = [
    { id: 'k1', t: 'Сколько заказов оформлено с момента запуска сервиса', ok: 'counter', because: 'Число событий, которое только растёт. Смотрят его прирост: rate() — в секунду, increase() — за период.' },
    { id: 'k2', t: 'Сколько заказов прямо сейчас в сборке', ok: 'gauge', because: 'Значение «сейчас», которое растёт и падает: заказы приходят и уходят из сборки.' },
    { id: 'k3', t: 'Сколько миллисекунд отвечал банк на каждый запрос', ok: 'histogram', because: 'Нужно распределение, а не одно число: из корзин гистограммы считают p95 и p99 — именно их требует Лена.' },
    { id: 'k4', t: 'Сколько свободного места на диске', ok: 'gauge', because: 'Текущее состояние ресурса: может и уменьшаться, и расти после чистки.' },
    { id: 'k5', t: 'Сколько ответов 5xx отдал сервис', ok: 'counter', because: 'Счёт событий-ошибок. Доля ошибок — это rate() ошибок, делённый на rate() всех ответов.' },
    { id: 'k6', t: 'Сколько рублей в каждой корзине', ok: 'histogram', because: 'Бизнесу важно распределение чеков (медиана, крупные заказы), а не только сумма — это гистограмма.' },
    { id: 'k7', t: 'Отставание консюмера бонусов, сообщений', ok: 'gauge', because: 'Лаг — разница «сколько записано — сколько прочитано» прямо сейчас; растёт и падает.' },
    { id: 'k8', t: 'Сколько раз сработал повтор вызова склада', ok: 'counter', because: 'Счёт событий. Всплеск rate() повторов — ранний признак, что склад начинает сбоить.' }
  ];
  const MK = [{ v: 'counter', t: 'Счётчик (counter)' }, { v: 'gauge', t: 'Датчик (gauge)' }, { v: 'histogram', t: 'Гистограмма (histogram)' }];
  const MK_WHY = {
    counter: 'счётчик только растёт и считает события; здесь либо значение «сейчас», либо распределение',
    gauge: 'датчик показывает значение «сейчас»; здесь либо счёт событий, либо нужно распределение',
    histogram: 'гистограмма — распределение измерений; здесь либо счёт событий, либо одно текущее значение'
  };
  const types = {
    id: 'types', title: 'Какого типа каждая метрика',
    lead: ui.brief({ situation: 'Разработчики оплаты и склада заводят метрики. Гоша просит проверить типы — от типа зависит, как их потом смотреть.', todo: ['Для каждой метрики выберите тип.', 'Нажмите «Проверить». Засчитывается от семи верных из восьми.'], look: '«Сколько всего было» — одно, «сколько сейчас» — другое, «как распределились» — третье.' }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(KINDS.map(r => [r.id, r.ok])) }),
    render(el, ctx) {
      const a = ctx.ans; a.m = a.m || {};
      let rv = null;
      if (ctx.result || ctx.readonly) { rv = {}; KINDS.forEach(r => { const g = a.m[r.id]; if (g) rv[r.id] = { s: g === r.ok ? 'ok' : 'bad', why: '' }; }); }
      ui.match(el, { rows: KINDS.map(r => ({ id: r.id, t: esc(r.t) })), choices: MK, value: a.m, reveal: rv, readonly: ctx.readonly, placeholder: 'Тип…', onChange: v => { a.m = v; ctx.save(); } });
    },
    check(ans) {
      const m = ans.m || {}, good = KINDS.filter(r => m[r.id] === r.ok).length, notes = [];
      const empty = KINDS.filter(r => !m[r.id]).length;
      if (empty) notes.push({ ok: false, html: `Без типа: ${empty}.` });
      KINDS.forEach(r => { const g = m[r.id]; if (g && g !== r.ok) notes.push({ ok: 'warn', html: `«${esc(r.t)}» — ${esc(MK_WHY[g])}.` }); });
      return { ok: good >= 7, score: good / KINDS.length, notes, summary: `Верно ${good} из ${KINDS.length}.` };
    },
    answers: ans => ui.matchAnswers(KINDS, MK, ans.m, (r, g) => MK_WHY[g] ? ui.cap(MK_WHY[g]) + '.' : ''),
    viz: (el) => {
      // Как выглядит каждый тип на графике — с переключателями, как в лаборатории.
      const a = { t: 'counter', rate: false, restart: true };
      const draw = () => {
        el.innerHTML = `<div class="stack">${ui.seg('t', TYPES, a.t)}${a.t === 'counter' ? `<div class="row"><label class="toggle"><input type="checkbox" data-rate ${a.rate ? 'checked' : ''}> <span>rate(…[5m])</span></label><label class="toggle"><input type="checkbox" data-restart ${a.restart ? 'checked' : ''}> <span>Перезапуск в 14:20</span></label></div>` : ''}<div>${typeView(a)}</div></div>`;
        O.hover(el);
      };
      ui.onSeg(el, (n, v) => { a.t = v; draw(); });
      el.addEventListener('change', e => { if (e.target.matches('[data-rate]')) a.rate = e.target.checked; if (e.target.matches('[data-restart]')) a.restart = e.target.checked; draw(); });
      draw();
    },
    explain: '<p>Тип решает, как метрику смотреть. <b>Счётчик</b> — только через <code>rate()</code>/<code>increase()</code>: значение «как есть» растёт всегда и обнуляется при перезапуске. <b>Датчик</b> — как есть, среднее или максимум за окно. <b>Гистограмма</b> — через <code>histogram_quantile()</code>: p95, p99. Время ответа счётчиком или датчиком не меряют: из среднего не восстановить хвост.</p>',
    report: ans => KINDS.map(r => `- ${r.t} → ${(ans.m || {})[r.id] || '—'} ${(ans.m || {})[r.id] === r.ok ? '✓' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 2. Запрос «доля неуспешных платежей»
  const MET = [
    { v: 'fail', t: 'payments_total{status="fail"}' }, { v: 'all', t: 'payments_total' },
    { v: 'ok', t: 'payments_total{status="ok"}' }, { v: 'cnt', t: 'orders_in_assembly' }
  ];
  const FN = [{ v: 'raw', t: 'как есть' }, { v: 'rate', t: 'rate(…[5m])' }, { v: 'inc', t: 'increase(…[1d])' }];
  const AG = [{ v: 'none', t: 'без агрегации' }, { v: 'sum', t: 'sum(…)' }, { v: 'max', t: 'max(…)' }];
  const OKQ = { n: { m: 'fail', f: 'rate', g: 'sum' }, d: { m: 'all', f: 'rate', g: 'sum' } };
  const promql = p => {
    if (!p || !p.m) return '…';
    let x = (MET.find(m => m.v === p.m) || {}).t;
    if (p.f === 'rate') x = `rate(${x}[5m])`; else if (p.f === 'inc') x = `increase(${x}[1d])`;
    if (p.g === 'sum') x = `sum(${x})`; else if (p.g === 'max') x = `max(${x})`;
    return x;
  };
  /** Ряд по выбору: два пода payment делят поток примерно пополам. */
  function seriesOf(p) {
    const s = S(), base = p.m === 'fail' ? s.fail : p.m === 'ok' ? s.ok : p.m === 'all' ? s.req : s.req.map(() => 0).map((_, i) => 14 + (i % 7));
    let v;
    if (p.m === 'cnt') v = base;
    else if (p.f === 'rate') v = base.map((x, i) => sum5(base, i) / 300);
    else if (p.f === 'inc') v = cumul(base, p.m === 'fail' ? 3 : p.m === 'ok' ? 4100 : 4250);
    else v = cumul(base, p.m === 'fail' ? 1210 : p.m === 'ok' ? 181200 : 183400);
    const share = [0.52, 0.48];
    const hosts = share.map((k, h) => v.map((x, i) => x * (k + (h ? -1 : 1) * 0.02 * Math.sin(i))));
    if (p.g === 'sum' || p.m === 'cnt' && p.g !== 'max') return [v];
    if (p.g === 'max') return [hosts[0].map((x, i) => Math.max(x, hosts[1][i]))];
    return hosts;
  }
  const qOk = q => q && q.n && q.d && ['m', 'f', 'g'].every(k => q.n[k] === OKQ.n[k] && q.d[k] === OKQ.d[k]);
  const query = {
    id: 'query', title: 'Запрос: доля неуспешных платежей',
    lead: ui.brief({ situation: 'Лена: «Мне нужен один график: какая доля оплат не проходит прямо сейчас». В понедельник такого графика не было — поэтому и узнали из соцсетей.', todo: ['Соберите числитель и знаменатель дроби.', 'Смотрите на итоговый запрос и график: они меняются сразу.', 'Нажмите «Проверить».'], look: 'Счётчики смотрят через rate(). Доля по всему сервису — это сумма по всем подам.' }),
    blank: () => ({ q: { n: {}, d: {} } }),
    reference: () => ({ q: JSON.parse(JSON.stringify(OKQ)) }),
    render(el, ctx) {
      const a = ctx.ans; a.q = a.q || { n: {}, d: {} }; a.q.n = a.q.n || {}; a.q.d = a.q.d || {};
      const s = S(), lab = O.labels(s.n), dis = ctx.readonly ? 'disabled' : '';
      const sel = (part, key, list) => `<select data-p="${part}" data-k="${key}" ${dis}><option value="">${key === 'm' ? 'метрика…' : key === 'f' ? 'функция…' : 'агрегация…'}</option>${list.map(o => `<option value="${o.v}" ${a.q[part][key] === o.v ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`;
      const full = ['m', 'f', 'g'].every(k => a.q.n[k]) && ['m', 'f', 'g'].every(k => a.q.d[k]);
      let chart = '';
      if (['m', 'f', 'g'].every(k => a.q.n[k])) {
        const N = seriesOf(a.q.n);
        if (full) {
          const D = seriesOf(a.q.d);
          const lines = N.map((n, h) => n.map((x, i) => { const d = (D[h] || D[0])[i]; return d ? x / d * 100 : null; }));
          chart = O.panel('Результат запроса, %', O.chart({ series: lines.map((l, h) => ({ name: lines.length > 1 ? `payment-5d2a-${h + 1}` : 'доля неуспешных', color: h ? 'var(--violet)' : 'var(--bad)', data: l })), labels: lab, annotations: [{ i: s.deployIdx, label: 'выкатка 2.31' }], yFmt: v => (v < 1 ? v.toFixed(2) : v.toFixed(1)) + ' %' }), { wide: true });
        } else chart = O.panel('Пока только числитель', O.chart({ series: N.map((l, h) => ({ name: N.length > 1 ? `payment-5d2a-${h + 1}` : 'числитель', color: h ? 'var(--violet)' : 'var(--accent)', data: l })), labels: lab, yFmt: v => v < 10 ? v.toFixed(2) : O.fmt(Math.round(v)) }), { wide: true });
      }
      el.innerHTML = `<div class="stack"><div class="mt-q">
        <div class="mt-row"><b>Числитель</b>${sel('n', 'm', MET)}${sel('n', 'f', FN)}${sel('n', 'g', AG)}</div>
        <div class="mt-row"><b>Знаменатель</b>${sel('d', 'm', MET)}${sel('d', 'f', FN)}${sel('d', 'g', AG)}</div></div>
        <div class="gf-q">${esc(promql(a.q.n))}\n  /\n${esc(promql(a.q.d))}</div>${chart}</div>`;
      O.hover(el);
      el.addEventListener('change', e => { const p = e.target.dataset.p, k = e.target.dataset.k; if (!p) return; if (e.target.value) a.q[p][k] = e.target.value; else delete a.q[p][k]; ctx.save(); ctx.rerender(); });
    },
    check(ans) {
      const q = ans.q || { n: {}, d: {} }, n = q.n || {}, d = q.d || {}, notes = [];
      const parts = [['n', 'Числитель'], ['d', 'Знаменатель']];
      parts.forEach(([p, name]) => {
        const x = q[p] || {};
        if (!x.m || !x.f || !x.g) { notes.push({ ok: false, html: `${name}: не всё выбрано.` }); return; }
        if (x.m !== OKQ[p].m) notes.push({ ok: false, html: p === 'n' ? 'В числителе — неуспешные платежи: <code>status="fail"</code>.' : 'В знаменателе — все платежи, без фильтра по статусу: доля считается от всех.' });
        if (x.f !== 'rate') notes.push({ ok: false, html: `${name}: счётчик смотрят через rate() — ${x.f === 'raw' ? 'значение «как есть» копится с запуска, и доля получится за всю жизнь сервиса' : 'increase за сутки покажет долю за день, а нужна «сейчас»'}.` });
        if (x.g !== 'sum') notes.push({ ok: x.g === 'none' ? 'warn' : false, html: `${name}: ${x.g === 'none' ? 'без агрегации получится доля на каждом поде отдельно, а Лене нужна доля по всему сервису' : 'max возьмёт один под — это не доля по сервису'}: нужен sum().` });
      });
      const ok = qOk(q);
      const good = ['m', 'f', 'g'].filter(k => n[k] === OKQ.n[k]).length + ['m', 'f', 'g'].filter(k => d[k] === OKQ.d[k]).length;
      return { ok, score: good / 6, notes, summary: ok ? 'Запрос верный: доля неуспешных платежей за последние 5 минут.' : `Верно ${good} из 6 выборов.` };
    },
    answers: ans => {
      const q = ans.q || { n: {}, d: {} };
      const label = (list, v) => ((list.find(o => o.v === v) || {}).t) || '';
      const row = (p, k, list, name, why) => ({ q: name, mine: label(list, (q[p] || {})[k]), right: label(list, OKQ[p][k]), ok: (q[p] || {})[k] === OKQ[p][k], why });
      return [
        row('n', 'm', MET, 'Числитель — метрика', 'Считаем неуспешные платежи — счётчик с меткой status="fail". Отказы банка «нет денег» сюда не попадают: это отдельный статус declined, бизнес-исход, а не сбой.'),
        row('n', 'f', FN, 'Числитель — функция', 'rate() за 5 минут превращает растущий счётчик в «сколько в секунду сейчас» и переживает перезапуски. Окно в 5 минут сглаживает случайные всплески, но реагирует быстро.'),
        row('n', 'g', AG, 'Числитель — агрегация', 'Платежи идут через два пода; sum() складывает их в один ряд по всему сервису.'),
        row('d', 'm', MET, 'Знаменатель — метрика', 'Доля считается от всех платежей — счётчик без фильтра по статусу.'),
        row('d', 'f', FN, 'Знаменатель — функция', 'То же окно, что в числителе: делить можно только величины за одинаковое время.'),
        row('d', 'g', AG, 'Знаменатель — агрегация', 'Та же сумма по всем подам — иначе числитель и знаменатель будут про разное.')
      ];
    },
    viz: (el, ans) => {
      // Ваш запрос и верный — на одном графике.
      const s = S(), q = ans.q || { n: {}, d: {} }, lab = O.labels(s.n);
      const full = p => p && ['m', 'f', 'g'].every(k => p[k]);
      const ratio = (n, d) => { const N = seriesOf(n), D = seriesOf(d); return N[0].map((x, i) => { const y = D[0][i]; return y ? x / y * 100 : null; }); };
      const right = ratio(OKQ.n, OKQ.d);
      const series = [{ name: 'верный запрос', color: 'var(--ok)', data: right }];
      if (full(q.n) && full(q.d) && !qOk(q)) series.push({ name: 'ваш запрос', color: 'var(--bad)', data: ratio(q.n, q.d) });
      el.innerHTML = `<div class="gf-q">${esc(promql(OKQ.n))} / ${esc(promql(OKQ.d))}</div>` + O.panel('Доля неуспешных платежей, %', O.chart({ series, labels: lab, annotations: [{ i: s.deployIdx, label: 'выкатка 2.31' }], thresholds: [{ v: 2, label: 'алерт: 2 %' }], yFmt: v => (v < 1 ? v.toFixed(2) : v.toFixed(1)) + ' %' }), { wide: true })
        + `<p class="small">${series.length > 1 ? 'Красная линия — ваш запрос: сравните с зелёной. Наведите курсор — увидите обе цифры в одной точке.' : 'В 14:05 доля подскакивает с нуля до 12–16 % — в шесть раз выше порога алерта. Наведите курсор на график.'}</p>`;
      O.hover(el);
    },
    explain: `<p>Итоговый запрос: <code>sum(rate(payments_total{status="fail"}[5m])) / sum(rate(payments_total[5m]))</code>. Это <b>SLI</b> — показатель уровня сервиса: доля неуспешных оплат. В понедельник он подскочил с нуля до 12–16 % в 14:05 — за минуты до первой жалобы. Будь этот график и алерт по нему, узнали бы раньше Нади.</p>
      <p>Почему не по логам: тот же ответ по логам — подсчёт тысяч строк на каждый запрос графика. Метрика — две цифры раз в 15 секунд.</p>`,
    report: ans => `${promql((ans.q || {}).n)} / ${promql((ans.q || {}).d)}`
  };

  // =====================================================================
  // Практика 3. Метка user_id
  const CARD = [
    { t: 'Нельзя: каждая новая комбинация меток — отдельный временной ряд. Сотни тысяч клиентов × корзины гистограммы × статусы — десятки миллионов рядов, хранилище метрик ляжет. user_id — в логи и трассы', ok: true, why: 'Да: это взрыв кардинальности.', because: 'У «Минутки» около 300 тысяч активных клиентов. Гистограмма времени — 12 рядов на каждую комбинацию меток (10 корзин, _sum, _count), статусов три: 300 000 × 12 × 3 ≈ 10,8 млн рядов вместо 36. Хранилище метрик держит в памяти каждый ряд и падает. Метки — только с небольшим фиксированным набором значений: сервис, метод, статус, город. Конкретного клиента ищут в логах и трассах.' },
    { t: 'Можно: хранилище метрик сожмёт одинаковые значения', why: 'Сжатие экономит место на диске, но каждый ряд всё равно держится в памяти и индексе — их станут миллионы.' },
    { t: 'Можно, если хранить такие метрики только неделю', why: 'Проблема не в сроке, а в числе рядов прямо сейчас: память кончится в первый же день.' },
    { t: 'Нельзя, потому что user_id — персональные данные', why: 'Внутренний номер клиента — не персональные данные сами по себе. Главная причина — число рядов.' }
  ];
  const card = {
    id: 'card', title: 'Разработчик: «Добавлю метку user_id — будем видеть время оплаты каждого клиента»',
    lead: ui.brief({ situation: 'Надя хочет знать, сколько платил конкретный клиент. Разработчик предлагает добавить метку <code>user_id</code> к гистограмме времени оплаты.', todo: ['Выберите ответ.', 'Нажмите «Проверить».'], look: 'Сколько временных рядов получится? Метрика — это ряд на каждую комбинацию меток.' }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: [0] }),
    render(el, ctx) { ui.quiz(el, { q: 'Что ответить?', options: CARD, value: ctx.ans.q, readonly: ctx.readonly, reveal: ctx.result || ctx.readonly ? true : null, seed: 'mt-card', onChange: v => { ctx.ans.q = v; ctx.save(); } }); },
    check(ans) { const r = ui.quizScore({ options: CARD }, ans.q || []); const i = (ans.q || [])[0]; return { ok: r.ok, score: r.score, notes: i != null && !CARD[i].ok ? [{ ok: false, html: esc(CARD[i].why) }] : [], summary: r.ok ? 'Верно.' : 'Не сходится.' }; },
    flags: ans => (ans.q || [])[0] === 1 || (ans.q || [])[0] === 2 ? ['Согласился на метку с идентификатором клиента — взрыв кардинальности'] : [],
    answers: ans => ui.quizAnswers('Что ответить?', CARD, ans.q),
    viz: (el) => {
      // Калькулятор рядов: включите метку user_id и посмотрите, что станет с хранилищем.
      const st = { user: true, users: 300000, endpoints: 3, statuses: 3 };
      const draw = () => {
        const buckets = 12, series = buckets * st.endpoints * st.statuses * (st.user ? st.users : 1), mem = series * 3 / 1024 / 1024;
        el.innerHTML = `<div class="stack"><label class="toggle"><input type="checkbox" data-user ${st.user ? 'checked' : ''}> <span>Метка <code>user_id</code></span></label>
          <label class="field"><span>Активных клиентов: <b class="tnum">${O.fmt(st.users)}</b></span><input type="range" min="10000" max="1000000" step="10000" value="${st.users}" data-users ${st.user ? '' : 'disabled'}></label>
          <div class="gf-grid">${O.panel('Временных рядов у гистограммы времени оплаты', `<div class="gf-stat ${series > 1e5 ? 'bad' : 'ok'}">${O.fmt(series)}</div><p class="small">12 рядов на комбинацию (10 корзин + _sum + _count) × ${st.endpoints} метода × ${st.statuses} статуса${st.user ? ' × ' + O.fmt(st.users) + ' клиентов' : ''}.</p>`)}${O.panel('Памяти у хранилища метрик, примерно', `<div class="gf-stat ${mem > 1024 ? 'bad' : 'ok'}">${mem > 1024 ? (mem / 1024).toFixed(1) + ' ГБ' : Math.max(1, Math.round(mem * 1024)) + ' КБ'}</div><p class="small">Около 3 КБ на активный ряд. ${st.user ? 'Это одна метрика — а их сотни.' : 'Без метки клиента — копейки.'}</p>`)}</div></div>`;
      };
      el.addEventListener('change', e => { if (e.target.matches('[data-user]')) { st.user = e.target.checked; draw(); } });
      el.addEventListener('input', e => { if (e.target.matches('[data-users]')) { st.users = +e.target.value; draw(); } });
      draw();
    },
    explain: '<p><b>Кардинальность</b> — число разных комбинаций меток. Каждая комбинация — отдельный временной ряд, и хранилище метрик держит их все в памяти. Метки с номером клиента, заказа, запроса, адресом, временем — классическая причина падения Prometheus. Правило для постановки: метки — только из небольших фиксированных наборов; всё, что про конкретный объект, — в логи и трассы.</p>',
    report: ans => (ans.q || []).length ? CARD[ans.q[0]].t : '—'
  };

  // =====================================================================
  // Практика 4. «Среднее 520 мс — всё отлично?»
  const AVG = [
    { t: 'Не знаем: среднее не говорит, сколько клиентов ждали дольше двух секунд. Нужен p95 — время, быстрее которого прошли 95 % платежей, — и доля неуспешных', ok: true, why: 'Да: требование Лены сформулировано про 95 % клиентов.', because: 'Лена сказала: «у почти всех — две секунды». Это перцентиль: p95 ≤ 2 с. Среднее 520 мс совместимо и с тем, что все довольны, и с тем, что каждый двадцатый ждёт пять секунд. А в понедельник среднее вообще не сдвинулось, пока 13 % платежей обрывались на таймауте: оборванный за секунду платёж «быстрый».' },
    { t: 'Да: 520 мс гораздо меньше двух секунд', why: 'Среднее прячет хвост: десятки медленных платежей почти не сдвигают его.' },
    { t: 'Смотреть максимум: он покажет худший случай', why: 'Максимум — один выброс, который бывает всегда. По нему нельзя понять, плохо ли многим.' },
    { t: 'Смотреть медиану: половина платежей быстрее', why: 'Медиана говорит про половину клиентов. Требование Лены — про 95 %.' }
  ];
  const avgTask = {
    id: 'avg', title: 'Разработчик: «Среднее время оплаты 520 мс — всё отлично»',
    lead: ui.brief({ situation: 'На старом дашборде оплаты одна панель: среднее время ответа. В понедельник весь инцидент оно показывало около 520 мс.', todo: ['Выберите ответ.', 'Нажмите «Проверить».'], look: 'Лаборатория «Среднее прячет тех, кому плохо». И что Лена сказала про две секунды.' }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: [0] }),
    render(el, ctx) {
      const s = S();
      el.innerHTML = O.panel('Старый дашборд: среднее время оплаты, мс', O.chart({ series: [{ name: 'среднее', color: 'var(--ok)', data: s.avg }], labels: O.labels(s.n), annotations: [{ i: s.deployIdx, label: 'выкатка 2.31' }], yMax: 2000 }), { wide: true }) + '<div data-q style="margin-top:12px"></div>';
      O.hover(el);
      ui.quiz(TR.$('[data-q]', el), { q: 'Всё отлично?', options: AVG, value: ctx.ans.q, readonly: ctx.readonly, reveal: ctx.result || ctx.readonly ? true : null, seed: 'mt-avg', onChange: v => { ctx.ans.q = v; ctx.save(); } });
    },
    check(ans) { const r = ui.quizScore({ options: AVG }, ans.q || []); const i = (ans.q || [])[0]; return { ok: r.ok, score: r.score, notes: i != null && !AVG[i].ok ? [{ ok: false, html: esc(AVG[i].why) }] : [], summary: r.ok ? 'Верно.' : 'Не сходится.' }; },
    answers: ans => ui.quizAnswers('Среднее 520 мс — всё отлично?', AVG, ans.q),
    viz: (el) => {
      // Среднее, p95 и доля неуспешных за понедельник: включайте линии и смотрите, кто заметил инцидент.
      const s = S(), on = { avg: true, p95: true, err: true };
      const draw = () => {
        const lines = [];
        if (on.avg) lines.push({ name: 'среднее, мс', color: 'var(--ok)', data: s.avg });
        if (on.p95) lines.push({ name: 'p95, мс', color: 'var(--info)', data: s.p95 });
        el.innerHTML = `<div class="stack"><div class="row"><label class="toggle"><input type="checkbox" data-l="avg" ${on.avg ? 'checked' : ''}> <span>Среднее</span></label><label class="toggle"><input type="checkbox" data-l="p95" ${on.p95 ? 'checked' : ''}> <span>p95</span></label><label class="toggle"><input type="checkbox" data-l="err" ${on.err ? 'checked' : ''}> <span>Доля неуспешных</span></label></div>
          ${lines.length ? O.panel('Время оплаты, мс', O.chart({ series: lines, labels: O.labels(s.n), annotations: [{ i: s.deployIdx, label: '14:05' }], yMax: 2000 }), { wide: true }) : ''}
          ${on.err ? O.panel('Доля неуспешных платежей, %', O.chart({ series: [{ name: 'неуспешные, %', color: 'var(--bad)', data: s.errPct }], labels: O.labels(s.n), annotations: [{ i: s.deployIdx, label: '14:05' }], yFmt: v => v.toFixed(0) + ' %' }), { wide: true }) : ''}
          <p class="small">Среднее не заметило инцидент вовсе. p95 после 14:05 лёг ровно на 1000 мс — это потолок таймаута: платежи не стали медленнее, их стали обрывать. А доля неуспешных взлетела. Время и доля сбоев — два разных вопроса, нужны оба.</p></div>`;
        O.hover(el);
      };
      el.addEventListener('change', e => { const l = e.target.dataset.l; if (l) { on[l] = e.target.checked; draw(); } });
      draw();
    },
    explain: '<p>Время меряют <b>перцентилями</b>, долю сбоев — <b>отдельной метрикой</b>. Средняя линия в понедельник была ровной весь инцидент: оборванные на секунде платежи даже тянули её вниз. Требование «две секунды у 95 %» записывают так, чтобы его можно было проверить: <code>histogram_quantile(0.95, sum by (le) (rate(payment_duration_seconds_bucket[5m]))) &lt; 2</code>.</p>',
    report: ans => (ans.q || []).length ? AVG[ans.q[0]].t : '—'
  };

  TR.stage({
    id: ID, act: 2, order: 30, slot: 'Ср', title: 'Метрики: сколько и как быстро',
    when: 'среда · числа вместо строк',
    intro: [
      { who: 'lena', html: 'Я не хочу узнавать о проблемах от Нади. Мне нужен один график: какая доля оплат не проходит прямо сейчас. Это сложно?' },
      { who: 'gosha', html: 'Не сложно, если правильно завести метрики. Сегодня — какие они бывают, как их смотреть и почему среднее время врёт. И почему нельзя вешать на метрику номер клиента.' }
    ],
    facts: ['F-slo', 'F-latency', 'F-biz'],
    glossary: [
      { term: 'Счётчик (counter)', simple: 'Число, которое только растёт: сколько событий было.', tech: 'Монотонно растущее значение, обнуляется при перезапуске. Смотрят через rate()/increase().' },
      { term: 'Датчик (gauge)', simple: 'Значение прямо сейчас, растёт и падает.', tech: 'Текущее значение: очередь, память, лаг. Смотрят как есть или avg/max_over_time.' },
      { term: 'Гистограмма (histogram)', simple: 'Раскладка измерений по корзинам «уложились в N».', tech: 'Накопительные корзины _bucket{le}, плюс _sum и _count. Перцентили — histogram_quantile().' },
      { term: 'rate()', simple: 'Сколько в секунду — по приросту счётчика за окно.', tech: 'PromQL: среднее увеличение счётчика в секунду за окно [5m] с учётом сбросов.' },
      { term: 'Перцентиль (p95, p99)', simple: 'Время, быстрее которого прошли 95 % (99 %) запросов.', tech: 'Квантиль распределения. В SLO на задержку используют p95/p99, а не среднее.' },
      { term: 'Метка (label)', simple: 'Признак, по которому делят метрику: сервис, статус, город.', tech: 'Пара ключ–значение временного ряда. Каждая уникальная комбинация меток — отдельный ряд.' },
      { term: 'Кардинальность', simple: 'Сколько разных комбинаций меток — столько и рядов.', tech: 'Число уникальных временных рядов. Метки с неограниченными значениями (user_id, order_id) взрывают её и роняют хранилище.' },
      { term: 'SLI', simple: 'Число, по которому судят, хорошо ли работает сервис.', tech: 'Service Level Indicator: измеряемый показатель — доля успешных запросов, доля быстрых ответов.' }
    ],
    outro: 'Теперь есть число, которое говорит «плохо» за минуты до жалоб: доля неуспешных платежей. И мы знаем, что время меряют перцентилями. Завтра соберём дашборд, по которому дежурный за минуту отвечает, что сломалось и почему.',
    tasks: [howTypes, howPct, types, query, card, avgTask]
  });
})();
