/* День 1 · Понедельник. Что болит у дежурных и три сигнала наблюдаемости: метрики, логи, трассы.
   Ключ преподавателя — _dev/KEY.md, раздел «Понедельник». */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc, O = TR.obs;
  const ID = 'signals';

  document.head.insertAdjacentHTML('beforeend', `<style>
  .sg-areas{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
  .sg-area{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface-2);min-width:0}
  .sg-area b{display:block;font-size:13px}.sg-area span{font-size:12px;color:var(--text-muted)}
  .sg-area.on{border-color:color-mix(in srgb,var(--ok) 55%,var(--border));background:var(--ok-soft)}
  .sg-area.on span{color:var(--ok)}
  .sg-qs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px}
  .sg-q{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--surface);min-width:0}
  .sg-q p{margin:0;font-size:14px;min-width:0}.sg-q small{display:block;color:var(--text-muted);font-size:12px;margin-top:2px}
  .sg-q.done{opacity:.55}.sg-q.good{border-color:color-mix(in srgb,var(--ok) 50%,var(--border))}.sg-q.bad{border-color:color-mix(in srgb,var(--bad) 50%,var(--border))}
  .sg-budget{display:flex;gap:4px;flex-wrap:wrap}.sg-budget i{width:14px;height:14px;border-radius:4px;background:var(--surface-3);display:block}
  .sg-budget i.used{background:var(--accent)}
  .sg-log{max-height:420px;overflow:auto;padding-right:4px}
  .sg-three{display:grid;gap:10px}
  .sg-ans{border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--surface-2);font-size:14px}
  .sg-ans b{color:var(--accent)}
  .sg-lines{font:12.5px/1.6 var(--f-mono);background:var(--code-bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;overflow-x:auto;white-space:pre}
  </style>`);

  // =====================================================================
  // Теория 1. Один инцидент — три взгляда
  const VIEWS = [
    { v: 'metrics', t: 'Метрики' }, { v: 'logs', t: 'Логи' }, { v: 'traces', t: 'Трассы' }
  ];
  function threeViews(v) {
    const S = O.series(), C = O.complaint(), L = O.logs();
    if (v === 'metrics') {
      return O.panel('Доля неуспешных оплат, % (окно 5 минут)', O.chart({ series: [{ name: 'неуспешные оплаты, %', color: 'var(--bad)', data: S.errPct }], labels: O.labels(S.n), annotations: [{ i: S.deployIdx, label: 'выкатка payment 2.31' }], yFmt: v => v.toFixed(0) + ' %' }), { wide: true })
        + `<div class="sg-ans"><b>Метрики отвечают «сколько и когда».</b> С 14:05 не проходит каждый седьмой-восьмой платёж — и это видно за секунду, без единого поиска. Но метрика не скажет, <i>почему</i> упал заказ ${C.id}: в ней нет заказов, только числа.</div>`;
    }
    if (v === 'logs') {
      const lines = L.filter(d => d.order_id === C.id).map(d => `${O.hhmmss(d['@timestamp'])}  ${d.level.padEnd(5)}  ${d.service.padEnd(9)}  ${d.message}`).join('\n');
      return `<div class="sg-lines">${esc(lines)}</div><div class="sg-ans"><b>Логи отвечают «что именно случилось с этим заказом».</b> Платёж по заказу ${C.id} не прошёл: банк не ответил за 1000 мс. Но чтобы понять, сколько таких заказов, по логам пришлось бы считать строки — это дорого и медленно.</div>`;
    }
    return '<div data-tw></div>' + `<div class="sg-ans"><b>Трассы отвечают «где по пути ушло время».</b> Из 1,24 секунды запроса тысяча — ожидание банка, и запрос оборвали ровно на тысяче. Трасса показывает путь одного запроса через все сервисы — но про всех клиентов сразу не расскажет.</div>`;
  }
  const TRACE_SPANS = () => {
    const C = O.complaint();
    return [
      { id: 'a', name: 'POST /checkout', service: 'checkout', start: 0, dur: 1240, err: true, attrs: { 'order.id': C.id, 'trace_id': C.trace } },
      { id: 'b', parent: 'a', name: 'promo.apply', service: 'promo', start: 20, dur: 70 },
      { id: 'c', parent: 'a', name: 'POST /payments', service: 'payment', start: 110, dur: 1060, err: true, attrs: { 'order.id': C.id, 'error.code': 'BANK_TIMEOUT', 'service.version': '2.31' } },
      { id: 'd', parent: 'c', name: 'bank.authorize', service: 'bank', start: 150, dur: 1000, err: true, attrs: { 'timeout_ms': 1000, 'peer': 'bank-gateway' } },
      { id: 'e', parent: 'a', name: 'render error', service: 'checkout', start: 1190, dur: 40 }
    ];
  };
  const howSignals = {
    id: 'how-signals', title: 'Как это работает: один инцидент — три взгляда', covers: ['which', 'cost'], free: true, noReset: true,
    simple: { icon: '🔭', plain: 'Наблюдаемость — это способ узнать, что происходит внутри системы, не залезая в неё. Есть три главных сигнала. Метрики — числа во времени: сколько, как быстро, какая доля ошибок. Логи — записи о событиях: что случилось с конкретным заказом. Трассы — путь одного запроса через все сервисы: где он ждал.', analogy: 'Больница. Метрики — график температуры всего отделения: видно, что у многих жар. Логи — история болезни конкретного пациента. Трасса — маршрут пациента по кабинетам с отметкой, сколько он просидел в очереди у каждого.', tech: 'Три столпа наблюдаемости (three pillars of observability): metrics (агрегированные временные ряды, дёшевы, хранятся долго), logs (дискретные события с контекстом, дороги по объёму), traces (распределённые трассы из спанов, связанных trace_id; OpenTelemetry). Связывают их общие поля: trace_id в логе, exemplars в метриках.' },
    lead: ui.brief({ situation: 'Понедельник, 14:30. Надя из поддержки: «Двадцать жалоб за полчаса — не проходит оплата». Это один и тот же инцидент. Посмотрим на него тремя способами.', todo: ['Переключайте «Метрики», «Логи», «Трассы».', 'В трассе нажмите на спаны и посмотрите атрибуты.'], look: 'На какой вопрос отвечает каждый взгляд — и на какой не может ответить.' }),
    render(el, ctx) {
      const a = ctx.ans; a.v = a.v || 'metrics'; a.seen = a.seen || {}; a.seen[a.v] = 1;
      el.innerHTML = `<div class="stack">${ui.seg('v', VIEWS, a.v)}<div class="sg-three" data-out>${threeViews(a.v)}</div><p class="small dim">Посмотрено: ${Object.keys(a.seen).length} из 3.</p></div>`;
      const tw = TR.$('[data-tw]', el);
      if (tw) O.trace(tw, { spans: TRACE_SPANS(), value: 'c', readonly: false });
      O.hover(el);
      ui.onSeg(el, (n, v) => { a.v = v; ctx.save(); ctx.rerender(); });
      if (Object.keys(a.seen).length >= 3 || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 1. Созвон: что болит
  const AREAS = [
    { id: 'bad', t: 'Что считать бедой' }, { id: 'biz', t: 'Что важно бизнесу' }, { id: 'who', t: 'Кто и когда узнаёт' },
    { id: 'now', t: 'Как ищем сейчас' }, { id: 'pii', t: 'Что нельзя в логах' }, { id: 'hist', t: 'Жалобы и сроки' }
  ];
  const Q = [
    { id: 'q-slo', area: 'bad', fact: 'F-slo', t: 'Сколько сбоев оплаты за месяц ещё терпимо — а сколько уже беда?', who: 'Лене' },
    { id: 'q-lat', area: 'bad', fact: 'F-latency', t: 'Сколько клиент готов ждать оплату, прежде чем бросит корзину?', who: 'Лене' },
    { id: 'q-biz', area: 'biz', fact: 'F-biz', t: 'По каким числам вы понимаете, что бизнес теряет деньги прямо сейчас?', who: 'Лене' },
    { id: 'q-night', area: 'who', fact: 'F-night', t: 'Кто дежурит ночью и в каких случаях его можно будить?', who: 'Саше' },
    { id: 'q-noise', area: 'who', fact: 'F-noise', t: 'Сколько алертов приходит сейчас и что с ними происходит?', who: 'Саше' },
    { id: 'q-grep', area: 'now', fact: 'F-grep', t: 'Как сейчас ищете, что случилось с конкретным заказом?', who: 'Саше' },
    { id: 'q-deploy', area: 'now', fact: 'F-deploys', t: 'Как часто выкатываетесь и смотрит ли кто-то графики после выкатки?', who: 'Гоше' },
    { id: 'q-pii', area: 'pii', fact: 'F-pii', t: 'Каких данных клиентов не должно быть в логах?', who: 'Наде' },
    { id: 'q-hist', area: 'hist', fact: 'F-complaints', t: 'Через сколько приходят жалобы и как далеко назад приходится искать заказ?', who: 'Наде' },
    { id: 'q-tool', bad: true, t: 'Что ставим — Prometheus или Zabbix?', who: 'lena', whom: 'Лене', answer: 'Я даже не знаю, что это. Мне важно узнавать о проблеме раньше клиентов.', why: 'Выбор инструмента — решение команды. Заказчик скажет, что считать бедой, а не чем мерить.' },
    { id: 'q-cpu', bad: true, t: 'Какой порог загрузки процессора вас беспокоит?', who: 'lena', whom: 'Лене', answer: 'Процессор? Меня беспокоит, когда люди не могут заплатить.', why: 'Загрузка процессора — внутренность системы. Бизнес чувствует симптомы — ошибки и ожидание, — а не причины.' },
    { id: 'q-color', bad: true, t: 'Какие цвета сделать на дашборде?', who: 'lena', whom: 'Лене', answer: 'Пусть красное будет, когда плохо. А так — как вам удобно.', why: 'Оформление дашборда не требование. Важно, на какие вопросы он отвечает.' },
    { id: 'q-lang', bad: true, t: 'В каком формате сейчас пишутся логи — log4j или logback?', who: 'nadya', whom: 'Наде', answer: 'Это вопрос не ко мне. Я вижу только, что ничего не могу найти.', why: 'Формат и библиотека — вопрос к команде. У поддержки спрашивают, что и как она ищет.' }
  ];
  const GOOD = Q.filter(q => !q.bad);
  const BUDGET = 10;
  const qById = id => Q.find(q => q.id === id);
  function evalCall(ans) {
    const asked = (ans && ans.asked || []).filter(qById);
    const good = asked.filter(id => !qById(id).bad), bad = asked.filter(id => qById(id).bad);
    const areas = new Set(good.map(id => qById(id).area));
    const score = Math.max(0, Math.min(1, (good.length - 0.5 * bad.length) / GOOD.length));
    return { asked, good, bad, areas, score, hasSlo: good.includes('q-slo'), hasNight: good.includes('q-night'), tool: bad.includes('q-tool') };
  }
  const AREA_WHY = {
    bad: 'Без порога «что считать бедой» нельзя ни посчитать бюджет ошибок, ни решить, когда будить человека. Ответ Лены — не больше 0,5 % сбоев за 30 дней и две секунды на оплату — в субботу станет SLO, а алерты будут срабатывать по нему.',
    biz: 'Бизнесу нужны свои метрики — заказы в минуту и брошенные на оплате корзины. По ним видно, что деньги теряются прямо сейчас, даже если все сервера «зелёные». В четверг эти числа лягут на дашборд первым рядом.',
    who: 'Кого и когда будить — главный вопрос к алертам. Ночью дежурит один человек, и звонок должен значить «клиентам плохо сейчас». А 200 алертов в сутки — причина, почему понедельник проспали: настоящий алерт утонул в шуме.',
    now: 'Как ищут сейчас — это точка отсчёта. Grep по шести машинам — значит, нужен общий поиск по логам; пять выкаток в день без взгляда на графики — значит, выкатки должны быть отмечены на графике.',
    pii: 'Ограничения на персональные данные — требование к содержимому логов. Телефоны и адреса либо маскируют, либо не пишут вовсе, а данные карт — никогда. Это строчка постановки, а не пожелание.',
    hist: 'Через сколько приходят жалобы и как далеко ищут — это срок хранения логов и поле, по которому ищут. Две недели и номер заказа: значит, логи храним не меньше 14 дней, а order_id есть в каждой записи.'
  };
  const call = {
    id: 'call', title: 'Созвон: что болит у дежурных',
    lead: ui.brief({
      situation: 'Понедельник, 16:00. Инцидент закрыли откатом, а Гоша собрал созвон: Лена (продакт), Саша (дежурный), Надя (поддержка). У всех полчаса — это примерно десять вопросов.',
      todo: ['Выбирайте вопросы и нажимайте «Спросить». Ответ записывается в блокнот 📓 и пригодится в следующие дни.', `Вопросов не больше ${BUDGET}. Заданный вопрос не забрать — созвон переиграть можно только целиком, кнопкой «Сбросить ответ».`, 'Нажмите «Проверить».'],
      look: 'Сверху — шесть тем. Тема закрывается полезным вопросом. Лишний вопрос стоит половину полезного.'
    }),
    blank: () => ({ asked: [] }),
    reference: () => ({ asked: GOOD.map(q => q.id) }),
    render(el, ctx) {
      const a = ctx.ans; a.asked = a.asked || [];
      const ev = evalCall(a), left = BUDGET - a.asked.length, judged = !!(ctx.result || ctx.readonly);
      const order = TR.shuffle(Q.map(q => q.id), 'sg-call');
      el.innerHTML = `<div class="stack">
        <div class="sg-areas">${AREAS.map(ar => { const on = ev.areas.has(ar.id); return `<div class="sg-area ${on ? 'on' : ''}"><b>${esc(ar.t)}</b><span>${on ? 'закрыто' : 'не спрошено'}</span></div>`; }).join('')}</div>
        <div class="row between"><span class="small">Вопросов осталось: <b class="tnum">${left}</b> из ${BUDGET}</span><div class="sg-budget" aria-hidden="true">${Array.from({ length: BUDGET }, (_, i) => `<i class="${i < a.asked.length ? 'used' : ''}"></i>`).join('')}</div></div>
        <div class="sg-qs">${order.map(id => {
          const q = qById(id), done = a.asked.includes(id);
          const cls = done ? 'done' + (judged ? (q.bad ? ' bad' : ' good') : '') : '';
          return `<div class="sg-q ${cls}"><p>${esc(q.t)}<small>${esc(q.whom || q.who)}</small></p>${ctx.readonly ? '' : `<button type="button" class="btn xs ${done ? 'ghost' : ''}" data-ask="${id}" ${done || left <= 0 ? 'disabled' : ''}>${done ? 'Спрошено' : 'Спросить'}</button>`}</div>`;
        }).join('')}</div>
        ${a.asked.length ? `<div class="eyebrow">Ход созвона</div><div class="sg-log stack tight">${a.asked.map(id => {
          const q = qById(id), f = q.fact ? TR.FACTS[q.fact] : null;
          return ui.say('me', esc(q.t)) + ui.say(f ? f.who : q.who, esc(f ? f.answer : q.answer));
        }).join('')}</div>` : '<p class="small dim">Созвон ещё не начался. Начните с вопроса, без которого непонятно, что вообще считать проблемой.</p>'}
        ${left <= 0 && !ctx.readonly ? ui.note('warn', 'Время созвона вышло', 'Все разошлись по задачам. Проверьте, что получилось.') : ''}
      </div>`;
      TR.on(el, 'click', '[data-ask]', (e, b) => {
        if (ctx.readonly) return;
        const id = b.dataset.ask, q = qById(id);
        if (!q || a.asked.includes(id) || a.asked.length >= BUDGET) return;
        a.asked.push(id); ctx.save();
        if (q.fact) ctx.facts.unlock(q.fact, 'ask');
        ctx.rerender();
      });
    },
    check(ans) {
      const ev = evalCall(ans), notes = [];
      const HINT = {
        bad: 'Непонятно, что считать бедой. Как тогда решить, когда будить дежурного и что значит «оплата работает»?',
        biz: 'Не спросили, по каким числам бизнес видит потери. Дашборд снова будет про процессор, а не про деньги.',
        who: 'Неясно, кого и когда будить. Как тогда настроить алерты, чтобы их не выключили, как сейчас?',
        now: 'Не выяснили, как ищут сейчас. Не от чего отталкиваться: что именно мешает найти причину?',
        pii: 'Не спросили, что нельзя писать в логи. А юристы уже делали замечание.',
        hist: 'Не спросили про жалобы и сроки. Сколько хранить логи и по какому полю искать?'
      };
      AREAS.forEach(ar => { if (!ev.areas.has(ar.id)) notes.push({ ok: ['bad', 'who'].includes(ar.id) ? false : 'warn', html: `«${esc(ar.t)}»: ${HINT[ar.id]}` }); });
      ev.bad.forEach(id => { const q = qById(id); notes.push({ ok: false, html: `Лишний вопрос «${esc(q.t)}» — ${esc(q.why)}` }); });
      if (!ev.asked.length) notes.push({ ok: false, html: 'Вы не задали ни одного вопроса.' });
      if (ev.areas.size >= 5 && !ev.bad.length) notes.push({ ok: true, html: `Закрыто тем: ${ev.areas.size} из 6, лишних вопросов нет.` });
      const ok = ev.areas.size >= 5 && ev.hasSlo && ev.hasNight && !ev.tool && ev.score >= 0.5;
      return {
        ok, score: ok ? Math.max(ev.score, 0.8) : Math.min(ev.score, 0.75), notes,
        summary: `Полезных вопросов: ${ev.good.length} из ${GOOD.length}. Лишних: ${ev.bad.length}. Тем закрыто: ${ev.areas.size} из 6.`,
        mentor: ev.tool ? '«Prometheus или Zabbix» — вопрос к нам, а не к Лене. Она скажет, что считать бедой, а чем мерить, выберем мы.' : (!ev.hasSlo ? 'Без ответа «сколько сбоев терпимо» мы в субботу не посчитаем бюджет ошибок — и снова будем будить Сашу по любому чиху.' : null)
      };
    },
    flags(ans) {
      const ev = evalCall(ans), f = [];
      if (ev.tool) f.push('Спросил заказчика «Prometheus или Zabbix?» — переложил выбор инструмента на бизнес');
      if (!ev.hasSlo) f.push('Не выяснил, что считать бедой (порог сбоев)');
      if (!ev.hasNight) f.push('Не выяснил, кого и когда можно будить');
      return f;
    },
    answers: ans => {
      const ev = evalCall(ans);
      const items = AREAS.map(ar => {
        const mine = ev.good.filter(id => qById(id).area === ar.id).map(id => qById(id).t);
        return { q: 'Тема «' + ar.t + '»', mine: mine.join(' / '), right: GOOD.filter(q => q.area === ar.id).map(q => q.t).join(' / '), ok: ev.areas.has(ar.id), why: AREA_WHY[ar.id] };
      });
      return items.concat(ev.bad.map(id => ({ q: 'Лишний вопрос: «' + qById(id).t + '»', mine: 'спросили', right: 'не задавать на этом созвоне', ok: false, why: esc(qById(id).why) })));
    },
    viz: (el, ans) => {
      // Карта созвона: каждая тема — во что превратится ответ. Нажмите тему — покажу, что известно и где пригодится.
      const ev = evalCall(ans);
      const DAY = { bad: 'суббота: SLO и алерты', biz: 'четверг: первый ряд дашборда', who: 'суббота: кого будить', now: 'вторник: общий поиск; четверг: отметки выкаток', pii: 'вторник и воскресенье: поля лога', hist: 'вторник: поиск по order_id; воскресенье: срок хранения' };
      const draw = pick => {
        el.innerHTML = `<div class="sg-areas">${AREAS.map(ar => `<button type="button" class="sg-area ${ev.areas.has(ar.id) ? 'on' : ''}" data-ar="${ar.id}" style="text-align:left;cursor:pointer;font:inherit;color:inherit" aria-pressed="${pick === ar.id}"><b>${esc(ar.t)}</b><span>${ev.areas.has(ar.id) ? 'выяснено' : 'не выяснено'} · ${esc(DAY[ar.id])}</span></button>`).join('')}</div>`
          + (pick ? (() => { const facts = GOOD.filter(q => q.area === pick).map(q => TR.FACTS[q.fact]); return `<div class="sg-ans">${facts.map(f => TR.facts.has(f.id) || ans.asked && ans.asked.some(id => (qById(id) || {}).fact === f.id) ? `<div>✓ <b>${esc(f.short)}</b></div>` : `<div class="dim">✕ не выяснено: ${esc(f.topic)}</div>`).join('')}<p class="small" style="margin:6px 0 0">${esc(AREA_WHY[pick])}</p></div>`; })() : '<p class="small dim">Нажмите на тему — покажу, что выяснено и где это пригодится на неделе.</p>');
      };
      el.addEventListener('click', e => { const b = e.target.closest('[data-ar]'); if (b) draw(b.dataset.ar); });
      draw(ev.areas.size < AREAS.length ? (AREAS.find(ar => !ev.areas.has(ar.id)) || AREAS[0]).id : 'bad');
    },
    explain: `<p>Сильный созвон не про инструменты, а про то, <b>что считать бедой и кто о ней узнаёт</b>. Каждый ответ потом становится решением:</p>
      ${ui.table(['Ответ', 'Во что превращается'], [
        ['Не больше 0,5 % сбоев оплаты за 30 дней', 'SLO и бюджет ошибок (суббота)'],
        ['Оплата ≤ 2 с, после 5 с бросают', 'Перцентиль p95 на дашборде и в SLO (среда, четверг)'],
        ['Заказы в минуту и брошенные корзины', 'Бизнес-метрики первым рядом дашборда (четверг)'],
        ['Ночью один дежурный, будить — только если страдают клиенты', 'Алерты по симптомам, а не по процессору (суббота)'],
        ['Логи — grep по шести машинам', 'Общий поиск по логам, структурированные записи (вторник)'],
        ['В логах нельзя телефон, адрес, карту', 'Маскирование и запрет полей (вторник, воскресенье)'],
        ['Ищут заказ до 14 дней назад', 'Срок хранения логов и order_id в каждой записи']
      ])}
      <p>Красный флаг дня — «Prometheus или Zabbix?» заказчику. Инструмент выбирает команда; заказчик говорит, что для него «плохо».</p>`,
    report: ans => { const ev = evalCall(ans); return ev.asked.map(id => `- ${qById(id).bad ? '✗' : '✓'} ${qById(id).t}`).join('\n') + `\n\nТем закрыто: ${ev.areas.size} из 6 · полезных ${ev.good.length}/${GOOD.length} · лишних ${ev.bad.length}`; }
  };

  // =====================================================================
  // Практика 2. Какой сигнал отвечает на вопрос
  const WHICH = [
    { id: 'w1', t: 'Сколько платежей в минуту падает прямо сейчас?', ok: 'metrics', because: 'Это число во времени — ровно то, что хранит метрика. График покажет за секунду, без поиска по строкам.' },
    { id: 'w2', t: 'Почему не прошёл платёж по заказу 1261?', ok: 'logs', because: 'Нужна история одного заказа: что ответил банк, какая ошибка. Это запись о событии с контекстом — лог, найденный по order_id.' },
    { id: 'w3', t: 'На каком из пяти вызовов тормозит оформление заказа?', ok: 'traces', because: 'Трасса показывает путь одного запроса через все сервисы и сколько он ждал в каждом — сразу видно, где ушло время.' },
    { id: 'w4', t: 'Выросла ли доля ошибок после выкатки в 14:05?', ok: 'metrics', because: 'Сравнение «до и после» — это график доли ошибок с отметкой выкатки. Метрика хранится долго и считается дёшево.' },
    { id: 'w5', t: 'Что именно ответил банк на запрос по заказу 1261?', ok: 'logs', because: 'Ответ банка — подробность одного события. Её пишут в лог вместе с order_id и trace_id.' },
    { id: 'w6', t: 'Сколько времени запрос провёл в промокодах, оплате и складе?', ok: 'traces', because: 'Длительность каждого шага одного запроса — это спаны трассы, выстроенные по времени.' },
    { id: 'w7', t: 'Кто и когда поменял лимит промокода в админке?', ok: 'audit', because: 'Действия людей с правами — журнал аудита: кто, когда, что изменил, было и стало. Его хранят дольше и защищают от правки, в отличие от обычных логов.' },
    { id: 'w8', t: 'Сколько заказов не оплатилось за прошлый квартал — для отчёта директору?', ok: 'dwh', because: 'Отчёт за квартал — задача аналитического хранилища: туда складывают события и считают отчёты. Мониторинг хранит детали недолго и отвечает на «что сейчас».' }
  ];
  const SIG = [
    { v: 'metrics', t: 'Метрики' }, { v: 'logs', t: 'Логи' }, { v: 'traces', t: 'Трассы' },
    { v: 'audit', t: 'Журнал аудита' }, { v: 'dwh', t: 'Аналитическое хранилище' }
  ];
  const SIG_WHY = {
    metrics: 'метрика — число без подробностей: в ней нет конкретных заказов и ответов банка',
    logs: 'логи хороши для одного события; посчитать «сколько всего» или «где ушло время» по ним долго и дорого',
    traces: 'трасса — путь одного запроса; она не скажет, сколько их всего, и не хранит длинную историю',
    audit: 'журнал аудита — про действия людей с правами, а не про работу сервисов',
    dwh: 'хранилище — для отчётов за периоды, а не для того, что происходит прямо сейчас'
  };
  const which = {
    id: 'which', title: 'Какой сигнал отвечает на вопрос',
    lead: ui.brief({
      situation: 'После созвона Гоша выписал вопросы, которые звучат у дежурных каждую неделю. Для каждого нужен свой инструмент.',
      todo: ['Для каждого вопроса выберите, где искать ответ.', 'Нажмите «Проверить». Засчитывается от семи верных из восьми.'],
      look: '«Сколько и когда» — одно, «что с этим заказом» — другое, «где ушло время» — третье. И не всё — мониторинг.'
    }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(WHICH.map(r => [r.id, r.ok])) }),
    render(el, ctx) {
      const a = ctx.ans; a.m = a.m || {};
      let rv = null;
      if (ctx.result || ctx.readonly) { rv = {}; WHICH.forEach(r => { const g = a.m[r.id]; if (g) rv[r.id] = { s: g === r.ok ? 'ok' : 'bad', why: '' }; }); }
      ui.match(el, { rows: WHICH.map(r => ({ id: r.id, t: esc(r.t) })), choices: SIG, value: a.m, reveal: rv, readonly: ctx.readonly, placeholder: 'Где искать…', onChange: v => { a.m = v; ctx.save(); } });
    },
    check(ans) {
      const m = ans.m || {}, good = WHICH.filter(r => m[r.id] === r.ok).length, empty = WHICH.filter(r => !m[r.id]).length, notes = [];
      if (empty) notes.push({ ok: false, html: `Без ответа: ${empty} ${TR.plural(empty, 'вопрос', 'вопроса', 'вопросов')}.` });
      WHICH.forEach(r => { const g = m[r.id]; if (g && g !== r.ok) notes.push({ ok: false, html: `«${esc(r.t)}» — ${esc(SIG_WHY[g])}.` }); });
      return { ok: good >= 7, score: good / WHICH.length, notes, summary: `Верно ${good} из ${WHICH.length}.` };
    },
    answers: ans => ui.matchAnswers(WHICH, SIG, ans.m, (r, g) => SIG_WHY[g] ? ui.cap(SIG_WHY[g]) + '.' : ''),
    viz: (el) => {
      // Путь дежурного: метрика → логи → трасса на понедельничном инциденте.
      const STEPS = [{ v: 'metrics', t: '1. Метрика: сколько и когда' }, { v: 'logs', t: '2. Логи: что с заказом' }, { v: 'traces', t: '3. Трасса: где ушло время' }];
      let v = 'metrics';
      const draw = () => {
        el.innerHTML = `<div class="stack">${ui.seg('st', STEPS, v)}<div class="sg-three">${threeViews(v)}</div></div>`;
        const tw = TR.$('[data-tw]', el); if (tw) O.trace(tw, { spans: TRACE_SPANS(), value: 'd' });
        O.hover(el);
      };
      ui.onSeg(el, (n, x) => { v = x; draw(); });
      draw();
    },
    explain: `<p>Три сигнала дополняют друг друга, а не заменяют. Типичный путь дежурного: <b>метрика</b> сказала, что доля ошибок выросла с 14:05 → <b>логи</b> с <code>level:ERROR</code> за это время показали <code>BANK_TIMEOUT</code> → по <code>trace_id</code> из лога открыли <b>трассу</b> и увидели, что запрос оборвали ровно на 1000 мс.</p>
      <p>Два соседа, которых путают с мониторингом: <b>журнал аудита</b> (кто из людей что изменил — хранят долго и защищают от правки) и <b>аналитическое хранилище</b> (отчёты за периоды). Мониторинг отвечает на «что происходит сейчас и почему».</p>`,
    report: ans => WHICH.map(r => `- ${r.t} → ${((SIG.find(x => x.v === (ans.m || {})[r.id]) || {}).t) || '—'} ${(ans.m || {})[r.id] === r.ok ? '✓' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 3. «Давайте всё писать в логи»
  const COST = [
    { t: 'Метрика — несколько чисел раз в 15 секунд, лог — строка на каждый запрос. Считать «долю ошибок за месяц» по миллионам строк дорого и медленно, а хранить их месяцами — дорого вдвойне', ok: true, why: 'Да: для «сколько и как часто» нужна метрика, для «что случилось с этим» — лог.', because: 'При 15 запросах в секунду это больше миллиона строк в сутки на один сервис. Метрика «платежей всего / неуспешных» — два счётчика, которые хранятся годами почти бесплатно и строят график за миллисекунды. Логи оставляют для подробностей и хранят недолго; DEBUG в проде выключают.' },
    { t: 'Логи нельзя хранить дольше суток', why: 'Можно сколько угодно — вопрос в цене. «Минутке» нужно 14 дней.' },
    { t: 'Из логов нельзя построить график', why: 'Можно, и так иногда делают. Но это медленно и дорого на больших объёмах — поэтому важные числа считают сразу метрикой.' },
    { t: 'Ничего страшного: чем больше логов, тем лучше наблюдаемость', why: 'Нет: шум в логах прячет важное и стоит денег. DEBUG на проде — частая причина переполненных дисков.' }
  ];
  const cost = {
    id: 'cost', title: 'Разработчик: «Давайте просто писать всё в логи на DEBUG»',
    lead: ui.brief({ situation: 'Разработчик оплаты предлагает: «Включим DEBUG, будем писать всё подряд, а графики построим по логам. Зачем ещё какие-то метрики?»', todo: ['Выберите, что ответить.', 'Нажмите «Проверить».'], look: 'Лаборатория «Один инцидент — три взгляда»: что дёшево отвечает на «сколько», а что — на «почему».' }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: [0] }),
    render(el, ctx) { ui.quiz(el, { q: 'Что ответить разработчику?', options: COST, value: ctx.ans.q, readonly: ctx.readonly, reveal: ctx.result || ctx.readonly ? true : null, seed: 'sg-cost', onChange: v => { ctx.ans.q = v; ctx.save(); } }); },
    check(ans) { const r = ui.quizScore({ options: COST }, ans.q || []); const i = (ans.q || [])[0]; return { ok: r.ok, score: r.score, notes: i != null && !COST[i].ok ? [{ ok: false, html: esc(COST[i].why) }] : [], summary: r.ok ? 'Верно.' : 'Не сходится.' }; },
    answers: ans => ui.quizAnswers('Что ответить разработчику?', COST, ans.q),
    viz: (el) => {
      // Калькулятор: сколько стоит «всё в логи» против метрики.
      const st = { rps: 15, days: 30 };
      const draw = () => {
        const lines = st.rps * 5 * 86400 * st.days, logGb = lines * 600 / 1e9;
        const metricMb = 2 * 4 * 1440 * st.days * 2 / 1e6;
        el.innerHTML = `<div class="stack">
          <label class="field"><span>Платежей в секунду: <b class="tnum">${st.rps}</b></span><input type="range" min="5" max="300" step="5" value="${st.rps}" data-k="rps"></label>
          <label class="field"><span>Хранить дней: <b class="tnum">${st.days}</b></span><input type="range" min="1" max="400" step="1" value="${st.days}" data-k="days"></label>
          <div class="gf-grid">${O.panel('Логи «всё подряд»: 5 строк по ~600 байт на платёж', `<div class="gf-stat ${logGb > 100 ? 'bad' : 'warn'}">${O.fmt(Math.round(logGb))} ГБ</div><p class="small">${O.fmt(Math.round(lines / 1e6))} млн строк. Чтобы посчитать долю ошибок за месяц, их нужно прочитать.</p>`)}${O.panel('Метрика: два счётчика раз в 15 секунд', `<div class="gf-stat ok">${metricMb < 1 ? '< 1' : O.fmt(Math.round(metricMb))} МБ</div><p class="small">Объём не зависит от числа платежей: счётчик просто растёт. График за месяц строится за миллисекунды.</p>`)}</div></div>`;
      };
      el.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; st[k] = +e.target.value; draw(); });
      draw();
    },
    explain: '<p>Правило цены: <b>метрики</b> дёшевы и долгие — для «сколько, как быстро, какая доля»; <b>логи</b> дороги и короткие — для «что случилось с этим»; <b>трассы</b> дороги — их обычно сэмплируют (об этом в пятницу). Аналитик в постановке пишет, какие события логировать и с какими полями, а какие числа сделать метриками.</p>',
    report: ans => (ans.q || []).length ? COST[ans.q[0]].t : '—'
  };

  TR.stage({
    id: ID, act: 1, order: 10, slot: 'Пн', title: 'Что болит и три сигнала',
    when: 'понедельник · после инцидента с оплатой',
    intro: [
      { who: 'nadya', html: 'С двух часов дня у нас двадцать жалоб: оплата не проходит, приложение пишет «попробуйте ещё раз». Мы узнали из соцсетей раньше, чем от вас.' },
      { who: 'gosha', html: 'Откатили — заработало. Но узнали мы последними. Эту неделю дежурим вместе и делаем так, чтобы узнавать раньше клиентов. Начнём с того, что вообще можно увидеть и у кого что болит.' }
    ],
    glossary: [
      { term: 'Наблюдаемость', simple: 'Способ понять, что происходит внутри системы, по тому, что она о себе сообщает.', tech: 'Observability: способность по внешним сигналам (метрики, логи, трассы) ответить на вопросы о внутреннем состоянии системы, включая заранее не предусмотренные.' },
      { term: 'Мониторинг', simple: 'Постоянное наблюдение за заранее выбранными показателями и тревога, когда они плохие.', tech: 'Сбор и визуализация заранее определённых метрик, дашборды и алерты. Часть наблюдаемости.' },
      { term: 'Метрика', simple: 'Число, которое меряют снова и снова: сколько, как быстро, какая доля.', tech: 'Временной ряд числовых значений с метками (labels). Типы: counter, gauge, histogram, summary. Хранится в TSDB (Prometheus, VictoriaMetrics).' },
      { term: 'Лог (журнал)', simple: 'Запись о событии: когда, где, что случилось и с чем.', tech: 'Дискретная запись события; в структурированном виде — JSON с полями (timestamp, level, service, trace_id…). Собирается в общий поиск (Elasticsearch/OpenSearch + Kibana, Loki + Grafana).' },
      { term: 'Трасса', simple: 'Путь одного запроса через все сервисы с временем каждого шага.', tech: 'Distributed trace: дерево спанов с общим trace_id; спан — операция с началом, длительностью и атрибутами. Стандарт — OpenTelemetry; хранилища — Jaeger, Tempo.' },
      { term: 'Журнал аудита', simple: 'Кто из людей что изменил и когда.', tech: 'Audit log: неизменяемые записи о действиях пользователей и администраторов (кто, когда, объект, было/стало). Хранится дольше и защищается от правки.' }
    ],
    outro: 'Понятно, что болит и где что искать. Завтра — логи: соберём их в одно место и найдём, что случилось с заказом из жалобы.',
    tasks: [howSignals, call, which, cost]
  });
})();
