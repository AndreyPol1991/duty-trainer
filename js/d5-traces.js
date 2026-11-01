/* День 5 · Пятница. Трассы: водопад спанов, N+1 и последовательные вызовы, сквозной trace_id, сэмплирование.
   Ключ преподавателя — _dev/KEY.md, раздел «Пятница». */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc, O = TR.obs;
  const ID = 'traces';

  document.head.insertAdjacentHTML('beforeend', `<style>
  .tr-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
  .tr-f{display:grid;gap:4px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface)}
  .tr-f.ok{border-color:var(--ok);background:var(--ok-soft)}.tr-f.bad{border-color:var(--bad);background:var(--bad-soft)}
  .tr-f label{font-size:13px;color:var(--text-2)}
  .tr-total{font:700 26px/1.1 var(--f-brand);font-variant-numeric:tabular-nums}
  .tr-chain{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font:12.5px var(--f-mono)}
  .tr-node{border:1px solid var(--border);border-radius:8px;padding:6px 8px;background:var(--surface-2);min-width:0}
  .tr-node b{display:block;font:600 12px var(--f-body)}
  .tr-node.cut{border-color:var(--bad);background:var(--bad-soft)}
  </style>`);

  // Медленное оформление пятницы: N+1 к ценам и два независимых вызова друг за другом.
  function checkoutSpans(fixN1, parallel) {
    const sp = [{ id: 'root', name: 'POST /checkout', service: 'checkout', start: 0, dur: 0, attrs: { 'order.items': 12, 'http.status': 200 } }];
    let t = 20;
    sp.push({ id: 'promo', parent: 'root', name: 'promo.apply', service: 'promo', start: t, dur: 60, attrs: { 'promo.code': 'OSEN10' } }); t += 60;
    if (fixN1) { sp.push({ id: 'price', parent: 'root', name: 'SELECT prices WHERE item_id IN (…12)', service: 'db', start: t, dur: 90, attrs: { 'db.rows': 12 } }); t += 90; }
    else for (let i = 0; i < 12; i++) { sp.push({ id: 'price' + i, parent: 'root', name: `SELECT price WHERE item_id = ${4410 + i}`, service: 'db', start: t, dur: 80, attrs: { 'db.rows': 1 } }); t += 80; }
    sp.push({ id: 'pay', parent: 'root', name: 'POST /payments', service: 'payment', start: t, dur: 1200, attrs: { 'peer': 'payment-service' } });
    sp.push({ id: 'bank', parent: 'pay', name: 'bank.authorize', service: 'bank', start: t + 40, dur: 1110, attrs: { 'peer': 'bank-gateway' } }); t += 1200;
    if (parallel) {
      sp.push({ id: 'inv', parent: 'root', name: 'inventory.reserve', service: 'warehouse', start: t, dur: 700 });
      sp.push({ id: 'dlv', parent: 'root', name: 'delivery.estimate', service: 'warehouse', start: t, dur: 500 }); t += 700;
    } else {
      sp.push({ id: 'inv', parent: 'root', name: 'inventory.reserve', service: 'warehouse', start: t, dur: 700 }); t += 700;
      sp.push({ id: 'dlv', parent: 'root', name: 'delivery.estimate', service: 'warehouse', start: t, dur: 500 }); t += 500;
    }
    sp.push({ id: 'kafka', parent: 'root', name: 'kafka.publish OrderPaid', service: 'kafka', start: t, dur: 8 }); t += 8;
    sp.push({ id: 'render', parent: 'root', name: 'render response', service: 'checkout', start: t, dur: 22 }); t += 22;
    sp[0].dur = t;
    return sp;
  }
  const totalOf = (a, b) => checkoutSpans(a, b)[0].dur;

  // =====================================================================
  // Теория 1. Водопад
  const howTrace = {
    id: 'how-trace', title: 'Как это работает: водопад трассы — кто кого ждал', covers: ['slow'], free: true, noReset: true,
    simple: { icon: '🌊', plain: 'Трасса — один запрос, разложенный на шаги. Каждый шаг (спан) — полоска: где начался и сколько длился. Вложенные полоски — то, что шаг вызывал внутри. Сразу видно, где запрос ждал, какие шаги шли друг за другом и что можно было делать одновременно.', analogy: 'Диаграмма Ганта для одного заказа в ресторане: официант принял, повар жарил, бармен ждал, пока повар закончит, хотя мог наливать одновременно. Видно, где теряли время.', tech: 'Distributed tracing: trace — дерево span-ов с общим trace_id; у span-а — имя, сервис, начало, длительность, атрибуты, статус. Водопад (waterfall) в Jaeger/Tempo/Zipkin. Типичные находки: N+1 (лесенка одинаковых коротких запросов), последовательные независимые вызовы, долгое ожидание внешней системы.' },
    lead: ui.brief({ situation: 'Пятница. Надя: «Пишут, что оформление тормозит три-четыре секунды». Доля ошибок на дашборде ноль, p95 оплаты в норме. Гоша открывает трассу одного медленного оформления.', todo: ['Нажмите на спаны — посмотрите атрибуты.', 'Включите «Исправить N+1» и «Склад и доставку параллельно» — смотрите, как меняется общее время.'], look: 'Лесенка из одинаковых коротких запросов — и два вызова друг за другом, которые друг от друга не зависят.' }),
    render(el, ctx) {
      const a = ctx.ans;
      el.innerHTML = `<div class="stack"><div class="row"><label class="toggle"><input type="checkbox" data-n1 ${a.n1 ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> <span>Исправить N+1: один запрос цен на все позиции</span></label><label class="toggle"><input type="checkbox" data-par ${a.par ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> <span>Склад и доставку параллельно</span></label></div>
        <div class="row between"><span class="small">Оформление заказа целиком:</span><span class="tr-total">${O.fmt(totalOf(a.n1, a.par))} мс</span></div><div data-tw></div></div>`;
      O.trace(TR.$('[data-tw]', el), { spans: checkoutSpans(a.n1, a.par), readonly: false, onPick: () => { a.picked = 1; ctx.save(); if (a.n1 && a.par) ctx.ready(); } });
      el.addEventListener('change', e => { if (e.target.matches('[data-n1]')) a.n1 = e.target.checked; if (e.target.matches('[data-par]')) a.par = e.target.checked; ctx.save(); ctx.rerender(); });
      if ((a.n1 && a.par) || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Теория 2. Сквозной trace_id
  const HOPS = [{ id: 'app', t: 'Приложение' }, { id: 'checkout', t: 'checkout' }, { id: 'payment', t: 'payment' }, { id: 'kafka', t: 'Kafka', via: 'kafka' }, { id: 'bonus', t: 'bonus' }];
  function chain(http, kafka) {
    const C = O.complaint(), other = 'b71e0c5d92aa4f13';
    let cur = C.trace, out = '';
    HOPS.forEach((h, i) => {
      if (i > 0) { const lost = (h.via === 'kafka' || HOPS[i - 1].via === 'kafka') ? !kafka : !http; if (lost && h.id !== 'kafka') cur = other; out += '<span aria-hidden="true">→</span>'; }
      out += `<span class="tr-node ${cur !== C.trace ? 'cut' : ''}"><b>${esc(h.t)}</b>${cur.slice(0, 8)}…</span>`;
    });
    return { html: `<div class="tr-chain">${out}</div>`, whole: cur === C.trace };
  }
  const howCtx = {
    id: 'how-ctx', title: 'Как это работает: один trace_id через все сервисы', covers: ['link'], free: true, noReset: true,
    simple: { icon: '🧵', plain: 'Чтобы трасса и логи сложились в одну историю, номер запроса (trace_id) передают дальше при каждом вызове: в заголовке HTTP-запроса и в заголовке сообщения Kafka. Забыли передать — дальше начинается новая история с другим номером, и связь теряется.', analogy: 'Номер посылки. Если на сортировке переклеили этикетку с новым номером, по старому вы её уже не отследите.', tech: 'Context propagation: W3C Trace Context (заголовок traceparent: версия-trace_id-span_id-флаги); для Kafka — заголовки записи. OpenTelemetry SDK делает это автоматически для HTTP-клиентов и Kafka-продюсеров, если подключён. Логгер берёт trace_id из текущего контекста и пишет в каждую запись.' },
    lead: ui.brief({ situation: 'Надя нашла лог бонусов по заказу и хочет открыть его трассу — а там другой trace_id.', todo: ['Выключайте и включайте передачу заголовка по HTTP и в Kafka.', 'Смотрите, где номер запроса меняется.'], look: 'После какого шага история рвётся.' }),
    render(el, ctx) {
      const a = ctx.ans; if (a.http == null) a.http = true; if (a.kafka == null) a.kafka = false;
      const c = chain(a.http, a.kafka);
      el.innerHTML = `<div class="stack"><div class="row"><label class="toggle"><input type="checkbox" data-h ${a.http ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> <span>traceparent в HTTP-вызовах</span></label><label class="toggle"><input type="checkbox" data-k ${a.kafka ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> <span>traceparent в заголовках Kafka</span></label></div>
        ${c.html}<p class="small">${c.whole ? 'Номер один от приложения до бонусов: лог бонусов ведёт в ту же трассу, что и оплата.' : 'Красные узлы получили новый номер: их логи и спаны — отдельная история. Найти, к какому оформлению относится начисление, можно только по времени и угадыванию.'}</p></div>`;
      el.addEventListener('change', e => { if (e.target.matches('[data-h]')) a.http = e.target.checked; if (e.target.matches('[data-k]')) a.kafka = e.target.checked; a.touched = 1; ctx.save(); ctx.rerender(); });
      if ((a.touched && chain(a.http, a.kafka).whole) || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 1. Медленное оформление
  const SQ = [
    { id: 'waste', t: 'Где время уходит впустую', o: ['12 одинаковых запросов цен по одному', 'ожидание банка 1,1 с', 'публикация события в Kafka'], ok: '12 одинаковых запросов цен по одному', because: 'Лесенка из двенадцати коротких одинаковых запросов — классический N+1: по запросу на каждую позицию вместо одного на все. 12 × 80 мс = почти секунда, которую можно свести к 90 мс. Банк ждать придётся — это внешняя система и платёж.', slip: 'это время нельзя сократить без изменений у банка или оно и так мало' },
    { id: 'fix', t: 'Как лечить двенадцать запросов цен', o: ['один запрос на все позиции заказа', 'добавить индекс', 'поставить кэш', 'добавить поды checkout'], ok: 'один запрос на все позиции заказа', because: 'Каждый запрос быстрый — 80 мс, индекс не нужен. Дорого их количество и то, что они идут друг за другом. Один запрос с условием «item_id IN (…)» — 90 мс на всё.', slip: 'каждый запрос и так быстрый — беда в их количестве' },
    { id: 'seq', t: 'Склад и оценка доставки идут друг за другом, хотя не зависят друг от друга', o: ['вызывать параллельно', 'убрать оценку доставки', 'увеличить таймаут'], ok: 'вызывать параллельно', because: 'Если вызовы не зависят друг от друга, их делают одновременно: общее время — самый долгий из них (700 мс), а не сумма (1 200 мс).', slip: 'это не ускорит оформление или сломает функцию' }
  ];
  const AFTER = totalOf(true, true), BEFORE = totalOf(false, false);
  const slow = {
    id: 'slow', title: 'Почему оформление занимает три секунды',
    lead: ui.brief({ situation: `Трасса медленного оформления: ${O.fmt(BEFORE)} мс. Гоша: «Скажи, что чинить и сколько станет после ремонта».`, todo: ['Изучите трассу: нажимайте на спаны.', 'Ответьте на три вопроса и посчитайте, сколько займёт оформление после обоих исправлений.', 'Нажмите «Проверить».'], look: 'Лаборатория «Водопад трассы». Время после ремонта — по спанам: что сократится и на сколько.' }),
    blank: () => ({ v: {}, total: '' }),
    reference: () => ({ v: Object.fromEntries(SQ.map(q => [q.id, q.ok])), total: String(AFTER) }),
    render(el, ctx) {
      const a = ctx.ans; a.v = a.v || {};
      const judged = !!(ctx.result || ctx.readonly), tOk = Math.abs(+String(a.total || '').replace(/\s/g, '') - AFTER) <= 60;
      el.innerHTML = `<div data-tw></div><div class="tr-form" style="margin-top:12px">${SQ.map(q => `<div class="tr-f ${judged && a.v[q.id] ? (a.v[q.id] === q.ok ? 'ok' : 'bad') : ''}"><label for="sl-${q.id}">${esc(q.t)}</label><select id="sl-${q.id}" data-q="${q.id}" ${ctx.readonly ? 'disabled' : ''}><option value="">Выберите…</option>${q.o.map(o => `<option ${a.v[q.id] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`).join('')}
        <div class="tr-f ${judged && a.total ? (tOk ? 'ok' : 'bad') : ''}"><label for="sl-total">Сколько миллисекунд займёт оформление после обоих исправлений</label><input id="sl-total" type="text" inputmode="numeric" data-total value="${esc(a.total || '')}" placeholder="число, мс" ${ctx.readonly ? 'readonly' : ''}></div></div>`;
      O.trace(TR.$('[data-tw]', el), { spans: checkoutSpans(false, false) });
      el.addEventListener('change', e => { const q = e.target.dataset.q; if (!q) return; if (e.target.value) a.v[q] = e.target.value; else delete a.v[q]; e.target.closest('.tr-f').classList.remove('ok', 'bad'); ctx.save(); });
      el.addEventListener('input', e => { if (!e.target.matches('[data-total]')) return; a.total = e.target.value; e.target.closest('.tr-f').classList.remove('ok', 'bad'); ctx.save(); });
    },
    check(ans) {
      const v = ans.v || {}, notes = [], good = SQ.filter(q => v[q.id] === q.ok).length;
      const t = +String(ans.total || '').replace(/\s/g, ''), tOk = Math.abs(t - AFTER) <= 60;
      SQ.forEach(q => { if (!v[q.id]) notes.push({ ok: false, html: `«${esc(q.t)}» — без ответа.` }); else if (v[q.id] !== q.ok) notes.push({ ok: false, html: `«${esc(q.t)}»: ${esc(q.slip)}.` }); });
      if (!tOk) notes.push({ ok: false, html: isNaN(t) || !ans.total ? 'Не посчитано время после ремонта.' : 'Время не сходится. Сколько сэкономит один запрос цен вместо двенадцати? А параллельные вызовы — сумма или самый долгий?' });
      return { ok: good === 3 && tOk, score: (good + (tOk ? 1 : 0)) / 4, notes, summary: `Верно ${good + (tOk ? 1 : 0)} из 4.` };
    },
    answers: ans => SQ.map(q => ({ q: q.t, mine: (ans.v || {})[q.id] || '', right: q.ok, ok: (ans.v || {})[q.id] === q.ok, slip: (ans.v || {})[q.id] && (ans.v || {})[q.id] !== q.ok ? ui.cap(q.slip) + '.' : '', why: q.because }))
      .concat([{ q: 'Время оформления после обоих исправлений', mine: ans.total || '', right: O.fmt(AFTER) + ' мс', ok: Math.abs(+String(ans.total || '').replace(/\s/g, '') - AFTER) <= 60, why: `Было ${O.fmt(BEFORE)} мс. N+1: 12 × 80 = 960 мс → один запрос 90 мс, минус 870. Параллельно: склад 700 и доставка 500 вместо 1 200 — самый долгий, 700, минус 500. ${O.fmt(BEFORE)} − 870 − 500 = ${O.fmt(AFTER)} мс.` }]),
    viz: (el, ans) => {
      // Трасса «до» и «после» на одном экране, с переключателями.
      const st = { n1: true, par: true };
      const draw = () => {
        el.innerHTML = `<div class="stack"><div class="row"><label class="toggle"><input type="checkbox" data-n1 ${st.n1 ? 'checked' : ''}> <span>Один запрос цен</span></label><label class="toggle"><input type="checkbox" data-par ${st.par ? 'checked' : ''}> <span>Параллельно склад и доставка</span></label></div>
          <div class="row between"><span class="small">Было ${O.fmt(BEFORE)} мс · стало</span><span class="tr-total">${O.fmt(totalOf(st.n1, st.par))} мс</span></div><div data-tw></div>
          <p class="small">${ans.total ? `Ваш расчёт: ${esc(ans.total)} мс. ` : ''}Включайте и выключайте исправления — водопад перестраивается, общее время пересчитывается.</p></div>`;
        O.trace(TR.$('[data-tw]', el), { spans: checkoutSpans(st.n1, st.par), value: st.n1 ? 'price' : 'price0' });
      };
      el.addEventListener('change', e => { if (e.target.matches('[data-n1]')) st.n1 = e.target.checked; if (e.target.matches('[data-par]')) st.par = e.target.checked; draw(); });
      draw();
    },
    explain: '<p>По трассе ищут три вещи: <b>лесенку одинаковых коротких спанов</b> (N+1 — запрос в цикле), <b>последовательные независимые вызовы</b> (можно параллельно), <b>долгое ожидание внешней системы</b> (его не сократить, но можно ограничить таймаутом и сделать асинхронным, если клиенту ответ не нужен сразу). Метрики этого не показывают: p95 оформления скажет «медленно», но не скажет, где.</p>',
    report: ans => SQ.map(q => `- ${q.t}: ${(ans.v || {})[q.id] || '—'}`).join('\n') + `\n- После ремонта: ${ans.total || '—'} мс`
  };

  // =====================================================================
  // Практика 2. Из лога — в трассу
  const LINK = [
    { t: 'trace_id в каждой записи лога и traceparent в каждом вызове — в HTTP-заголовке и в заголовке сообщения Kafka', ok: true, why: 'Да: номер запроса один на всём пути.', because: 'Связь держится на одном номере. Сервис получает traceparent, продолжает трассу и передаёт его дальше — по HTTP и в заголовках Kafka. Логгер пишет текущий trace_id в каждую запись. Тогда из любой записи — переход в трассу, из трассы — во все записи всех сервисов. Подключённый OpenTelemetry делает это сам; в постановке это одно требование: «сквозной trace_id, включая сообщения Kafka».' },
    { t: 'Искать по времени: трасса и лог в одну и ту же секунду', why: 'В одну секунду проходят десятки запросов — это угадывание, а не связь.' },
    { t: 'Писать order_id в спаны — по нему всё и свяжется', why: 'order_id полезен как атрибут, но у одного заказа много запросов, а у служебных запросов заказа нет. Связь — по trace_id.' },
    { t: 'Хранить логи и трассы в одной базе', why: 'Хранилище не создаёт связь: без общего номера записи всё равно не сопоставить.' }
  ];
  const link = {
    id: 'link', title: 'Как из лога бонусов попасть в трассу оформления',
    lead: ui.brief({ situation: 'Надя нашла запись бонусов по заказу, а связать её с оформлением не может: у бонусов свой номер запроса.', todo: ['Выберите, что записать в требования.', 'Нажмите «Проверить».'], look: 'Лаборатория «Один trace_id через все сервисы».' }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: [0] }),
    render(el, ctx) { ui.quiz(el, { q: 'Что нужно, чтобы лог и трасса связались?', options: LINK, value: ctx.ans.q, readonly: ctx.readonly, reveal: ctx.result || ctx.readonly ? true : null, seed: 'tr-link', onChange: v => { ctx.ans.q = v; ctx.save(); } }); },
    check(ans) { const r = ui.quizScore({ options: LINK }, ans.q || []); const i = (ans.q || [])[0]; return { ok: r.ok, score: r.score, notes: i != null && !LINK[i].ok ? [{ ok: false, html: esc(LINK[i].why) }] : [], summary: r.ok ? 'Верно.' : 'Не сходится.' }; },
    answers: ans => ui.quizAnswers('Что нужно, чтобы лог и трасса связались?', LINK, ans.q),
    viz: (el) => {
      const st = { http: true, kafka: true };
      const draw = () => { const c = chain(st.http, st.kafka); el.innerHTML = `<div class="stack"><div class="row"><label class="toggle"><input type="checkbox" data-h ${st.http ? 'checked' : ''}> <span>traceparent в HTTP</span></label><label class="toggle"><input type="checkbox" data-k ${st.kafka ? 'checked' : ''}> <span>traceparent в Kafka</span></label></div>${c.html}<p class="small">${c.whole ? 'Номер сквозной — лог бонусов ведёт в трассу оформления. Выключите передачу в Kafka и посмотрите, где рвётся.' : 'История порвалась: красные узлы живут под другим номером.'}</p></div>`; };
      el.addEventListener('change', e => { if (e.target.matches('[data-h]')) st.http = e.target.checked; if (e.target.matches('[data-k]')) st.kafka = e.target.checked; draw(); });
      draw();
    },
    explain: '<p>Сквозной trace_id — требование к <b>всем</b> сервисам и <b>всем</b> способам связи: HTTP, gRPC, сообщения брокера. Самое частое место разрыва — брокер: продюсер не кладёт заголовок, консюмер не продолжает трассу. В постановке пишут: «trace_id передаётся в заголовке traceparent во всех вызовах и сообщениях Kafka и присутствует в каждой записи лога».</p>',
    report: ans => (ans.q || []).length ? LINK[ans.q[0]].t : '—'
  };

  // =====================================================================
  // Практика 3. Какие трассы хранить
  const REQ = 1000, ERRS = 13, SLOW = 40;
  function keepOf(s) {
    if (s === 'all') return { n: REQ, err: ERRS, slow: SLOW };
    if (s === 'head') return { n: 10, err: 0, slow: 0 };
    if (s === 'errors') return { n: ERRS, err: ERRS, slow: 0 };
    return { n: ERRS + SLOW + 50, err: ERRS, slow: SLOW };
  }
  const SAMP = [
    { t: 'Хранить все трассы с ошибками и медленные, а из обычных — 5 %. Решать, когда запрос уже закончился', ok: true, why: 'Да: это хвостовое сэмплирование.', because: 'Трасса нужна для разбора проблем, а проблемы — это ошибки и медленные запросы. Хвостовое сэмплирование (tail-based) смотрит на запрос целиком и оставляет все интересные плюс немного обычных для сравнения. Из 1000 запросов — около 100 трасс, и все 13 ошибок и 40 медленных среди них.' },
    { t: 'Хранить 1 % случайных трасс — так дешевле всего', why: 'Из 1000 запросов останется 10 — и почти наверняка ни одной ошибки. Разбирать будет нечего.' },
    { t: 'Хранить все трассы всегда', why: 'Дорого: десятки спанов на запрос, сотни запросов в секунду. Обычные быстрые запросы почти не нужны.' },
    { t: 'Хранить только трассы с ошибками', why: 'Медленные запросы без ошибки — как пятничное оформление — пропадут. А сравнить «плохой» с «нормальным» будет не с чем.' }
  ];
  const sampling = {
    id: 'sampling', title: 'Какие трассы хранить: все дорого, случайные бесполезны',
    lead: ui.brief({ situation: 'Хранить трассы всех запросов дорого: по 20 спанов на оформление. Разработчик предлагает оставить 1 % случайных.', todo: ['Выберите правило.', 'Нажмите «Проверить».'], look: 'Зачем вообще нужна трасса — для какого запроса.' }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: [0] }),
    render(el, ctx) { ui.quiz(el, { q: 'Какое правило записать в требования?', options: SAMP, value: ctx.ans.q, readonly: ctx.readonly, reveal: ctx.result || ctx.readonly ? true : null, seed: 'tr-samp', onChange: v => { ctx.ans.q = v; ctx.save(); } }); },
    check(ans) { const r = ui.quizScore({ options: SAMP }, ans.q || []); const i = (ans.q || [])[0]; return { ok: r.ok, score: r.score, notes: i != null && !SAMP[i].ok ? [{ ok: false, html: esc(SAMP[i].why) }] : [], summary: r.ok ? 'Верно.' : 'Не сходится.' }; },
    answers: ans => ui.quizAnswers('Какое правило записать в требования?', SAMP, ans.q),
    viz: (el) => {
      const MODES = [{ v: 'head', t: '1 % случайных' }, { v: 'errors', t: 'только ошибки' }, { v: 'tail', t: 'хвостовое' }, { v: 'all', t: 'все' }];
      let m = 'tail';
      const draw = () => {
        const k = keepOf(m), r = TR.rand('tr-dots');
        const dots = Array.from({ length: 200 }, (_, i) => { const kind = i < 3 ? 'err' : i < 11 ? 'slow' : 'ok'; const kept = m === 'all' || (m === 'errors' && kind === 'err') || (m === 'tail' && (kind !== 'ok' || r() < 0.05)) || (m === 'head' && r() < 0.01); return `<span title="${kind === 'err' ? 'ошибка' : kind === 'slow' ? 'медленный' : 'обычный'}" style="display:inline-block;width:10px;height:10px;margin:2px;border-radius:3px;background:${kind === 'err' ? 'var(--bad)' : kind === 'slow' ? 'var(--warn)' : 'var(--info)'};opacity:${kept ? 1 : .15}"></span>`; }).join('');
        el.innerHTML = `<div class="stack">${ui.seg('m', MODES, m)}<div>${dots}</div><div class="gf-grid">${O.panel('Трасс хранится из 1000', `<div class="gf-stat">${k.n}</div>`)}${O.panel('Ошибок попало', `<div class="gf-stat ${k.err === ERRS ? 'ok' : 'bad'}">${k.err} из ${ERRS}</div>`)}${O.panel('Медленных попало', `<div class="gf-stat ${k.slow === SLOW ? 'ok' : 'bad'}">${k.slow} из ${SLOW}</div>`)}</div><p class="small">Квадратики — запросы: красные с ошибкой, жёлтые медленные, синие обычные. Яркие — трасса сохранена.</p></div>`;
      };
      ui.onSeg(el, (n, v) => { m = v; draw(); });
      draw();
    },
    explain: '<p><b>Головное</b> сэмплирование (head-based) решает в начале запроса — дёшево, но вслепую: ошибки теряются. <b>Хвостовое</b> (tail-based) решает в конце, когда известно, была ли ошибка и сколько длилось, — ему нужен сборщик, который держит трассу до конца (OpenTelemetry Collector). Правило для постановки: «все трассы с ошибками и дольше порога SLO, остальные — 5 %, хранить 7 дней».</p>',
    report: ans => (ans.q || []).length ? SAMP[ans.q[0]].t : '—'
  };

  TR.stage({
    id: ID, act: 2, order: 50, slot: 'Пт', title: 'Трассы: где ушло время',
    when: 'пятница · жалобы «оформление тормозит»',
    intro: [
      { who: 'nadya', html: 'Сегодня новое: оформление тормозит по три-четыре секунды. Ошибок нет, просто долго. На вашем новом дашборде всё зелёное.' },
      { who: 'gosha', html: 'Дашборд говорит «сколько», трасса — «где». Откроем одно медленное оформление и посмотрим, кто кого ждал. Заодно свяжем логи и трассы одним номером и решим, какие трассы хранить.' }
    ],
    facts: ['F-latency', 'F-complaints'],
    glossary: [
      { term: 'Спан', simple: 'Один шаг запроса: что делали, когда начали и сколько длилось.', tech: 'Span: операция внутри трассы — имя, сервис, начало, длительность, атрибуты, статус, ссылка на родителя.' },
      { term: 'Водопад', simple: 'Трасса, нарисованная полосками по времени.', tech: 'Waterfall view: спаны в виде полос на общей шкале времени с вложенностью по родителю (Jaeger, Tempo, Zipkin).' },
      { term: 'N+1', simple: 'Запрос в цикле: по одному на каждую позицию вместо одного на все.', tech: 'Антипаттерн доступа к данным: 1 запрос за списком + N запросов за каждым элементом. На трассе — лесенка одинаковых коротких спанов.' },
      { term: 'traceparent', simple: 'Заголовок, в котором номер запроса передают дальше.', tech: 'W3C Trace Context: traceparent = версия-trace_id-parent_span_id-флаги; передаётся в HTTP и в заголовках сообщений брокера.' },
      { term: 'Сэмплирование', simple: 'Хранить не все трассы, а часть — с умом.', tech: 'Head-based (решение в начале, вероятностное) и tail-based (решение после завершения: ошибки, медленные, доля обычных).' },
      { term: 'OpenTelemetry', simple: 'Общий стандарт и библиотеки, чтобы сервисы отдавали метрики, логи и трассы одинаково.', tech: 'OTel: API/SDK для инструментирования, протокол OTLP и Collector для приёма, обработки (в т.ч. tail sampling) и отправки в хранилища.' }
    ],
    outro: 'Теперь видно и «сколько», и «где», и всё связано одним номером. Осталось главное: чтобы обо всём этом узнавать вовремя, не просыпаясь от двухсот алертов. Завтра — алерты и бюджет ошибок.',
    tasks: [howTrace, howCtx, slow, link, sampling]
  });
})();
