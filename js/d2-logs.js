/* День 2 · Вторник. Логи: структура, поиск в стиле Kibana, уровни, персональные данные, поля записи.
   Ключ преподавателя — _dev/KEY.md, раздел «Вторник». */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc, O = TR.obs;
  const ID = 'logs';

  document.head.insertAdjacentHTML('beforeend', `<style>
  .lg-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
  .lg-box{border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--surface-2);min-width:0}
  .lg-box pre{margin:6px 0 0;font:12px/1.55 var(--f-mono);white-space:pre-wrap;overflow-wrap:anywhere}
  .lg-res{font:12.5px/1.6 var(--f-mono)}
  .lg-res .hit{color:var(--ok)}.lg-res .miss{color:var(--bad)}
  .lg-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
  .lg-f{display:grid;gap:4px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface)}
  .lg-f.ok{border-color:var(--ok);background:var(--ok-soft)}.lg-f.bad{border-color:var(--bad);background:var(--bad-soft)}
  .lg-f label{font-size:13px;color:var(--text-2)}
  .lg-f input{font:13px var(--f-mono)}
  .lg-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:6px}
  .lg-cb{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--border);border-radius:9px;padding:8px 10px;background:var(--surface);cursor:pointer;min-width:0}
  .lg-cb input{margin-top:3px}.lg-cb code{font:600 12.5px var(--f-mono);color:var(--text)}.lg-cb small{display:block;color:var(--text-muted);font-size:12px}
  .lg-cb.ok{border-color:var(--ok);background:var(--ok-soft)}.lg-cb.bad{border-color:var(--bad);background:var(--bad-soft)}.lg-cb.miss{border-style:dashed;border-color:var(--warn)}
  </style>`);

  // =====================================================================
  // Теория 1. Строка текста против записи с полями
  const howStruct = {
    id: 'how-struct', title: 'Как это работает: строка текста против записи с полями', covers: ['find', 'fields'], free: true, noReset: true,
    simple: { icon: '🗂️', plain: 'Лог можно писать фразой — «платёж не прошёл» — или записью с полями: уровень, сервис, номер заказа, код ошибки. Фразу ищут по словам и регулярками, и она ломается от любой правки текста. Запись с полями ищут точно: «покажи все ошибки оплаты по этому заказу».', analogy: 'Записка в журнале дежурного «Петров опять опоздал» и строка в табеле «сотрудник: Петров, дата: 3 ноября, опоздание: 12 минут». По табелю за минуту посчитаешь опоздания за месяц, по запискам — никогда.', tech: 'Structured logging: запись — JSON с постоянным набором полей (timestamp ISO-8601 с поясом, level, service, version, event, trace_id, бизнес-ключи). Сборщик (Fluent Bit, Vector, Filebeat) отправляет записи в общее хранилище — Elasticsearch/OpenSearch или Loki, — где поиск идёт по полям, а не по тексту.' },
    lead: ui.brief({ situation: 'Саша показывает, как ищет сейчас: заходит на машину и пишет grep. Гоша показывает то же событие записью с полями.', todo: ['Переключите «Строка текста» и «Запись с полями».', 'Нажмите «Найти ошибки оплаты по заказу» в обоих режимах.'], look: 'Сколько лишнего находит поиск по словам и что он пропускает.' }),
    render(el, ctx) {
      const a = ctx.ans; a.m = a.m || 'text'; a.seen = a.seen || {};
      const C = O.complaint(), L = O.logs();
      const d = L.find(x => x.order_id === C.id && x.level === 'ERROR');
      const textLine = `${O.hhmmss(d['@timestamp'])} [${d.host}] ERROR PaymentService - Банк не ответил за 1000 мс — платёж по заказу ${C.id} не прошёл`;
      const json = JSON.stringify({ '@timestamp': '2026-11-02T' + O.hhmmss(d['@timestamp']) + '+03:00', level: d.level, service: d.service, version: d.version, event: d.event, order_id: d.order_id, trace_id: d.trace_id, 'error.code': d['error.code'], duration_ms: d.duration_ms }, null, 2);
      const idText = String(C.id);
      const naive = L.filter(x => String(x.message).includes(idText));
      const exact = L.filter(x => x.order_id === C.id && x.level === 'ERROR' && x.service === 'payment');
      const res = a.run && a.run[a.m];
      el.innerHTML = `<div class="stack">${ui.seg('m', [{ v: 'text', t: 'Строка текста' }, { v: 'json', t: 'Запись с полями' }], a.m)}
        <div class="lg-box"><div class="eyebrow">${a.m === 'text' ? 'Так пишет сервис сейчас' : 'Так — после перехода на записи с полями'}</div><pre>${esc(a.m === 'text' ? textLine : json)}</pre></div>
        <div class="row"><button type="button" class="btn sm primary" data-run ${ctx.readonly ? 'disabled' : ''}>Найти ошибки оплаты по заказу ${C.id}</button></div>
        ${res ? (a.m === 'text'
          ? `<div class="lg-box lg-res"><div class="eyebrow">grep "${idText}" *.log на шести машинах</div>Найдено строк: <b>${naive.length}</b> — это все записи заказа, ошибка среди них одна. А если разработчик перепишет фразу на «Bank timeout», такой поиск по слову «не ответил» перестанет находить вообще ничего.<br><span class="miss">Чтобы найти только ошибки оплаты, нужна регулярка по тексту: <code>grep -E "ERROR PaymentService.*${idText}"</code> — и она сломается от первой правки сообщения.</span></div>`
          : `<div class="lg-box lg-res"><div class="eyebrow">service:payment level:ERROR order_id:${idText}</div>Найдено записей: <b>${exact.length}</b> — ровно то, что нужно. <span class="hit">Поля не зависят от текста сообщения: его можно переписать, а поиск, графики и алерты по <code>error.code</code> продолжат работать.</span></div>`) : ''}
        <p class="small dim">Посмотрено: ${Object.keys(a.seen).length} из 2.</p></div>`;
      ui.onSeg(el, (n, v) => { a.m = v; ctx.save(); ctx.rerender(); });
      TR.on(el, 'click', '[data-run]', () => { a.run = Object.assign(a.run || {}, { [a.m]: 1 }); a.seen[a.m] = 1; ctx.save(); ctx.rerender(); });
      if (Object.keys(a.seen).length >= 2 || ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Теория 2. Поиск по логам в стиле Kibana
  const howKibana = {
    id: 'how-kibana', title: 'Как это работает: поиск по логам — строка запроса, поля, время', covers: ['find', 'pii'], free: true, noReset: true,
    simple: { icon: '🔎', plain: 'Все логи всех машин собраны в одно место. Сверху — строка запроса и время, слева — поля со самыми частыми значениями, в центре — гистограмма «сколько записей в минуту» и сами записи. Нажали на значение слева — оно добавилось в запрос. Раскрыли запись — видно все её поля.', analogy: 'Библиотечный каталог вместо обхода полок: вы не листаете книги, а задаёте автора, год и тему, и каталог сразу говорит, сколько нашлось и где лежит.', tech: 'Kibana Discover над Elasticsearch/OpenSearch (или Grafana Explore над Loki): запрос на KQL/Lucene (field:value, AND/NOT, диапазоны), выбор интервала времени, гистограмма по @timestamp, фильтры из списка полей, раскрытие документа. Тот же trace_id связывает запись с трассой.' },
    lead: ui.brief({ situation: 'Гоша подключил общий поиск: теперь логи всех шести машин в одном месте. Понедельник, 13:50–14:40.', todo: ['Введите <code>level:ERROR</code> — посмотрите, когда начались ошибки на гистограмме.', 'Нажмите слева на значение поля <code>error.code</code> — оно добавится в запрос.', 'Раскройте любую запись и нажмите «Все записи этого запроса».'], look: 'Жёлтая пунктирная линия на гистограмме — 14:05.' }),
    render(el, ctx) {
      const a = ctx.ans; a.k = a.k || { q: '', range: 'all' };
      const box = document.createElement('div'); el.appendChild(box);
      O.kibana(box, { docs: O.logs(), value: a.k, readonly: ctx.readonly, onChange: (v, hits) => {
        a.k = v; ctx.save();
        if (/\w:\S/.test(v.q) && hits.length) ctx.ready();
      } });
      if (ctx.readonly) ctx.ready();
    }
  };

  // =====================================================================
  // Практика 1. Что случилось с заказом из жалобы
  const SERVICES = ['checkout', 'payment', 'warehouse', 'bonus', 'bank-gateway'];
  const CODES = ['BANK_TIMEOUT', 'INSUFFICIENT_FUNDS', 'DB_CONNECTION_CLOSED', 'PRINTER_RETRY'];
  const VERSIONS = ['2.30', '2.31'];
  const timeouts = () => O.logs().filter(d => d['error.code'] === 'BANK_TIMEOUT').length;
  const findTask = {
    id: 'find', title: 'Что случилось с заказом из жалобы',
    lead: ui.brief({
      situation: `Надя: «Клиент пишет: в 14:07 не смог оплатить заказ ${O.complaint().id}, приложение просило попробовать ещё раз. Что произошло? И это только у него?»`,
      todo: ['Найдите записи заказа в поиске по логам.', 'Заполните ответ: сервис, код ошибки, trace_id запроса, сколько всего таких сбоев и в какой версии сервиса.', 'Нажмите «Проверить».'],
      look: 'Номер заказа — поле order_id. «Сколько таких» — запрос по коду ошибки, без номера заказа.'
    }),
    blank: () => ({ k: { q: '', range: 'all' }, f: {} }),
    reference: () => { const C = O.complaint(); return { k: { q: 'order_id:' + C.id, range: 'all' }, f: { svc: 'payment', code: 'BANK_TIMEOUT', trace: C.trace, count: String(timeouts()), ver: '2.31' } }; },
    render(el, ctx) {
      const a = ctx.ans; a.k = a.k || { q: '', range: 'all' }; a.f = a.f || {};
      const C = O.complaint(), judged = !!(ctx.result || ctx.readonly);
      const st = (id, ok) => judged && a.f[id] ? (ok ? 'ok' : 'bad') : '';
      const box = document.createElement('div'); el.appendChild(box);
      O.kibana(box, { docs: O.logs(), value: a.k, readonly: ctx.readonly, onChange: v => { a.k = v; ctx.save(); } });
      el.insertAdjacentHTML('beforeend', `<div class="lg-form" style="margin-top:12px">
        <div class="lg-f ${st('svc', a.f.svc === 'payment')}"><label for="lg-svc">Где сломалось — сервис</label><select id="lg-svc" data-f="svc" ${ctx.readonly ? 'disabled' : ''}><option value="">Выберите…</option>${SERVICES.map(s => `<option ${a.f.svc === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="lg-f ${st('code', a.f.code === 'BANK_TIMEOUT')}"><label for="lg-code">Код ошибки</label><select id="lg-code" data-f="code" ${ctx.readonly ? 'disabled' : ''}><option value="">Выберите…</option>${CODES.map(s => `<option ${a.f.code === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="lg-f ${st('trace', String(a.f.trace || '').trim() === C.trace)}"><label for="lg-trace">trace_id этого запроса</label><input id="lg-trace" type="text" data-f="trace" value="${esc(a.f.trace || '')}" placeholder="16 знаков" spellcheck="false" ${ctx.readonly ? 'readonly' : ''}></div>
        <div class="lg-f ${st('count', +a.f.count === timeouts())}"><label for="lg-count">Сколько всего таких сбоев за 13:50–14:40</label><input id="lg-count" type="text" inputmode="numeric" data-f="count" value="${esc(a.f.count || '')}" placeholder="число" ${ctx.readonly ? 'readonly' : ''}></div>
        <div class="lg-f ${st('ver', a.f.ver === '2.31')}"><label for="lg-ver">В какой версии сервиса начались сбои</label><select id="lg-ver" data-f="ver" ${ctx.readonly ? 'disabled' : ''}><option value="">Выберите…</option>${VERSIONS.map(s => `<option ${a.f.ver === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>`);
      el.addEventListener('change', e => { const f = e.target.dataset.f; if (!f || e.target.tagName !== 'SELECT') return; a.f[f] = e.target.value; e.target.closest('.lg-f').classList.remove('ok', 'bad'); ctx.save(); });
      el.addEventListener('input', e => { const f = e.target.dataset.f; if (!f || e.target.tagName !== 'INPUT') return; a.f[f] = e.target.value; e.target.closest('.lg-f').classList.remove('ok', 'bad'); ctx.save(); });
    },
    check(ans) {
      const f = ans.f || {}, C = O.complaint(), n = timeouts(), notes = [];
      const res = { svc: f.svc === 'payment', code: f.code === 'BANK_TIMEOUT', trace: String(f.trace || '').trim() === C.trace, count: +f.count === n, ver: f.ver === '2.31' };
      if (!res.svc) notes.push({ ok: false, html: f.svc === 'checkout' ? 'checkout только показал ошибку клиенту. Где запись уровня ERROR?' : 'Найдите записи заказа: <code>order_id:' + C.id + '</code> — и посмотрите, у какого сервиса уровень ERROR.' });
      if (!res.code) notes.push({ ok: false, html: 'Раскройте запись с ошибкой: код лежит в поле <code>error.code</code>.' });
      if (!res.trace) notes.push({ ok: false, html: 'trace_id — в той же записи. Он одинаковый у всех записей одного запроса.' });
      if (!res.count) notes.push({ ok: false, html: 'Сколько всего — запрос по коду ошибки без номера заказа: <code>error.code:BANK_TIMEOUT</code>, за всё время.' });
      if (!res.ver) notes.push({ ok: 'warn', html: 'Версия — поле <code>version</code> у записей payment. Сравните «до 14:05» и «после 14:05».' });
      const good = Object.values(res).filter(Boolean).length;
      return { ok: res.svc && res.code && res.trace && res.count, score: good / 5, notes, summary: `Верно ${good} из 5.`, mentor: res.count ? null : 'Один заказ — это жалоба. Семьдесят заказов за полчаса — это инцидент. Поэтому второй вопрос дежурного всегда «сколько таких».' };
    },
    answers: ans => {
      const f = ans.f || {}, C = O.complaint(), n = timeouts();
      return [
        { q: 'Где сломалось — сервис', mine: f.svc || '', right: 'payment', ok: f.svc === 'payment', why: 'Запись уровня ERROR по заказу пишет payment: он ждал банк и оборвал запрос. checkout лишь показал клиенту «попробуйте ещё раз» (WARN).' },
        { q: 'Код ошибки', mine: f.code || '', right: 'BANK_TIMEOUT', ok: f.code === 'BANK_TIMEOUT', why: 'В поле error.code записи ERROR. Это не отказ банка (INSUFFICIENT_FUNDS — бизнес-исход), а таймаут: банк не успел ответить за отведённое время.' },
        { q: 'trace_id запроса', mine: f.trace || '', right: C.trace, ok: String(f.trace || '').trim() === C.trace, why: 'trace_id одинаков у всех записей одного запроса — по нему из любого лога попадают в трассу и в записи других сервисов (кнопка «Все записи этого запроса»).' },
        { q: 'Сколько всего таких сбоев за 13:50–14:40', mine: f.count || '', right: String(n), ok: +f.count === n, why: `Запрос error.code:BANK_TIMEOUT за всё время даёт ${n}. Гистограмма показывает, что все они после 14:05: это не один невезучий клиент, а инцидент.` },
        { q: 'В какой версии начались сбои', mine: f.ver || '', right: '2.31', ok: f.ver === '2.31', why: 'До 14:05 у payment версия 2.30 и ни одного BANK_TIMEOUT. В 14:05 запустилась 2.31 — и в записи о запуске сказано: bank.timeout_ms=1000 (было 5000). Поиск по <code>event:service.started</code> её находит.' }
      ];
    },
    viz: (el) => {
      // Путь по логам кнопками: один заказ → сколько таких → что изменилось.
      const C = O.complaint();
      const STEPS = [
        { t: 'Один заказ', q: 'order_id:' + C.id, say: 'Все записи заказа: payment пишет ERROR с BANK_TIMEOUT, checkout — WARN «клиенту показана ошибка». Раскройте запись ERROR — там trace_id.' },
        { t: 'Сколько таких', q: 'error.code:BANK_TIMEOUT', say: 'Тот же код ошибки без номера заказа: десятки записей, и все — после жёлтой линии 14:05.' },
        { t: 'Что изменилось в 14:05', q: 'event:service.started', say: 'Запись о запуске payment 2.31: таймаут к банку стал 1000 мс вместо 5000. Банк обычно отвечает 0,3–1,6 с — часть платежей перестала успевать.' }
      ];
      let k = 0, kb = null;
      el.innerHTML = `<div class="stack"><div class="row" data-steps>${STEPS.map((x, i) => `<button type="button" class="btn sm ${i === k ? 'primary' : 'ghost'}" data-k="${i}">${i + 1}. ${esc(x.t)}</button>`).join('')}</div><p class="small" data-say></p><div data-kb></div></div>`;
      const go = i => { k = i; TR.$$('[data-k]', el).forEach(b => b.className = 'btn sm ' + (+b.dataset.k === k ? 'primary' : 'ghost')); TR.$('[data-say]', el).textContent = STEPS[k].say; kb.set(STEPS[k].q, 'all'); };
      kb = O.kibana(TR.$('[data-kb]', el), { docs: O.logs(), value: { q: STEPS[0].q, range: 'all' } });
      TR.$('[data-steps]', el).addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) go(+b.dataset.k); });
      go(0);
    },
    explain: `<p>Путь дежурного по логам: <b>один заказ</b> (<code>order_id:${O.complaint().id}</code>) → запись ERROR → <code>error.code</code> и <code>trace_id</code> → <b>сколько таких</b> (<code>error.code:BANK_TIMEOUT</code>) → <b>когда началось</b> (гистограмма, 14:05) → <b>что изменилось в это время</b> (<code>event:service.started</code>: версия 2.31 с таймаутом 1000 мс). Это и есть причина: банк обычно отвечает за 0,3–1,6 секунды, а ждать стали одну.</p>
      <p>Без поля <code>version</code> и записи о запуске связь с выкаткой пришлось бы угадывать. Поэтому в требованиях к логам — версия сервиса в каждой записи и событие о запуске с ключевыми настройками.</p>`,
    report: ans => { const f = ans.f || {}; return `Сервис: ${f.svc || '—'} · код: ${f.code || '—'} · trace_id: ${f.trace || '—'} · всего таких: ${f.count || '—'} · версия: ${f.ver || '—'}`; }
  };

  // =====================================================================
  // Практика 2. Уровни логов
  const LV = [
    { id: 'v1', t: 'Банк не ответил за 1000 мс, платёж не прошёл', ok: 'ERROR', because: 'Система не выполнила операцию из-за сбоя, клиент получил ошибку. ERROR — то, на что должен посмотреть человек, и то, что считают в доле ошибок.' },
    { id: 'v2', t: 'Банк отказал: у клиента недостаточно средств', ok: 'INFO', because: 'Система сработала правильно, это бизнес-исход. Запишешь ERROR — доля «ошибок» будет расти от бедных клиентов, и алерт начнёт будить дежурного зря.' },
    { id: 'v3', t: 'Вызов склада не прошёл, повтор удался со второй попытки', ok: 'WARN', because: 'Необычно, но обработано без вреда для клиента. По одному — не беда; если таких станет много, это ранний признак проблемы.' },
    { id: 'v4', t: 'Заказ 1261 оплачен', ok: 'INFO', because: 'Нормальное бизнес-событие: его ищет поддержка и по нему восстанавливают историю заказа.' },
    { id: 'v5', t: 'Значения всех переменных перед вызовом банка', ok: 'DEBUG', because: 'Подробности для отладки у разработчика. На проде DEBUG выключают: он дорогой по объёму и легко утягивает в лог лишние данные.' },
    { id: 'v6', t: 'Не удалось записать заказ в базу: соединение закрыто', ok: 'ERROR', because: 'Операция не выполнена из-за сбоя инфраструктуры — нужен человек или автоматический повтор, и это надо видеть.' },
    { id: 'v7', t: 'Клиент ввёл промокод, которого нет', ok: 'INFO', because: 'Ошибка пользователя, а не системы: всё отработало как задумано. Это бизнес-событие — полезно аналитике, но не дежурному.' },
    { id: 'v8', t: 'На диске сервера логов осталось 10 % места', ok: 'WARN', because: 'Пока всё работает, но скоро перестанет. Такое предупреждение заранее — повод для задачи в рабочие часы, а не ночного звонка.' }
  ];
  const LEVELS = [{ v: 'ERROR', t: 'ERROR — сбой, нужен человек' }, { v: 'WARN', t: 'WARN — необычно, но обработано' }, { v: 'INFO', t: 'INFO — бизнес-событие' }, { v: 'DEBUG', t: 'DEBUG — детали для отладки' }];
  const LV_WHY = {
    ERROR: 'ERROR — когда система не смогла сделать своё дело из-за сбоя; здесь всё отработало, как задумано, или беда ещё не наступила',
    WARN: 'WARN — для необычного, что обработано без вреда; здесь либо настоящий сбой, либо обычное событие',
    INFO: 'INFO — обычное событие; здесь либо сбой, либо раннее предупреждение',
    DEBUG: 'DEBUG выключен на проде — так событие просто пропадёт'
  };
  const levels = {
    id: 'levels', title: 'Расставьте уровни логов',
    lead: ui.brief({ situation: 'Половина «ошибок» в логах оплаты — отказы банка «недостаточно средств». Из-за них алерт «ошибки в логе» срабатывает каждые пять минут, и Саша его выключил.', todo: ['Для каждого события выберите уровень.', 'Нажмите «Проверить». Засчитывается от семи верных из восьми.'], look: 'ERROR — это сбой системы, а не «что-то пошло не так у клиента».' }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(LV.map(r => [r.id, r.ok])) }),
    render(el, ctx) {
      const a = ctx.ans; a.m = a.m || {};
      let rv = null;
      if (ctx.result || ctx.readonly) { rv = {}; LV.forEach(r => { const g = a.m[r.id]; if (g) rv[r.id] = { s: g === r.ok ? 'ok' : 'bad', why: '' }; }); }
      ui.match(el, { rows: LV.map(r => ({ id: r.id, t: esc(r.t) })), choices: LEVELS, value: a.m, reveal: rv, readonly: ctx.readonly, placeholder: 'Уровень…', onChange: v => { a.m = v; ctx.save(); } });
    },
    check(ans) {
      const m = ans.m || {}, good = LV.filter(r => m[r.id] === r.ok).length, notes = [];
      const empty = LV.filter(r => !m[r.id]).length;
      if (empty) notes.push({ ok: false, html: `Без уровня: ${empty}.` });
      if (m.v2 === 'ERROR') notes.push({ ok: false, html: 'Отказ банка «недостаточно средств» записан как ERROR — ровно из-за этого алерт по ошибкам и стал шумом.' });
      LV.forEach(r => { const g = m[r.id]; if (g && g !== r.ok && r.id !== 'v2') notes.push({ ok: 'warn', html: `«${esc(r.t)}» — не ${g}.` }); });
      return { ok: good >= 7 && m.v2 !== 'ERROR', score: good / LV.length, notes, summary: `Верно ${good} из ${LV.length}.` };
    },
    answers: ans => ui.matchAnswers(LV, LEVELS, ans.m, (r, g) => LV_WHY[g] ? ui.cap(LV_WHY[g]) + '.' : ''),
    viz: (el, ans) => {
      // Что увидит алерт «доля ERROR», если отказы банка писать как ERROR.
      const S = O.series(), lab = O.labels(S.n);
      let asError = (ans.m || {}).v2 === 'ERROR';
      const draw = () => {
        const per = S.req.map((x, i) => { const err = S.fail[i] + (asError ? S.declined[i] : 0); return x ? Math.round(err / x * 1000) / 10 : 0; });
        el.innerHTML = `<div class="stack"><label class="toggle"><input type="checkbox" data-t ${asError ? 'checked' : ''}> <span>Отказ банка «нет денег» пишем как ERROR</span></label>
          ${O.panel('Доля записей ERROR среди платежей по минутам, %', O.chart({ series: [{ name: 'ERROR, %', color: 'var(--bad)', data: per }], labels: lab, thresholds: [{ v: 2, label: 'алерт: больше 2 %' }], annotations: [{ i: S.deployIdx, label: '14:05' }], yFmt: v => v.toFixed(0) + ' %' }), { wide: true })}
          <p class="small">${asError ? 'До 14:05 сбоев не было, а алерт уже срабатывает — от клиентов, у которых не хватило денег. Через неделю такой алерт выключат, как Саша выключил свой.' : 'До 14:05 линия лежит на нуле, после — резко вверх. Отказы банка — бизнес-исход, они в INFO и не шумят.'}</p></div>`;
        O.hover(el);
      };
      el.addEventListener('change', e => { if (e.target.matches('[data-t]')) { asError = e.target.checked; draw(); } });
      draw();
    },
    explain: '<p>Уровень — это обещание читателю. <b>ERROR</b> — система не смогла, нужен человек или повтор; по ERROR строят долю ошибок и алерты. <b>WARN</b> — необычно, но обработано; ранний признак. <b>INFO</b> — бизнес-события, история заказа. <b>DEBUG</b> — детали для разработчика, на проде выключены. Самая частая ошибка — писать ERROR на отказ банка или неверный промокод: «ошибки» растут от поведения клиентов, и алерты превращаются в шум.</p>',
    report: ans => LV.map(r => `- ${r.t} → ${(ans.m || {})[r.id] || '—'} ${(ans.m || {})[r.id] === r.ok ? '✓' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 3. Персональные данные в логах
  const PII = [
    { id: 'p1', t: 'order_id — номер заказа', ok: 'as', because: 'По номеру заказа ищет поддержка. Сам по себе он не раскрывает человека.' },
    { id: 'p2', t: 'customer_id — внутренний номер клиента', ok: 'as', because: 'Внутренний идентификатор без смысла снаружи: по нему связывают события клиента, не раскрывая, кто он.' },
    { id: 'p3', t: 'phone — телефон клиента', ok: 'mask', because: 'Персональные данные. Если поддержке нужно сверить номер, пишут маску вроде +7 916 ***-**-67; полный номер — нельзя (замечание юристов, 152-ФЗ).' },
    { id: 'p4', t: 'card_number — номер карты', ok: 'never', because: 'Данные карты не покидают платёжный контур — ни целиком, ни в «маскированном» виде с лишними цифрами. Это требование PCI DSS; в логе — только токен платежа.' },
    { id: 'p5', t: 'address — адрес доставки', ok: 'never', because: 'Адрес нужен курьеру, а не логам. Для разбора хватит номера заказа и склада; адрес в логе — утечка персональных данных.' },
    { id: 'p6', t: 'email — почта клиента', ok: 'mask', because: 'Персональные данные. Если без неё не разобрать, например, сбой отправки чека, — маска вида a***@mail.ru.' },
    { id: 'p7', t: 'trace_id — номер запроса', ok: 'as', because: 'Технический идентификатор: связывает записи одного запроса и трассу. Ничего не говорит о человеке.' },
    { id: 'p8', t: 'password / token — пароль, токен доступа', ok: 'never', because: 'Секреты в логах — прямой путь к взлому: кто читает логи, получит доступ. Не пишут никогда, даже в DEBUG.' }
  ];
  const PB = [{ id: 'as', t: 'Писать как есть' }, { id: 'mask', t: 'Только в маске' }, { id: 'never', t: 'Никогда' }];
  const pii = {
    id: 'pii', title: 'Найдите утечку телефонов и решите, что можно писать в логи',
    lead: ui.brief({ situation: 'Юристы снова спрашивают про телефоны в логах. Надя уверена, что «оплата ничего такого не пишет».', todo: ['Найдите в поиске сервис, который пишет телефоны клиентов, — подсказка: российские номера начинаются с <code>+7</code>.', 'Разложите поля по корзинам.', 'Нажмите «Проверить».'], look: 'Слово без поля ищется в тексте сообщения.' }),
    blank: () => ({ k: { q: '', range: 'all' }, svc: '', v: {} }),
    reference: () => ({ k: { q: '+7', range: 'all' }, svc: 'bonus', v: Object.fromEntries(PII.map(p => [p.id, p.ok])) }),
    render(el, ctx) {
      const a = ctx.ans; a.k = a.k || { q: '', range: 'all' }; a.v = a.v || {};
      const judged = !!(ctx.result || ctx.readonly);
      const box = document.createElement('div'); el.appendChild(box);
      O.kibana(box, { docs: O.logs(), value: a.k, readonly: ctx.readonly, fields: ['service', 'event', 'level'], onChange: v => { a.k = v; ctx.save(); } });
      el.insertAdjacentHTML('beforeend', `<div class="lg-form" style="margin:12px 0"><div class="lg-f ${judged && a.svc ? (a.svc === 'bonus' ? 'ok' : 'bad') : ''}"><label for="pi-svc">Какой сервис пишет телефоны</label><select id="pi-svc" data-svc ${ctx.readonly ? 'disabled' : ''}><option value="">Выберите…</option>${SERVICES.map(s => `<option ${a.svc === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div><div data-sort></div>`);
      el.addEventListener('change', e => { if (e.target.matches('[data-svc]')) { a.svc = e.target.value; ctx.save(); } });
      let rv = null;
      if (judged) { rv = {}; PII.forEach(p => { if (a.v[p.id]) rv[p.id] = a.v[p.id] === p.ok ? 'ok' : 'bad'; }); }
      ui.sort(TR.$('[data-sort]', el), { items: PII.map(p => ({ id: p.id, t: esc(p.t) })), buckets: PB, value: a.v, reveal: rv, readonly: ctx.readonly, seed: 'lg-pii', onChange: v => { a.v = v; ctx.save(); } });
    },
    check(ans) {
      const v = ans.v || {}, good = PII.filter(p => v[p.id] === p.ok).length, notes = [];
      if (ans.svc !== 'bonus') notes.push({ ok: false, html: ans.svc ? `В ${esc(ans.svc)} телефонов нет. Введите <code>+7</code> и посмотрите поле service слева.` : 'Не указан сервис, который пишет телефоны.' });
      const empty = PII.filter(p => !v[p.id]).length;
      if (empty) notes.push({ ok: false, html: `Не разложено: ${empty}.` });
      if (v.p4 && v.p4 !== 'never') notes.push({ ok: false, html: 'Номер карты в логах — нарушение требований к платёжным данным. Только токен платежа.' });
      if (v.p8 && v.p8 !== 'never') notes.push({ ok: false, html: 'Пароли и токены не пишут никогда.' });
      return { ok: ans.svc === 'bonus' && good >= 7 && v.p4 === 'never' && v.p8 === 'never', score: (good / PII.length) * 0.8 + (ans.svc === 'bonus' ? 0.2 : 0), notes, summary: `Сервис: ${ans.svc === 'bonus' ? 'верно' : 'нет'} · полей верно ${good} из ${PII.length}.` };
    },
    flags: ans => { const v = ans.v || {}, f = []; if (v.p4 && v.p4 !== 'never') f.push('Разрешил номер карты в логах'); if (v.p8 && v.p8 !== 'never') f.push('Разрешил пароли или токены в логах'); return f; },
    answers: ans => [{ q: 'Какой сервис пишет телефоны клиентов', mine: ans.svc || '', right: 'bonus', ok: ans.svc === 'bonus', why: 'Поиск <code>+7</code> находит записи «Начислено N баллов клиенту +7916…» — их пишет bonus. Поддержка не видела этого, потому что смотрела только оплату. Лечится так: в тексте сообщения — customer_id вместо телефона.' }]
      .concat(ui.sortAnswers(PII, PB, ans.v)),
    viz: (el) => {
      // Как одна строка лога меняется по правилам маскирования.
      const RULES = [
        { id: 'phone', t: 'Телефон → маска', f: x => x.replace(/\+7(\d{3})(\d{3})(\d{2})(\d{2})/g, '+7 $1 ***-**-$4') },
        { id: 'cust', t: 'Телефон → customer_id', f: x => x.replace(/клиенту \+7[\d ]+(\*\*\*-\*\*-\d{2})?/g, 'клиенту c-51234') },
        { id: 'card', t: 'Карту — убрать', f: x => x.replace(/,? ?карта [\d ]{19}/g, '') },
        { id: 'mail', t: 'Почту → маска', f: x => x.replace(/([a-z])[a-z.]*@/g, '$1***@') }
      ];
      const on = {};
      const SRC = 'Начислено 120 баллов клиенту +79161234567, карта 4276 1300 1234 5678, чек на anna.petrova@mail.ru';
      const draw = () => {
        let out = SRC; RULES.forEach(r => { if (on[r.id]) out = r.f(out); });
        const left = [/\+7\d{10}/.test(out) ? 'полный телефон' : '', /\d{4} \d{4} \d{4} \d{4}/.test(out) ? 'номер карты' : '', /[a-z]{2,}\.?[a-z]*@/.test(out) ? 'полная почта' : ''].filter(Boolean);
        el.innerHTML = `<div class="stack"><div class="row">${RULES.map(r => `<label class="toggle"><input type="checkbox" data-r="${r.id}" ${on[r.id] ? 'checked' : ''}> <span>${esc(r.t)}</span></label>`).join('')}</div>
          <div class="lg-box"><div class="eyebrow">Было — так пишет bonus сейчас</div><pre>${esc(SRC)}</pre></div>
          <div class="lg-box"><div class="eyebrow">Станет в логе</div><pre>${esc(out)}</pre></div>
          <p class="small ${left.length ? '' : 'dim'}">${left.length ? '<b style="color:var(--bad)">В логе всё ещё: ' + esc(left.join(', ')) + '.</b> Включите правила.' : 'Персональных данных и данных карты не осталось — по customer_id поддержка всё равно найдёт клиента.'}</p></div>`;
      };
      el.addEventListener('change', e => { const r = e.target.dataset.r; if (r) { on[r] = e.target.checked; draw(); } });
      draw();
    },
    explain: '<p>Персональные данные попадают в логи не из злого умысла, а из удобства: «вставлю телефон в сообщение, чтобы поддержке было проще». Поэтому в требованиях к логам — <b>явный список запрещённых полей</b> и правило маски, а ещё проверка: поиск по шаблону телефона и карты в логах раз в день. Связывать события клиента нужно внутренним <code>customer_id</code>, а не телефоном.</p>',
    report: ans => `Сервис с телефонами: ${ans.svc || '—'}\n` + PII.map(p => `- ${p.t} → ${((PB.find(b => b.id === (ans.v || {})[p.id]) || {}).t) || '—'} ${(ans.v || {})[p.id] === p.ok ? '✓' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 4. Поля записи «платёж не прошёл»
  const FIELDS = [
    { id: 'ts', need: true, t: '@timestamp', sub: 'когда, с часовым поясом', why: 'без точного времени не сопоставить события разных сервисов и не построить гистограмму' },
    { id: 'level', need: true, t: 'level', sub: 'уровень: ERROR', why: 'по уровню фильтруют и считают долю ошибок' },
    { id: 'svc', need: true, t: 'service + version', sub: 'кто писал и в какой версии', why: 'без версии связь сбоя с выкаткой придётся угадывать — как в понедельник' },
    { id: 'event', need: true, t: 'event', sub: 'код события: payment.failed', why: 'код не меняется, когда переписывают текст сообщения, — по нему строят поиск, графики и алерты' },
    { id: 'order', need: true, t: 'order_id', sub: 'номер заказа', why: 'по нему ищет поддержка' },
    { id: 'trace', need: true, t: 'trace_id', sub: 'номер запроса', why: 'по нему связывают записи всех сервисов и трассу' },
    { id: 'code', need: true, t: 'error.code', sub: 'BANK_TIMEOUT', why: 'по коду ошибки считают «сколько таких» и отличают сбой от отказа банка' },
    { id: 'dur', useful: true, t: 'duration_ms', sub: 'сколько ждали банк', because: 'видно, что запрос оборвали ровно на таймауте, а не банк ответил отказом' },
    { id: 'attempt', useful: true, t: 'attempt', sub: 'номер попытки', because: 'понятно, был ли повтор и сколько раз' },
    { id: 'status', useful: true, t: 'http.status', sub: '504', because: 'стандартный код ответа помогает агрегировать ошибки разных вызовов' },
    { id: 'msg', useful: true, t: 'message', sub: 'текст для человека', because: 'человеку проще читать фразу, а машине — поля; нужны оба' },
    { id: 'card', bad: true, t: 'card_number', sub: 'номер карты', why: 'данные карты не покидают платёжный контур — никогда' },
    { id: 'body', bad: true, t: 'request_body', sub: 'тело запроса к банку целиком', why: 'в теле запроса к банку — данные карты и персональные данные' },
    { id: 'name', bad: true, t: 'customer_name', sub: 'имя и фамилия клиента', why: 'персональные данные, которые для разбора не нужны: хватит customer_id' },
    { id: 'token', bad: true, t: 'auth_token', sub: 'токен доступа к банку', why: 'секрет: кто читает логи, получит доступ к банку' }
  ];
  const fields = {
    id: 'fields', title: 'Соберите запись лога «платёж не прошёл»',
    lead: ui.brief({ situation: 'Гоша: «Перепишем логи оплаты на записи с полями. Составь, какие поля обязательны в записи payment.failed — это пойдёт в постановку».', todo: ['Отметьте поля, которые должны быть в записи.', 'Нажмите «Проверить». Засчитывается, когда все обязательные на месте, лишних нет и полезных хотя бы три.'], look: 'Что понадобилось, чтобы разобрать заказ из жалобы? Что запретили юристы?' }),
    blank: () => ({ f: [] }),
    reference: () => ({ f: FIELDS.filter(f => f.need || f.useful).map(f => f.id) }),
    render(el, ctx) {
      const a = ctx.ans; a.f = a.f || [];
      const judged = !!(ctx.result || ctx.readonly);
      const box = f => { const on = a.f.includes(f.id); let cls = ''; if (judged) cls = on ? (f.bad ? 'bad' : 'ok') : (f.need ? 'miss' : ''); return `<label class="lg-cb ${cls}"><input type="checkbox" data-f="${f.id}" ${on ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}><span><code>${esc(f.t)}</code><small>${esc(f.sub)}</small></span></label>`; };
      el.innerHTML = `<div class="lg-fields">${TR.shuffle(FIELDS, 'lg-fields').map(box).join('')}</div>`;
      el.addEventListener('change', e => { const id = e.target.dataset.f; if (!id) return; a.f = e.target.checked ? a.f.concat(id) : a.f.filter(x => x !== id); e.target.closest('.lg-cb').classList.remove('ok', 'bad', 'miss'); ctx.save(); });
    },
    check(ans) {
      const S = new Set(ans.f || []), notes = [];
      const miss = FIELDS.filter(f => f.need && !S.has(f.id)), bad = FIELDS.filter(f => f.bad && S.has(f.id)), useful = FIELDS.filter(f => f.useful && S.has(f.id)).length;
      miss.forEach(f => notes.push({ ok: false, html: `Нет <code>${esc(f.t)}</code>: ${esc(f.why)}.` }));
      bad.forEach(f => notes.push({ ok: false, html: `<code>${esc(f.t)}</code> — лишнее: ${esc(f.why)}.` }));
      if (useful < 3) notes.push({ ok: 'warn', html: 'Мало подробностей для разбора: сколько ждали, какая попытка, какой код ответа?' });
      const needN = FIELDS.filter(f => f.need).length;
      const score = Math.max(0, (needN - miss.length) / needN * 0.55 + Math.min(useful, 4) / 4 * 0.25 + (bad.length ? 0 : 0.2) - bad.length * 0.1);
      return { ok: !miss.length && !bad.length && useful >= 3, score, notes, summary: `Обязательных: ${needN - miss.length} из ${needN} · полезных: ${useful} из 4 · лишних: ${bad.length}.` };
    },
    flags: ans => { const S = new Set(ans.f || []), f = []; if (S.has('card') || S.has('body')) f.push('Данные карты или тело запроса к банку в логе'); if (!S.has('trace')) f.push('Запись без trace_id — не связать с трассой'); return f; },
    answers: ans => { const S = new Set(ans.f || []); return FIELDS.map(f => { const on = S.has(f.id); return { q: f.t + ' — ' + f.sub, mine: on ? 'в записи' : 'нет в записи', right: f.need ? 'обязательно' : f.useful ? 'полезно добавить' : 'не писать', ok: f.bad ? !on : on, why: esc(ui.cap(f.because || f.why)) + '.' }; }); },
    viz: (el, ans) => {
      // Ваша запись лога: JSON из выбранных полей; чего не хватает — что из-за этого не получится.
      const S = new Set(ans.f || []), C = O.complaint();
      const SAMPLE = { ts: ['@timestamp', '2026-11-02T14:07:23.412+03:00'], level: ['level', 'ERROR'], svc: ['service', 'payment'], event: ['event', 'payment.failed'], order: ['order_id', C.id], trace: ['trace_id', C.trace], code: ['error.code', 'BANK_TIMEOUT'], dur: ['duration_ms', 1000], attempt: ['attempt', 1], status: ['http.status', 504], msg: ['message', 'Банк не ответил за 1000 мс'], card: ['card_number', '4276 1300 1234 5678'], body: ['request_body', '{"pan":"4276…","cvv":"***"…}'], name: ['customer_name', 'Анна Петрова'], token: ['auth_token', 'eyJhbGciOi…'] };
      const rec = {}; FIELDS.forEach(f => { if (S.has(f.id)) { const [k, v] = SAMPLE[f.id]; rec[k] = v; if (f.id === 'svc') rec.version = '2.31'; } });
      const CAN = [
        { need: 'order', t: 'Надя найдёт заказ по номеру' }, { need: 'trace', t: 'Из лога — в трассу и записи других сервисов' },
        { need: 'code', t: 'Посчитать «сколько таких» и отличить сбой от отказа банка' }, { need: 'svc', t: 'Связать сбой с выкаткой версии' },
        { need: 'event', t: 'Алерт и график не сломаются, когда перепишут текст сообщения' }, { need: 'ts', t: 'Выстроить события разных сервисов по времени' }
      ];
      const bad = FIELDS.filter(f => f.bad && S.has(f.id));
      el.innerHTML = `<div class="lg-two"><div class="lg-box"><div class="eyebrow">Ваша запись payment.failed</div><pre>${esc(JSON.stringify(rec, null, 2))}</pre></div>
        <div class="lg-box"><div class="eyebrow">Что с ней получится</div><ul class="checks">${CAN.map(c => `<li class="${S.has(c.need) ? '' : 'bad'}">${esc(c.t)}</li>`).join('')}${bad.map(f => `<li class="bad">Утечка: <code>${esc(f.t)}</code> — ${esc(f.why)}</li>`).join('')}</ul></div></div>`;
    },
    explain: '<p>Запись лога — тоже контракт: по её полям строят поиск, графики и алерты. Обязательный минимум для любой записи: <b>время с поясом, уровень, сервис и версия, код события, trace_id</b>; для бизнес-событий — бизнес-ключ (<code>order_id</code>); для ошибок — <code>error.code</code>. Текст сообщения — для человека, поля — для машины. Запрещённые поля перечисляют явно: данные карт, тела запросов к платёжным системам, ФИО, телефоны, секреты.</p>',
    report: ans => (ans.f || []).map(id => (FIELDS.find(f => f.id === id) || {}).t).filter(Boolean).join(', ') || '—'
  };

  TR.stage({
    id: ID, act: 1, order: 20, slot: 'Вт', title: 'Логи: найти, что случилось',
    when: 'вторник · общий поиск по логам',
    intro: [
      { who: 'sasha', html: 'Раньше я ходил на шесть машин с grep. Гоша вчера собрал все логи в одно место. Покажите, как теперь искать, — у Нади новая жалоба.' },
      { who: 'gosha', html: 'Сегодня учимся читать логи: искать по полям, понимать уровни и не тащить в логи то, чего там быть не должно. И запишем, какие поля нужны в записи, — это пойдёт в постановку.' }
    ],
    facts: ['F-grep', 'F-pii', 'F-complaints', 'F-deploys'],
    glossary: [
      { term: 'Структурированный лог', simple: 'Запись лога с полями, а не просто фраза.', tech: 'Structured logging: запись в машиночитаемом формате (обычно JSON) с постоянным набором полей; поиск и агрегирование идут по полям.' },
      { term: 'Уровень лога', simple: 'Насколько запись важна: ERROR, WARN, INFO, DEBUG.', tech: 'Log level: ERROR — операция не выполнена; WARN — нештатно, но обработано; INFO — штатные события; DEBUG/TRACE — подробности для отладки, на проде обычно выключены.' },
      { term: 'trace_id', simple: 'Номер запроса, общий для всех записей и спанов этого запроса.', tech: 'Идентификатор распределённой трассы (W3C Trace Context, заголовок traceparent). Пишется в каждую запись лога, чтобы связать логи разных сервисов и трассу.' },
      { term: 'Kibana', simple: 'Окно поиска и графиков над хранилищем логов.', tech: 'Веб-интерфейс к Elasticsearch/OpenSearch: Discover (поиск по документам, KQL), визуализации, дашборды. Аналог для Loki — Grafana Explore с LogQL.' },
      { term: 'KQL', simple: 'Язык строки запроса в Kibana: поле:значение.', tech: 'Kibana Query Language: field:value, AND/OR/NOT, диапазоны (duration_ms > 1000), маски (service:pay*).' },
      { term: 'Маскирование', simple: 'Показать часть значения и спрятать остальное.', tech: 'Masking: замена части персональных данных символами (+7 916 ***-**-67) до записи в лог. Отличается от токенизации — замены значения на ссылку без смысла.' }
    ],
    outro: 'Логи теперь ищутся за секунды, а не полчаса. Но один заказ — это жалоба, семьдесят — инцидент, и узнавать про семьдесят надо не по жалобам. Завтра — метрики: числа, которые скажут «сейчас плохо» раньше Нади.',
    tasks: [howStruct, howKibana, findTask, levels, pii, fields]
  });
})();
