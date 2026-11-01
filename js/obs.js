/* Инструменты наблюдаемости внутри тренажёра и данные инцидента недели.

   Мини-Kibana, графики в стиле Grafana и водопад трассы похожи на настоящие ровно настолько,
   чтобы руки запомнили движения: строка запроса, поля слева, гистограмма по времени, раскрытие
   записи; панель с легендой, отметками выкатки и значениями под курсором; трасса, где видно,
   кто кого ждал. Это не копия продуктов — это их устройство, которое можно потрогать.

   Данные одни на всю неделю: понедельник, 13:50–14:40, в 14:05 выкатили payment-service v2.31,
   где таймаут к банку стал 1000 мс вместо 5000. Логи вторника, метрики среды и дашборд четверга
   смотрят на один и тот же инцидент с разных сторон — как в жизни. */
'use strict';
(function () {
  const TR = window.TR, esc = TR.esc;
  const O = TR.obs = {};

  document.head.insertAdjacentHTML('beforeend', `<style>
  .kb{border:1px solid var(--border);border-radius:12px;background:var(--surface);overflow:hidden;min-width:0}
  .kb-bar{display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid var(--border);background:var(--surface-2);flex-wrap:wrap}
  .kb-q{flex:1 1 260px;min-width:0;font:13px var(--f-mono);padding:8px 10px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text)}
  .kb-q.bad{border-color:var(--bad)}
  .kb-range{display:flex;gap:4px}
  .kb-range button{font:12px var(--f-body);padding:6px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer}
  .kb-range button[aria-pressed="true"]{border-color:var(--accent);color:var(--text);background:var(--accent-soft)}
  .kb-body{display:grid;grid-template-columns:200px minmax(0,1fr);min-height:320px}
  .kb-side{border-right:1px solid var(--border);padding:10px;display:grid;gap:10px;align-content:start;font-size:13px;min-width:0}
  .kb-side h5{margin:0 0 4px;font:600 12px var(--f-mono);color:var(--text-muted)}
  .kb-val{display:flex;justify-content:space-between;gap:6px;width:100%;text-align:left;font:12.5px var(--f-mono);padding:3px 6px;border-radius:6px;border:0;background:none;color:var(--text-2);cursor:pointer}
  .kb-val:hover{background:var(--surface-2);color:var(--text)}
  .kb-val span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kb-main{padding:10px;min-width:0;display:grid;gap:8px;align-content:start}
  .kb-hits{font-size:13px;color:var(--text-2)}.kb-hits b{color:var(--text);font:700 16px var(--f-brand)}
  .kb-hist{width:100%;height:64px;display:block}
  .kb-rows{display:grid;gap:2px;font:12.5px var(--f-mono)}
  .kb-row{display:grid;grid-template-columns:76px 52px 128px minmax(0,1fr);gap:8px;align-items:baseline;padding:5px 6px;border-radius:6px;cursor:pointer;border:0;background:none;color:var(--text-2);text-align:left;font:inherit;width:100%}
  .kb-row:hover,.kb-row.open{background:var(--surface-2);color:var(--text)}
  .kb-row .m{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kb-lv{font-weight:700}.kb-lv.ERROR{color:var(--bad)}.kb-lv.WARN{color:var(--warn)}.kb-lv.INFO{color:var(--info)}.kb-lv.DEBUG{color:var(--text-muted)}
  .kb-doc{margin:2px 0 8px 6px;padding:8px 10px;border-left:3px solid var(--accent);background:var(--code-bg);border-radius:6px;font:12px/1.55 var(--f-mono);white-space:pre-wrap;overflow-x:auto}
  .kb-doc button{font:inherit;color:var(--accent);background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}
  .kb-help{font-size:12px;color:var(--text-muted)}
  .kb-help code{font-size:11.5px}
  @media (max-width:720px){.kb-body{grid-template-columns:minmax(0,1fr)}.kb-side{border-right:0;border-bottom:1px solid var(--border);grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}.kb-row{grid-template-columns:62px 44px minmax(0,1fr)}.kb-row .s{display:none}}

  .gf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
  .gf-panel{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:10px 12px 8px;min-width:0;display:grid;gap:6px;align-content:start}
  .gf-panel.wide{grid-column:1/-1}
  .gf-title{display:flex;justify-content:space-between;gap:8px;align-items:baseline;font:600 13px var(--f-body);color:var(--text)}
  .gf-title small{font:500 11.5px var(--f-mono);color:var(--text-muted)}
  .gf-chart{position:relative}
  .gf-chart svg{width:100%;height:auto;display:block;overflow:visible}
  .gf-chart .ax{fill:var(--text-muted);font:10.5px var(--f-mono)}
  .gf-chart .gl{stroke:var(--grid-line);stroke-width:1}
  .gf-tip{position:absolute;top:4px;pointer-events:none;background:var(--surface-3);border:1px solid var(--border-strong);border-radius:8px;padding:6px 8px;font:11.5px/1.45 var(--f-mono);color:var(--text);white-space:nowrap;z-index:2;box-shadow:var(--shadow)}
  .gf-tip i{display:inline-block;width:9px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .gf-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font:11.5px var(--f-mono);color:var(--text-2)}
  .gf-legend i{display:inline-block;width:10px;height:3px;border-radius:2px;margin-right:5px;vertical-align:middle}
  .gf-stat{font:700 30px/1.1 var(--f-brand);font-variant-numeric:tabular-nums}
  .gf-stat.bad{color:var(--bad)}.gf-stat.ok{color:var(--ok)}.gf-stat.warn{color:var(--warn)}
  .gf-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)}
  .gf-bar label{font:12px var(--f-body);color:var(--text-2);display:flex;gap:6px;align-items:center}
  .gf-bar select{font:12.5px var(--f-mono)}
  .gf-q{font:12.5px/1.5 var(--f-mono);padding:8px 10px;border-radius:8px;background:var(--code-bg);border:1px solid var(--border);overflow-x:auto;white-space:pre}

  .tw{border:1px solid var(--border);border-radius:12px;background:var(--surface);padding:10px;display:grid;gap:4px;min-width:0}
  .tw-head{display:grid;grid-template-columns:minmax(120px,34%) minmax(0,1fr);font:11px var(--f-mono);color:var(--text-muted);padding:0 4px 4px}
  .tw-head div:last-child{display:flex;justify-content:space-between}
  .tw-row{display:grid;grid-template-columns:minmax(120px,34%) minmax(0,1fr);align-items:center;gap:0;border:0;background:none;color:var(--text);font:12.5px var(--f-mono);padding:3px 4px;border-radius:6px;cursor:pointer;text-align:left;width:100%}
  .tw-row:hover{background:var(--surface-2)}.tw-row.on{background:var(--accent-soft);outline:1px solid var(--accent)}
  .tw-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tw-name small{color:var(--text-muted)}
  .tw-track{position:relative;height:18px}
  .tw-bar{position:absolute;top:3px;height:12px;border-radius:4px;min-width:2px}
  .tw-bar.err{outline:2px solid var(--bad)}
  .tw-dur{position:absolute;top:1px;font:10.5px var(--f-mono);color:var(--text-2);white-space:nowrap}
  .tw-info{border-top:1px solid var(--border);margin-top:6px;padding-top:8px;font:12px/1.55 var(--f-mono);white-space:pre-wrap;color:var(--text-2)}
  @media (max-width:520px){.tw-head,.tw-row{grid-template-columns:minmax(96px,40%) minmax(0,1fr)}}
  </style>`);

  // ---------- время ----------
  const pad = n => String(n).padStart(2, '0');
  O.hhmm = ms => { const d = new Date(ms); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); };
  O.hhmmss = ms => { const d = new Date(ms); return O.hhmm(ms) + ':' + pad(d.getUTCSeconds()); };
  O.fmt = n => Number(n).toLocaleString('ru-RU');

  // ---------- данные недели ----------
  // Понедельник 03.11, время в UTC-миллисекундах «как будто по Москве» — без поясов, чтобы у всех одинаково.
  const T = h => Date.UTC(2026, 10, 2, 0, 0) + h;
  const MIN = 60000;
  O.T0 = T(13 * 60 * MIN + 50 * MIN);
  O.T1 = T(14 * 60 * MIN + 40 * MIN);
  O.DEPLOY = T(14 * 60 * MIN + 5 * MIN);
  // Заказ из жалобы поддержки — первый после 14:07:20; его платёж не проходит.
  const COMPLAINT_AT = T(14 * 60 * MIN + 7 * MIN + 20000);
  let COMPLAINT = null, BANK = null;

  function buildLogs() {
    const r = TR.rand('duty-logs'), docs = [];
    const trace = () => Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join('');
    const add = (at, d) => docs.push(Object.assign({ '@timestamp': at }, d));
    const pods = { checkout: ['checkout-7f9c-1', 'checkout-7f9c-2'], payment: ['payment-5d2a-1', 'payment-5d2a-2'], warehouse: ['warehouse-1'], bonus: ['bonus-3b1-1'] };
    const pod = s => pods[s][Math.floor(r() * pods[s].length)];
    let i = 0;
    BANK = [];
    for (let at = O.T0; at < O.T1; at += 2500 + Math.floor(r() * 3000), i++) {
      const t = at, id = 1001 + i, tr = trace(), cust = 'c-' + (50000 + Math.floor(r() * 9000));
      const v = t >= O.DEPLOY ? '2.31' : '2.30', limit = t >= O.DEPLOY ? 1000 : 5000;
      let bank = Math.round(300 + 1300 * Math.pow(r(), 4));
      const mine = !COMPLAINT && t >= COMPLAINT_AT;
      if (mine) { bank = 1480; COMPLAINT = { id, at: t, trace: tr }; }
      // Сколько на самом деле отвечал банк — шлюз видит это и тогда, когда платёж уже отменён по таймауту.
      BANK.push({ at: t + 180, ms: bank });
      const declined = !mine && r() < 0.025;
      add(t, { level: 'INFO', service: 'checkout', host: pod('checkout'), version: '1.18', event: 'order.created', message: `Заказ ${id} создан, сумма ${900 + Math.floor(r() * 3000)} ₽`, order_id: id, trace_id: tr, customer_id: cust });
      add(t + 180, { level: 'INFO', service: 'payment', host: pod('payment'), version: v, event: 'payment.requested', message: `Запрос в банк по заказу ${id}`, order_id: id, trace_id: tr });
      if (declined) {
        add(t + 180 + bank, { level: 'INFO', service: 'payment', host: pod('payment'), version: v, event: 'payment.declined', message: `Банк отказал по заказу ${id}: недостаточно средств`, order_id: id, trace_id: tr, duration_ms: bank, 'error.code': 'INSUFFICIENT_FUNDS', 'http.status': 402 });
        add(t + 240 + bank, { level: 'INFO', service: 'checkout', host: pod('checkout'), version: '1.18', event: 'order.payment_declined', message: `Клиенту показан отказ банка по заказу ${id}`, order_id: id, trace_id: tr });
        continue;
      }
      if (bank > limit) {
        add(t + 180 + limit, { level: 'ERROR', service: 'payment', host: pod('payment'), version: v, event: 'payment.failed', message: `Банк не ответил за ${limit} мс — платёж по заказу ${id} не прошёл`, order_id: id, trace_id: tr, duration_ms: limit, 'error.code': 'BANK_TIMEOUT', 'http.status': 504 });
        add(t + 230 + limit, { level: 'WARN', service: 'checkout', host: pod('checkout'), version: '1.18', event: 'order.payment_failed', message: `Оплата заказа ${id} не прошла, клиенту показана ошибка «Попробуйте ещё раз»`, order_id: id, trace_id: tr });
        continue;
      }
      add(t + 180 + bank, { level: 'INFO', service: 'payment', host: pod('payment'), version: v, event: 'payment.succeeded', message: `Банк подтвердил оплату заказа ${id} за ${bank} мс`, order_id: id, trace_id: tr, duration_ms: bank, 'http.status': 200 });
      add(t + 260 + bank, { level: 'INFO', service: 'checkout', host: pod('checkout'), version: '1.18', event: 'order.paid', message: `Заказ ${id} оплачен`, order_id: id, trace_id: tr });
      add(t + 900 + bank, { level: 'INFO', service: 'warehouse', host: pod('warehouse'), version: '3.4', event: 'assembly.queued', message: `Заказ ${id} передан на сборку`, order_id: id, trace_id: tr });
      if (i % 3 === 0) {
        const phone = '+7916' + String(1000000 + Math.floor(r() * 8999999));
        add(t + 1400 + bank, { level: 'INFO', service: 'bonus', host: pod('bonus'), version: '0.9', event: 'bonus.accrued', message: `Начислено ${Math.floor(r() * 150) + 20} баллов клиенту ${phone}`, order_id: id, trace_id: tr, customer_id: cust });
      }
      if (r() < 0.03) add(t + 1100 + bank, { level: 'WARN', service: 'warehouse', host: pod('warehouse'), version: '3.4', event: 'printer.retry', message: 'Принтер этикеток не ответил, повтор прошёл со второй попытки', order_id: id, trace_id: tr });
    }
    add(O.DEPLOY - 20000, { level: 'INFO', service: 'payment', host: 'payment-5d2a-1', version: '2.31', event: 'service.started', message: 'payment-service 2.31 запущен: bank.timeout_ms=1000 (было 5000)' });
    return docs.sort((a, b) => a['@timestamp'] - b['@timestamp']);
  }
  let LOGS = null;
  O.logs = () => (LOGS = LOGS || buildLogs());
  /** Заказ из жалобы: номер, время и trace_id. */
  O.complaint = () => { O.logs(); return COMPLAINT; };

  /** Метрики по минутам из тех же логов: запросы оплаты, ошибки, перцентили времени банка. */
  let SERIES = null;
  O.series = () => {
    if (SERIES) return SERIES;
    const n = Math.round((O.T1 - O.T0) / MIN), m = i => Math.floor((i - O.T0) / MIN);
    const req = Array(n).fill(0), fail = Array(n).fill(0), declined = Array(n).fill(0), ok = Array(n).fill(0), paid = Array(n).fill(0), dur = Array.from({ length: n }, () => []);
    for (const d of O.logs()) {
      const k = m(d['@timestamp']); if (k < 0 || k >= n) continue;
      if (d.event === 'payment.requested') req[k]++;
      if (d.event === 'payment.failed') { fail[k]++; dur[k].push(d.duration_ms); }
      if (d.event === 'payment.declined') declined[k]++;
      if (d.event === 'payment.succeeded') { ok[k]++; dur[k].push(d.duration_ms); }
      if (d.event === 'order.paid') paid[k]++;
    }
    const bank = Array.from({ length: n }, () => []);
    BANK.forEach(b => { const k = m(b.at); if (k >= 0 && k < n) bank[k].push(b.ms); });
    const q = (arr, p) => { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    // Окно в пять минут — как rate(…[5m]) и histogram_quantile по пятиминутному окну: по минуте из
    // пятнадцати платежей перцентиль скачет и ничего не говорит.
    const win = (arr, i) => arr.slice(Math.max(0, i - 4), i + 1).flat();
    const sum5 = (arr, i) => arr.slice(Math.max(0, i - 4), i + 1).reduce((s, x) => s + x, 0);
    const r = TR.rand('duty-cpu');
    SERIES = {
      n, req, fail, ok, declined, paid,
      errPct: req.map((x, i) => { const a = sum5(req, i); return a ? Math.round(sum5(fail, i) / a * 1000) / 10 : 0; }),
      p50: dur.map((a, i) => q(win(dur, i), 0.5)), p95: dur.map((a, i) => q(win(dur, i), 0.95)), p99: dur.map((a, i) => q(win(dur, i), 0.99)),
      avg: dur.map((a, i) => { const w = win(dur, i); return w.length ? Math.round(w.reduce((s, x) => s + x, 0) / w.length) : null; }),
      bankP95: bank.map((a, i) => q(win(bank, i), 0.95)), bankP50: bank.map((a, i) => q(win(bank, i), 0.5)),
      cpu: Array.from({ length: n }, () => Math.round(31 + r() * 9)),
      deployIdx: m(O.DEPLOY)
    };
    return SERIES;
  };

  // ---------- строка запроса (как KQL, только нужная часть) ----------
  // Слова через пробел — все должны совпасть. field:value — поле равно (value* — начинается с),
  // field>число, field<число, NOT или «-» перед условием — исключить. Слово без поля ищется в message.
  const get = (doc, f) => doc[f];
  O.parseQuery = q => {
    const parts = String(q || '').match(/-?"[^"]*"|\S+/g) || [], out = [];
    let neg = false;
    for (let p of parts) {
      if (/^(AND|and|И)$/.test(p)) continue;
      if (/^(NOT|not|НЕ)$/.test(p)) { neg = true; continue; }
      if (p.startsWith('-') && p.length > 1) { neg = true; p = p.slice(1); }
      const m = p.match(/^([\w.@]+)(:|>=|<=|>|<)(.*)$/);
      if (m) {
        const v = m[3].replace(/^"|"$/g, '');
        if (v === '') return { error: `После «${m[1]}${m[2]}» нужно значение` };
        out.push({ field: m[1], op: m[2], value: v, neg });
      } else out.push({ field: null, op: ':', value: p.replace(/^"|"$/g, ''), neg });
      neg = false;
    }
    return { terms: out };
  };
  O.match = (doc, parsed) => parsed.terms.every(t => {
    let hit;
    if (!t.field) hit = String(doc.message || '').toLowerCase().includes(t.value.toLowerCase());
    else {
      const v = get(doc, t.field);
      if (v === undefined) hit = false;
      else if (t.op === ':') hit = t.value.endsWith('*') ? String(v).toLowerCase().startsWith(t.value.slice(0, -1).toLowerCase()) : String(v).toLowerCase() === t.value.toLowerCase();
      else { const a = Number(v), b = Number(t.value); hit = t.op === '>' ? a > b : t.op === '<' ? a < b : t.op === '>=' ? a >= b : a <= b; }
    }
    return t.neg ? !hit : hit;
  });

  // ---------- мини-Kibana ----------
  // cfg: { docs, value:{ q, range }, fields:[…], onChange(value, hits), readonly, sample? }
  const RANGES = [{ v: 'all', t: '13:50–14:40' }, { v: 'before', t: 'до 14:05' }, { v: 'after', t: 'после 14:05' }];
  O.kibana = (el, cfg) => {
    const val = Object.assign({ q: '', range: 'all' }, cfg.value || {});
    let open = null;
    const fields = cfg.fields || ['level', 'service', 'event', 'error.code', 'version', 'host'];
    function inRange(d) { const t = d['@timestamp']; return val.range === 'before' ? t < O.DEPLOY : val.range === 'after' ? t >= O.DEPLOY : true; }
    function draw(focus) {
      const parsed = O.parseQuery(val.q), base = cfg.docs.filter(inRange);
      const hits = parsed.error ? [] : base.filter(d => O.match(d, parsed));
      const n = Math.round((O.T1 - O.T0) / MIN), bins = Array(n).fill(0);
      hits.forEach(d => { const k = Math.floor((d['@timestamp'] - O.T0) / MIN); if (k >= 0 && k < n) bins[k]++; });
      const mx = Math.max(1, ...bins), W = 600, H = 64, bw = W / n;
      const hist = `<svg class="kb-hist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Сколько записей по минутам">${bins.map((b, i) => `<rect x="${(i * bw + 1).toFixed(1)}" y="${(H - 12 - b / mx * (H - 16)).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(b / mx * (H - 16)).toFixed(1)}" style="fill:var(--accent)" opacity=".75"><title>${O.hhmm(O.T0 + i * MIN)} — ${b}</title></rect>`).join('')}<line x1="${((O.DEPLOY - O.T0) / MIN * bw).toFixed(1)}" x2="${((O.DEPLOY - O.T0) / MIN * bw).toFixed(1)}" y1="0" y2="${H - 12}" style="stroke:var(--warn);stroke-dasharray:3 3"/><text x="2" y="${H - 1}" style="fill:var(--text-muted);font:10px var(--f-mono)">13:50</text><text x="${W - 34}" y="${H - 1}" style="fill:var(--text-muted);font:10px var(--f-mono)">14:40</text></svg>`;
      const top = f => { const c = new Map(); hits.forEach(d => { const v = get(d, f); if (v !== undefined) c.set(v, (c.get(v) || 0) + 1); }); return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); };
      const shown = hits.slice(0, 60);
      const doc = d => `<div class="kb-doc">${esc(JSON.stringify(d, (k, v) => k === '@timestamp' ? '2026-11-02T' + O.hhmmss(v) + '+03:00' : v, 2))}${d.trace_id ? `\n<button type="button" data-trace="${esc(d.trace_id)}">Все записи этого запроса (trace_id)</button>` : ''}</div>`;
      el.innerHTML = `<div class="kb">
        <div class="kb-bar"><input class="kb-q ${parsed.error ? 'bad' : ''}" type="text" value="${esc(val.q)}" placeholder="Например: service:payment level:ERROR" aria-label="Строка запроса" spellcheck="false" ${cfg.readonly ? 'readonly' : ''}>
          <div class="kb-range" role="group" aria-label="Время">${RANGES.map(x => `<button type="button" data-range="${x.v}" aria-pressed="${val.range === x.v}" ${cfg.readonly ? 'disabled' : ''}>${x.t}</button>`).join('')}</div></div>
        <div class="kb-body"><div class="kb-side">${fields.map(f => `<div><h5>${esc(f)}</h5>${top(f).map(([v, c]) => `<button type="button" class="kb-val" data-add="${esc(f)}:${esc(String(v).includes(' ') ? '"' + v + '"' : v)}" ${cfg.readonly ? 'disabled' : ''}><span>${esc(v)}</span><span>${c}</span></button>`).join('') || '<span class="kb-help">нет</span>'}</div>`).join('')}</div>
        <div class="kb-main"><div class="kb-hits">${parsed.error ? `<span style="color:var(--bad)">${esc(parsed.error)}</span>` : `Найдено <b class="tnum">${O.fmt(hits.length)}</b> ${TR.plural(hits.length, 'запись', 'записи', 'записей')}${hits.length > shown.length ? ` · показаны первые ${shown.length}` : ''}`}</div>${hist}
          <div class="kb-rows">${shown.map((d, i) => `<button type="button" class="kb-row ${open === i ? 'open' : ''}" data-open="${i}"><span>${O.hhmmss(d['@timestamp'])}</span><span class="kb-lv ${d.level}">${d.level}</span><span class="s">${esc(d.service)}</span><span class="m">${esc(d.message)}</span></button>${open === i ? doc(d) : ''}`).join('')}</div>
          <div class="kb-help">Запрос: <code>поле:значение</code> через пробел — все условия сразу; <code>NOT</code> или <code>-</code> — исключить; <code>duration_ms&gt;1000</code>; слово без поля ищется в тексте сообщения. Нажмите на значение слева — оно добавится в запрос.</div></div></div></div>`;
      const inp = el.querySelector('.kb-q');
      if (focus) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      cfg.onChange && cfg.onChange(Object.assign({}, val), hits);
    }
    el.addEventListener('input', e => { if (!e.target.matches('.kb-q')) return; val.q = e.target.value; open = null; draw(true); });
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || cfg.readonly && !b.dataset.open) return;
      if (b.dataset.range) { val.range = b.dataset.range; open = null; draw(); }
      else if (b.dataset.add) { const t = b.dataset.add; val.q = val.q.split(/\s+/).includes(t) ? val.q : (val.q.trim() + ' ' + t).trim(); open = null; draw(); }
      else if (b.dataset.open) { const i = +b.dataset.open; open = open === i ? null : i; draw(); }
      else if (b.dataset.trace) { if (cfg.readonly) return; val.q = 'trace_id:' + b.dataset.trace; val.range = 'all'; open = null; draw(); }
    });
    draw();
    return { set(q, range) { val.q = q; if (range) val.range = range; open = null; draw(); } };
  };

  // ---------- графики ----------
  // cfg: { series:[{ name, color, data }], labels:[…] (подписи по оси X), yFmt, height, yMax, annotations:[{ i, label }], thresholds:[{ v, label }], id }
  let chartId = 0;
  O.chart = cfg => {
    const W = 640, H = cfg.height || 170, L = 44, R = 10, Tp = 10, B = 22;
    const all = cfg.series.flatMap(s => s.data.filter(v => v != null));
    const yMax = cfg.yMax || Math.max(1, ...all, ...(cfg.thresholds || []).map(t => t.v)) * 1.12;
    const n = Math.max(...cfg.series.map(s => s.data.length)), x = i => L + (n <= 1 ? 0 : i / (n - 1) * (W - L - R)), y = v => Tp + (1 - v / yMax) * (H - Tp - B);
    const fmt = cfg.yFmt || (v => String(Math.round(v)));
    const ticks = [0, 0.5, 1].map(f => f * yMax);
    const lab = cfg.labels || [];
    const xs = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
    const path = s => { let d = '', pen = false; s.data.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; pen = true; }); return d; };
    const id = 'gfc' + (++chartId);
    const json = esc(JSON.stringify({ n, L, R, W, labels: lab, series: cfg.series.map(s => ({ name: s.name, color: s.color, data: s.data.map(v => v == null ? null : fmt(v)) })) }));
    return `<div class="gf-chart" data-gf="${json}" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.aria || cfg.series.map(s => s.name).join(', '))}">
      ${ticks.map(t => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="ax" x="${L - 6}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end">${esc(fmt(t))}</text>`).join('')}
      ${xs.map(i => `<text class="ax" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(lab[i] || '')}</text>`).join('')}
      ${(cfg.thresholds || []).map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t.v).toFixed(1)}" y2="${y(t.v).toFixed(1)}" style="stroke:var(--bad);stroke-dasharray:6 4;opacity:.8"/><text class="ax" x="${W - R}" y="${(y(t.v) - 4).toFixed(1)}" text-anchor="end" style="fill:var(--bad)">${esc(t.label || '')}</text>`).join('')}
      ${(cfg.annotations || []).map(a => `<line x1="${x(a.i).toFixed(1)}" x2="${x(a.i).toFixed(1)}" y1="${Tp}" y2="${H - B}" style="stroke:var(--warn);stroke-dasharray:3 3"/><text class="ax" x="${(x(a.i) + 4).toFixed(1)}" y="${Tp + 10}" style="fill:var(--warn)">${esc(a.label)}</text>`).join('')}
      ${cfg.series.map(s => `<path d="${path(s)}" style="fill:none;stroke:${s.color};stroke-width:2;stroke-linejoin:round"/>`).join('')}
      <line class="gf-cross" x1="0" x2="0" y1="${Tp}" y2="${H - B}" style="stroke:var(--text-muted);opacity:0"/>
      </svg></div>${cfg.series.length > 1 ? `<div class="gf-legend">${cfg.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}`;
  };
  /** Подсказка под курсором для всех графиков внутри root: время и значения всех линий. */
  O.hover = root => {
    root.querySelectorAll('.gf-chart').forEach(box => {
      if (box.dataset.bound) return; box.dataset.bound = '1';
      const cfg = JSON.parse(box.dataset.gf), svg = box.querySelector('svg'), cross = box.querySelector('.gf-cross');
      let tip = null;
      const at = e => { const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * cfg.W; return Math.max(0, Math.min(cfg.n - 1, Math.round((px - cfg.L) / (cfg.W - cfg.L - cfg.R) * (cfg.n - 1)))); };
      const show = e => {
        const i = at(e), r = svg.getBoundingClientRect(), xx = cfg.L + i / Math.max(1, cfg.n - 1) * (cfg.W - cfg.L - cfg.R);
        cross.setAttribute('x1', xx); cross.setAttribute('x2', xx); cross.style.opacity = .6;
        if (!tip) { tip = document.createElement('div'); tip.className = 'gf-tip'; box.appendChild(tip); }
        tip.innerHTML = `<b>${esc(cfg.labels[i] || '')}</b>` + cfg.series.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b>${esc(s.data[i] == null ? '—' : s.data[i])}</b></div>`).join('');
        const left = xx / cfg.W * r.width;
        tip.style.left = Math.min(Math.max(0, left + 12), r.width - tip.offsetWidth - 4) + 'px';
      };
      const hide = () => { cross.style.opacity = 0; if (tip) { tip.remove(); tip = null; } };
      box.addEventListener('mousemove', show); box.addEventListener('mouseleave', hide);
      box.addEventListener('touchstart', e => show(e.touches[0]), { passive: true });
    });
  };
  O.panel = (title, body, opts) => `<div class="gf-panel ${opts && opts.wide ? 'wide' : ''}"><div class="gf-title"><span>${esc(title)}</span>${opts && opts.sub ? `<small>${esc(opts.sub)}</small>` : ''}</div>${body}</div>`;
  O.labels = n => Array.from({ length: n }, (_, i) => O.hhmm(O.T0 + i * MIN));

  // ---------- водопад трассы ----------
  // cfg: { spans:[{ id, parent, name, service, start, dur, err, attrs }], value, onPick(id), readonly, color(service) }
  const SVC = { checkout: 'var(--accent)', promo: 'var(--violet)', payment: 'var(--info)', bank: 'var(--warn)', kafka: 'var(--cyan)', db: 'var(--pink)', warehouse: 'var(--ok)' };
  O.trace = (el, cfg) => {
    let picked = cfg.value || null;
    const spans = cfg.spans, total = Math.max(...spans.map(s => s.start + s.dur));
    const depth = s => { let d = 0, p = s.parent; while (p) { d++; p = (spans.find(x => x.id === p) || {}).parent; } return d; };
    function draw() {
      const sel = spans.find(s => s.id === picked);
      el.innerHTML = `<div class="tw"><div class="tw-head"><div>Спан</div><div><span>0 мс</span><span>${O.fmt(Math.round(total / 2))} мс</span><span>${O.fmt(total)} мс</span></div></div>
        ${spans.map(s => `<button type="button" class="tw-row ${picked === s.id ? 'on' : ''}" data-span="${esc(s.id)}" ${cfg.readonly ? 'disabled' : ''}><span class="tw-name" style="padding-left:${depth(s) * 12}px">${esc(s.name)} <small>${esc(s.service)}</small></span><span class="tw-track"><span class="tw-bar ${s.err ? 'err' : ''}" style="left:${(s.start / total * 100).toFixed(2)}%;width:${Math.max(0.4, s.dur / total * 100).toFixed(2)}%;background:${SVC[s.service] || 'var(--text-muted)'}"></span><span class="tw-dur" style="left:${Math.min(86, (s.start + s.dur) / total * 100 + 1).toFixed(2)}%">${O.fmt(s.dur)} мс</span></span></button>`).join('')}
        ${sel ? `<div class="tw-info">${esc(sel.name)} · ${esc(sel.service)}\nначало: ${O.fmt(sel.start)} мс · длительность: ${O.fmt(sel.dur)} мс${sel.err ? ' · ОШИБКА' : ''}${sel.attrs ? '\n' + Object.entries(sel.attrs).map(([k, v]) => k + ' = ' + v).join('\n') : ''}</div>` : '<div class="tw-info">Нажмите на спан — покажу его атрибуты.</div>'}</div>`;
    }
    el.addEventListener('click', e => { const b = e.target.closest('[data-span]'); if (!b || cfg.readonly) return; picked = b.dataset.span; draw(); cfg.onPick && cfg.onPick(picked); });
    draw();
    return { get value() { return picked; } };
  };
})();
