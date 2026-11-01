/* Диаграммы: последовательность (sequence) с пошаговым проигрыванием и ER-диаграмма с «вороньими лапками».
   Цвета берутся из токенов темы через style, поэтому диаграммы читаются и в тёмной, и в светлой теме. */
'use strict';
(function () {
  const TR = window.TR, esc = TR.esc, ui = TR.ui;
  let uidN = 0;
  const COL = { '': 'var(--text-2)', ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)', violet: 'var(--violet)' };

  // ---------- sequence ----------
  // cfg: { lanes:[{id,t,sub}], steps:[{from,to,t,note,kind,reply,lost,box,time}], controls:true, autoplay:false, speed:900, start:0|'all', onStep(i,step), onEnd() }
  ui.seq = (el, cfg) => {
    const id = 'sq' + (++uidN);
    const LW = cfg.laneW || 176, TOP = 70, ROW = cfg.row || 46, PADX = 14;
    let steps = (cfg.steps || []).slice(), shown = cfg.start === 'all' ? steps.length : (cfg.start || 0), timer = null;
    el.innerHTML = `<div class="seq-wrap">${cfg.controls === false ? '' : `<div class="seq-ctl">
        <button type="button" class="btn sm primary" data-sq="play">▶ Проиграть</button>
        <button type="button" class="btn sm" data-sq="step">Шаг →</button>
        <button type="button" class="btn sm ghost" data-sq="reset">⟲ Сначала</button>
        <button type="button" class="btn sm ghost" data-sq="all">Показать всё</button>
        <span class="small dim tnum" data-sq-n></span></div>`}
      <div class="board"></div><div class="seq-note" aria-live="polite"></div></div>`;
    const board = TR.$('.board', el), noteEl = TR.$('.seq-note', el), nEl = TR.$('[data-sq-n]', el);
    const lx = laneId => { const i = cfg.lanes.findIndex(l => l.id === laneId); return PADX + LW / 2 + Math.max(0, i) * LW; };
    function lines(t) { return String(t || '').split(/\n| \| /); }
    function draw() {
      const W = PADX * 2 + cfg.lanes.length * LW, H = TOP + steps.length * ROW + 24;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:${Math.min(W, cfg.lanes.length * 128)}px;max-width:${W}px" role="img" aria-label="${esc(cfg.title || 'Диаграмма последовательности')}">
        <defs>${Object.keys(COL).map(k => `<marker id="${id}-a${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:${COL[k]}"/></marker>`).join('')}</defs>`;
      cfg.lanes.forEach(l => {
        const x = lx(l.id);
        s += `<line x1="${x}" y1="${TOP - 10}" x2="${x}" y2="${H - 8}" style="stroke:var(--border-strong);stroke-dasharray:4 5"/>`;
        s += `<rect x="${x - LW / 2 + 8}" y="8" width="${LW - 16}" height="${l.sub ? 46 : 34}" rx="8" style="fill:var(--surface-2);stroke:var(--border-strong)"/>`;
        s += `<text x="${x}" y="${l.sub ? 28 : 30}" text-anchor="middle" style="fill:var(--text);font-size:13px;font-weight:600">${esc(l.t)}</text>`;
        if (l.sub) s += `<text x="${x}" y="44" text-anchor="middle" style="fill:var(--text-muted);font-size:11px">${esc(l.sub)}</text>`;
      });
      steps.forEach((st, i) => {
        if (i >= shown) {
          // будущий шаг — бледный контур без подписи: видна структура, но не ответ
          const y = TOP + i * ROW + ROW / 2 + 4, ghost = 'stroke:var(--text-muted);stroke-width:1.3;stroke-dasharray:4 4;opacity:.45';
          if (st.box) { const x1 = lx(st.from), x2 = lx(st.to || st.from), Lb = Math.min(x1, x2) - LW / 2 + 14, Rb = Math.max(x1, x2) + LW / 2 - 14; s += `<rect x="${Lb}" y="${y - 12}" width="${Rb - Lb}" height="22" rx="7" style="fill:none;${ghost}"/>`; }
          else if (st.from === st.to) s += `<path d="M${lx(st.from)} ${y - 8} h28 v14 h-26" style="fill:none;${ghost}"/>`;
          else { const gx1 = lx(st.from), gx2 = lx(st.to), gd = gx2 > gx1 ? 1 : -1; s += `<line x1="${gx1 + gd * 4}" y1="${y}" x2="${gx2 - gd * 4}" y2="${y}" style="${ghost}"/>`; }
          return;
        }
        const y = TOP + i * ROW + ROW / 2 + 4, cur = i === shown - 1;
        const k = COL[st.kind || ''] ? (st.kind || '') : '', c = COL[k];
        const sw = cur ? 2.6 : 1.6;
        const tStyle = `fill:${k ? c : 'var(--text)'};font-size:12.5px;${cur ? 'font-weight:600;' : ''}paint-order:stroke;stroke:var(--code-bg);stroke-width:4px;stroke-linejoin:round`;
        if (st.time) s += `<text x="4" y="${y + 4}" style="fill:var(--text-muted);font-size:10.5px;font-family:var(--f-mono)">${esc(st.time)}</text>`;
        if (st.box) {
          const x1 = lx(st.from), x2 = lx(st.to || st.from), L = Math.min(x1, x2) - LW / 2 + 14, R = Math.max(x1, x2) + LW / 2 - 14;
          s += `<rect x="${L}" y="${y - 15}" width="${R - L}" height="28" rx="7" style="fill:${k ? `color-mix(in srgb, ${c} 14%, var(--surface))` : 'var(--surface-3)'};stroke:${k ? c : 'var(--border-strong)'};stroke-width:${cur ? 1.8 : 1}"/>`;
          s += `<text x="${(L + R) / 2}" y="${y + 4}" text-anchor="middle" style="fill:var(--text);font-size:12.5px;${cur ? 'font-weight:600' : ''}">${esc(st.t)}</text>`;
          return;
        }
        const x1 = lx(st.from), x2 = lx(st.to);
        if (st.from === st.to) {
          const x = x1;
          s += `<path d="M${x} ${y - 10} h34 v18 h-30" style="fill:none;stroke:${c};stroke-width:${sw}" marker-end="url(#${id}-a${k})"/>`;
          lines(st.t).forEach((ln, j, a) => { s += `<text x="${x + 42}" y="${y - 2 + (j - (a.length - 1) / 2) * 14}" style="${tStyle}">${esc(ln)}</text>`; });
          return;
        }
        const dir = x2 > x1 ? 1 : -1;
        const xa = x1 + dir * 4, xb = st.lost ? x1 + (x2 - x1) * .62 : x2 - dir * 4;
        s += `<line x1="${xa}" y1="${y}" x2="${xb}" y2="${y}" style="stroke:${c};stroke-width:${sw};${st.reply ? 'stroke-dasharray:6 5;' : ''}" ${st.lost ? '' : `marker-end="url(#${id}-a${k})"`}/>`;
        if (st.lost) s += `<path d="M${xb - 7} ${y - 7} l14 14 M${xb + 7} ${y - 7} l-14 14" style="stroke:var(--bad);stroke-width:2.4"/>`;
        const mx = (x1 + (st.lost ? xb : x2)) / 2;
        const ls = lines(st.t);
        ls.forEach((ln, j) => { s += `<text x="${mx}" y="${y - 7 - (ls.length - 1 - j) * 14}" text-anchor="middle" style="${tStyle}">${esc(ln)}</text>`; });
      });
      s += '</svg>';
      board.innerHTML = s;
      const cur = steps[shown - 1];
      noteEl.innerHTML = cur ? (cur.note || '') : (cfg.hint || 'Нажмите «Проиграть» или «Шаг», чтобы увидеть, что происходит.');
      if (nEl) nEl.textContent = `${shown} / ${steps.length}`;
    }
    function stop() { clearInterval(timer); timer = null; const b = TR.$('[data-sq="play"]', el); if (b) b.textContent = '▶ Проиграть'; }
    function step() {
      if (shown >= steps.length) { stop(); return false; }
      shown++; draw(); cfg.onStep && cfg.onStep(shown - 1, steps[shown - 1]);
      if (shown >= steps.length) { stop(); cfg.onEnd && cfg.onEnd(); }
      return true;
    }
    function play() {
      if (timer) { stop(); return; }
      if (shown >= steps.length) { shown = 0; draw(); }
      const b = TR.$('[data-sq="play"]', el); if (b) b.textContent = '⏸ Пауза';
      step(); timer = setInterval(step, cfg.speed || 1000);
    }
    TR.on(el, 'click', '[data-sq]', (e, b) => {
      const a = b.dataset.sq;
      if (a === 'play') play();
      if (a === 'step') { stop(); step(); }
      if (a === 'reset') { stop(); shown = 0; draw(); }
      if (a === 'all') { stop(); shown = steps.length; draw(); cfg.onEnd && cfg.onEnd(); }
    });
    draw();
    if (cfg.autoplay) setTimeout(play, 300);
    return {
      play, step, stop,
      reset() { stop(); shown = 0; draw(); },
      all() { stop(); shown = steps.length; draw(); },
      set(newSteps, opts) { stop(); steps = (newSteps || []).slice(); shown = opts && opts.all ? steps.length : 0; draw(); if (opts && opts.play) play(); },
      get shown() { return shown; }
    };
  };

  // ---------- ER-диаграмма ----------
  // cfg: { entities:[{id,t,x,y,w,attrs:[{n,k,type,nul}],tone,sub}], rels:[{a,b,ca,cb,t,tone}], width, height, draggable, onMove(id,x,y), onClick(id), selected }
  ui.er = (el, cfg) => {
    const id = 'er' + (++uidN);
    const HEAD = 30, ROWH = 19;
    let drag = null;
    const box = e => {
      const w = e.w || (e.attrs && e.attrs.length ? 196 : 150);
      const h = HEAD + (e.attrs && e.attrs.length ? e.attrs.length * ROWH + 8 : (e.sub ? 16 : 6));
      return { x: e.x, y: e.y, w, h, cx: e.x + w / 2, cy: e.y + h / 2 };
    };
    function clip(b, tx, ty) {
      const dx = tx - b.cx, dy = ty - b.cy;
      if (!dx && !dy) return { x: b.cx, y: b.cy };
      const sx = (b.w / 2) / Math.abs(dx || 1e-9), sy = (b.h / 2) / Math.abs(dy || 1e-9), s = Math.min(sx, sy);
      return { x: b.cx + dx * s, y: b.cy + dy * s };
    }
    function ends(p, u, card, c) {
      // u — единичный вектор от сущности наружу
      const n = { x: -u.y, y: u.x }, at = d => ({ x: p.x + u.x * d, y: p.y + u.y * d });
      const bar = d => { const q = at(d); return `<line x1="${q.x + n.x * 7}" y1="${q.y + n.y * 7}" x2="${q.x - n.x * 7}" y2="${q.y - n.y * 7}" style="stroke:${c};stroke-width:1.6"/>`; };
      const circ = d => { const q = at(d); return `<circle cx="${q.x}" cy="${q.y}" r="4.5" style="fill:var(--code-bg);stroke:${c};stroke-width:1.5"/>`; };
      const crow = () => { const q = at(14); return `<path d="M${q.x} ${q.y} L${p.x + n.x * 8} ${p.y + n.y * 8} M${q.x} ${q.y} L${p.x} ${p.y} M${q.x} ${q.y} L${p.x - n.x * 8} ${p.y - n.y * 8}" style="stroke:${c};stroke-width:1.6;fill:none"/>`; };
      switch (card) {
        case '1': return bar(7) + bar(13);
        case '0..1': return bar(7) + circ(19);
        case '1..N': return crow() + bar(20);
        case '0..N': return crow() + circ(23);
        case 'N': return crow();
        default: return '';
      }
    }
    function draw() {
      const bs = Object.fromEntries(cfg.entities.map(e => [e.id, box(e)]));
      const W = cfg.width || Math.max(320, ...cfg.entities.map(e => bs[e.id].x + bs[e.id].w + 30));
      const H = cfg.height || Math.max(200, ...cfg.entities.map(e => bs[e.id].y + bs[e.id].h + 30));
      let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:${Math.min(W, 640)}px;max-width:${W}px;touch-action:${cfg.draggable ? 'none' : 'auto'}" role="img" aria-label="${esc(cfg.title || 'ER-диаграмма')}">`;
      (cfg.rels || []).forEach(r => {
        const A = bs[r.a], B = bs[r.b]; if (!A || !B) return;
        const c = COL[r.tone || ''] || COL[''];
        if (r.a === r.b) {
          const x = A.x + A.w, y = A.y + 12;
          s += `<path d="M${x} ${y} h30 v${Math.min(60, A.h - 20)} h-30" style="fill:none;stroke:${c};stroke-width:1.6"/>`;
          s += ends({ x, y }, { x: 1, y: 0 }, r.ca, c) + ends({ x, y: y + Math.min(60, A.h - 20) }, { x: 1, y: 0 }, r.cb, c);
          if (r.t) s += `<text x="${x + 36}" y="${y + 30}" style="fill:var(--text-2);font-size:11.5px">${esc(r.t)}</text>`;
          return;
        }
        const pa = clip(A, B.cx, B.cy), pb = clip(B, A.cx, A.cy);
        const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1, u = { x: (pb.x - pa.x) / len, y: (pb.y - pa.y) / len };
        s += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" style="stroke:${c};stroke-width:${r.tone ? 2 : 1.5};${r.dash ? 'stroke-dasharray:6 5;' : ''}"/>`;
        s += ends(pa, u, r.ca, c) + ends(pb, { x: -u.x, y: -u.y }, r.cb, c);
        if (r.t) s += `<text x="${(pa.x + pb.x) / 2}" y="${(pa.y + pb.y) / 2 - 6}" text-anchor="middle" style="fill:var(--text-2);font-size:11.5px;paint-order:stroke;stroke:var(--code-bg);stroke-width:4px">${esc(r.t)}</text>`;
      });
      cfg.entities.forEach(e => {
        const b = bs[e.id];
        const tone = e.tone ? COL[e.tone] : null, sel = cfg.selected === e.id;
        s += `<g data-ent="${esc(e.id)}" style="cursor:${cfg.draggable ? 'grab' : (cfg.onClick ? 'pointer' : 'default')}">`;
        s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="9" style="fill:var(--surface);stroke:${sel ? 'var(--accent)' : tone || 'var(--border-strong)'};stroke-width:${sel || tone ? 2 : 1.2}"/>`;
        s += `<path d="M${b.x} ${b.y + 9} a9 9 0 0 1 9 -9 h${b.w - 18} a9 9 0 0 1 9 9 v${HEAD - 9} h-${b.w} z" style="fill:${tone ? `color-mix(in srgb, ${tone} 18%, var(--surface-2))` : 'var(--surface-3)'}"/>`;
        s += `<text x="${b.x + 10}" y="${b.y + 20}" style="fill:var(--text);font-size:13px;font-weight:600">${esc(e.t)}</text>`;
        if (e.sub && !(e.attrs && e.attrs.length)) s += `<text x="${b.x + 10}" y="${b.y + HEAD + 8}" style="fill:var(--text-muted);font-size:11px">${esc(e.sub)}</text>`;
        (e.attrs || []).forEach((a, i) => {
          const y = b.y + HEAD + 15 + i * ROWH;
          const k = a.k ? `<tspan style="fill:${/PK/.test(a.k) ? 'var(--warn)' : /FK/.test(a.k) ? 'var(--info)' : 'var(--violet)'};font-weight:600;font-size:10px;font-family:var(--f-mono)">${esc(a.k)} </tspan>` : '';
          s += `<text x="${b.x + 10}" y="${y}" style="fill:${a.tone ? COL[a.tone] : 'var(--text)'};font-size:12px;font-family:var(--f-mono)">${k}${esc(a.n)}${a.nul ? '<tspan style="fill:var(--text-muted)">?</tspan>' : ''}</text>`;
          if (a.type) s += `<text x="${b.x + b.w - 8}" y="${y}" text-anchor="end" style="fill:var(--text-muted);font-size:10.5px;font-family:var(--f-mono)">${esc(a.type)}</text>`;
        });
        s += `</g>`;
      });
      s += '</svg>';
      el.innerHTML = `<div class="board">${s}</div>`;
    }
    const svgPt = (svg, ev) => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
    el.addEventListener('pointerdown', ev => {
      const g = ev.target.closest('[data-ent]'); if (!g) return;
      const e = cfg.entities.find(x => x.id === g.dataset.ent); if (!e) return;
      if (!cfg.draggable) { cfg.onClick && cfg.onClick(e.id); return; }
      const svg = el.querySelector('svg'), p = svgPt(svg, ev);
      drag = { e, dx: p.x - e.x, dy: p.y - e.y, moved: false, svg };
      g.setPointerCapture && g.setPointerCapture(ev.pointerId);
    });
    el.addEventListener('pointermove', ev => {
      if (!drag) return;
      const p = svgPt(drag.svg, ev);
      const nx = Math.max(4, Math.round((p.x - drag.dx) / 4) * 4), ny = Math.max(4, Math.round((p.y - drag.dy) / 4) * 4);
      if (Math.abs(nx - drag.e.x) + Math.abs(ny - drag.e.y) > 2) drag.moved = true;
      drag.e.x = nx; drag.e.y = ny; draw(); drag.svg = el.querySelector('svg');
    });
    const up = () => { if (!drag) return; const d = drag; drag = null; if (d.moved) cfg.onMove && cfg.onMove(d.e.id, d.e.x, d.e.y); else cfg.onClick && cfg.onClick(d.e.id); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    draw();
    return { redraw(next) { if (next) Object.assign(cfg, next); draw(); } };
  };
})();
