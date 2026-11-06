/*
 * Orbit — interface.
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
(function () {
  'use strict';

  const S = window.OrbitStats;
  const I = window.OrbitI18n;
  const content = document.getElementById('content');

  let snap = null;
  let view = 'today';
  let lang = I.pick('auto');
  let t = lang.t;
  let mascotIndex = 0;
  let lastMood = null;

  /* ---------- tiny DOM helper (no innerHTML for data) ---------- */
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'style') Object.assign(node.style, v);
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  const fmt = (s) => S.formatDuration(s);
  const appName = (exe) => (snap.apps[exe] && snap.apps[exe].name) || exe.replace(/\.exe$/i, '');

  function hue(str) {
    let h = 0;
    for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  function appIcon(exe, big) {
    const meta = snap.apps[exe];
    const cls = 'app-icon' + (big ? ' big' : '');
    if (meta && meta.icon && meta.icon.startsWith('data:image/')) {
      return el('img', { class: cls, src: meta.icon, alt: '' });
    }
    const h = hue(exe);
    return el('div', {
      class: cls + ' letter',
      text: appName(exe).charAt(0).toUpperCase(),
      style: { background: `linear-gradient(135deg, hsl(${h} 75% 60%), hsl(${(h + 40) % 360} 70% 50%))` },
    });
  }

  function levelBadge(exe, all) {
    const lv = S.level(all[exe] || 0);
    return el('span', { class: 'lvl', text: `${t.level} ${lv.level}`, title: `${lv.xp} XP` });
  }

  /* ---------- charts ---------- */
  function chart(values, labels, highlight, tip) {
    const max = Math.max(1, ...values);
    return el('div', { class: 'chart' },
      values.map((v, i) =>
        el('div', { class: 'col', title: tip ? tip(i, v) : fmt(v) },
          el('div', {
            class: 'bar' + (v === 0 ? ' dim' : '') + (i === highlight ? ' now' : ''),
            style: { height: `${Math.max(2, (v / max) * 100)}%` },
          }),
          el('div', { class: 'lbl', text: labels[i] || '' })
        )
      )
    );
  }

  /* ---------- ranking ---------- */
  function rankingCard(rank, title) {
    const all = S.allTime(snap.days);
    const list = rank.length
      ? el('div', { class: 'rank' },
          rank.slice(0, 12).map((r, i) =>
            el('div', { class: 'row', onclick: () => go('app:' + r.exe), title: r.exe },
              el('div', { class: 'pos', text: `#${i + 1}` }),
              appIcon(r.exe),
              el('div', { class: 'info' },
                el('div', { class: 'top' }, el('span', { class: 'name', text: appName(r.exe) }), levelBadge(r.exe, all)),
                el('div', { class: 'share' }, el('i', { style: { width: `${Math.max(1, r.share * 100)}%` } }))
              ),
              el('div', null,
                el('div', { class: 'time', text: fmt(r.seconds) }),
                el('div', { class: 'pct', text: `${Math.round(r.share * 100)}%` })
              )
            )
          )
        )
      : el('div', { class: 'empty', text: t.rankingEmpty });
    return el('section', { class: 'card' }, el('h2', { text: title }), list);
  }

  function statCard(label, value, sub, opts) {
    const o = opts || {};
    return el('section', { class: 'card' + (o.hero ? ' hero' : '') },
      el('div', { class: 'stat-label', text: label }),
      o.custom || el('div', { class: 'stat-value' + (o.hero ? ' gradient' : ''), text: value }),
      sub ? el('div', { class: 'stat-sub' + (o.subClass ? ' ' + o.subClass : ''), text: sub }) : null,
      o.extra || null
    );
  }

  function bossCard(rank, label) {
    const top = rank[0];
    if (!top) return statCard(label, '—', null);
    return statCard(label, null, fmt(top.seconds), {
      custom: el('div', { class: 'boss' },
        appIcon(top.exe),
        el('div', { class: 'name' }, el('span', { class: 'crown', text: '♛' }), appName(top.exe))
      ),
    });
  }

  function streakCard() {
    const n = S.streak(snap.days);
    return statCard(t.streak, t.streakDays(n), t.streakHint);
  }

  /* ---------- views ---------- */
  function renderToday() {
    const key = S.dayKey();
    const yKey = S.lastDays(2)[0];
    const total = S.totalsByDay(snap.days, [key])[0];
    const yTotal = S.totalsByDay(snap.days, [yKey])[0];
    const rank = S.ranking(snap.days, [key]);

    let sub = t.noYesterday;
    let subClass = '';
    if (yTotal > 0) {
      const p = Math.round(((total - yTotal) / yTotal) * 100);
      sub = t.vsYesterday(p);
      subClass = p > 0 ? 'up' : 'down';
    }

    const goal = snap.settings.goalHours;
    let goalCard;
    if (goal > 0) {
      const ratio = total / (goal * 3600);
      const diff = Math.abs(goal * 3600 - total);
      goalCard = statCard(t.goal, `${goal}h`, ratio > 1 ? t.goalOver(fmt(diff)) : t.goalLeft(fmt(diff)), {
        subClass: ratio > 1 ? 'up' : '',
        extra: el('div', { class: 'progress' + (ratio > 1 ? ' over' : '') }, el('i', { style: { width: `${Math.min(100, ratio * 100)}%` } })),
      });
    } else {
      goalCard = statCard(t.goal, t.goalOff, t.goalOffHint);
    }

    const hours = S.totalsByHour(snap.days, [key]);
    const nowHour = new Date().getHours();
    const hourLabels = hours.map((_, h) => (h % 3 === 0 ? `${h}h` : ''));

    const ach = S.achievements(snap.days, key);
    const emojis = { marathoner: '🏃', nightOwl: '🦉', earlyBird: '🐣', explorer: '🧭', balanced: '🌸' };
    const badges = ach.length
      ? el('div', { class: 'badges' },
          ach.map((a) => el('div', { class: 'badge' },
            el('div', { class: 'emoji', text: emojis[a] }),
            el('div', null, el('b', { text: t.ach[a][0] }), el('span', { text: t.ach[a][1] }))
          )))
      : el('div', { class: 'empty', text: t.achievementsEmpty });

    const dateText = new Date().toLocaleDateString(lang.code, { weekday: 'long', day: 'numeric', month: 'long' });

    return [
      el('div', { class: 'page-head' },
        el('div', null, el('h1', { text: t.todayTitle }), el('div', { class: 'sub', text: dateText }))
      ),
      el('div', { class: 'grid cards' },
        statCard(t.screenTimeToday, fmt(total), sub, { hero: true, subClass }),
        bossCard(rank, t.bossOfDay),
        streakCard(),
        goalCard
      ),
      el('div', { class: 'grid two' },
        rankingCard(rank, t.ranking),
        el('div', { class: 'grid' },
          el('section', { class: 'card' }, el('h2', { text: t.byHour }),
            chart(hours, hourLabels, nowHour, (i, v) => `${i}h–${i + 1}h · ${fmt(v)}`)),
          el('section', { class: 'card' }, el('h2', { text: t.achievements }), badges)
        )
      ),
    ];
  }

  function renderRange(count) {
    const keys = S.lastDays(count);
    const totals = S.totalsByDay(snap.days, keys);
    const total = totals.reduce((a, b) => a + b, 0);
    const rank = S.ranking(snap.days, keys);
    const labels = keys.map((k, i) => {
      const d = new Date(k + 'T12:00:00');
      if (count <= 7) return d.toLocaleDateString(lang.code, { weekday: 'short' }).replace('.', '');
      return i % 5 === 0 || i === keys.length - 1 ? String(d.getDate()) : '';
    });
    const tip = (i, v) => `${new Date(keys[i] + 'T12:00:00').toLocaleDateString(lang.code, { day: 'numeric', month: 'short' })} · ${fmt(v)}`;

    return [
      el('div', { class: 'page-head' },
        el('div', null, el('h1', { text: count <= 7 ? t.weekTitle : t.monthTitle }))
      ),
      el('div', { class: 'grid cards' },
        statCard(t.screenTimeRange, fmt(total), null, { hero: true }),
        statCard(t.dailyAverage, fmt(total / count), null),
        bossCard(rank, t.bossOfRange),
        streakCard()
      ),
      el('div', { class: 'grid two' },
        rankingCard(rank, t.ranking),
        el('section', { class: 'card' }, el('h2', { text: t.byDay }), chart(totals, labels, keys.length - 1, tip))
      ),
    ];
  }

  function renderApp(exe) {
    const all = S.allTime(snap.days);
    const lv = S.level(all[exe] || 0);
    const keys = S.lastDays(14);
    const totals = S.totalsByDay(snap.days, keys, exe);
    const hours = S.totalsByHour(snap.days, S.lastDays(7), exe);
    const ignored = snap.settings.ignored.includes(exe);
    const labels = keys.map((k) => String(new Date(k + 'T12:00:00').getDate()));

    return [
      el('button', { class: 'back', text: t.back, onclick: () => go(lastMainView) }),
      el('div', { class: 'page-head' },
        el('div', { class: 'detail-head' },
          appIcon(exe, true),
          el('div', null,
            el('h1', { text: appName(exe) }),
            el('div', { class: 'exe', text: `${t.executable}: ${exe}` })
          )
        ),
        el('button', {
          class: 'btn',
          text: ignored ? t.unignoreApp : t.ignoreApp,
          onclick: async () => {
            const list = ignored ? snap.settings.ignored.filter((x) => x !== exe) : [...snap.settings.ignored, exe];
            snap.settings = await window.orbit.saveSettings({ ignored: list });
            render();
          },
        })
      ),
      el('div', { class: 'grid cards' },
        statCard(t.allTime, fmt(all[exe] || 0), null, { hero: true }),
        statCard(`${t.level} ${lv.level}`, `${lv.xp} XP`, null, {
          extra: el('div', { class: 'progress' }, el('i', { style: { width: `${Math.round(lv.progress * 100)}%` } })),
        }),
        statCard(t.todayTitle, fmt(S.totalsByDay(snap.days, [S.dayKey()], exe)[0]), null),
        statCard(t.weekTitle, fmt(S.totalsByDay(snap.days, S.lastDays(7), exe).reduce((a, b) => a + b, 0)), null)
      ),
      el('div', { class: 'grid two' },
        el('section', { class: 'card' }, el('h2', { text: t.last14 }), chart(totals, labels, keys.length - 1)),
        el('section', { class: 'card' }, el('h2', { text: t.hoursLast7 }),
          chart(hours, hours.map((_, h) => (h % 3 === 0 ? `${h}h` : '')), -1, (i, v) => `${i}h · ${fmt(v)}`))
      ),
    ];
  }

  function renderSettings() {
    const s = snap.settings;
    const toast = el('span', { class: 'toast' });
    const flash = (msg) => { toast.textContent = msg; setTimeout(() => { toast.textContent = ''; }, 2500); };

    const langSel = el('select', { id: 'f-lang' },
      el('option', { value: 'auto', text: t.langAuto }),
      el('option', { value: 'pt-BR', text: 'Português (Brasil)' }),
      el('option', { value: 'en', text: 'English' })
    );
    langSel.value = s.language;

    const themeSel = el('select', { id: 'f-theme' },
      el('option', { value: 'dark', text: t.themeDark }),
      el('option', { value: 'light', text: t.themeLight }),
      el('option', { value: 'pink', text: t.themePink })
    );
    themeSel.value = s.theme;
    themeSel.addEventListener('change', () => { document.documentElement.dataset.theme = themeSel.value; });

    const idle = el('input', { type: 'number', min: '0', max: '120', step: '1', value: String(s.idleMinutes) });
    const goal = el('input', { type: 'number', min: '0', max: '24', step: '0.5', value: String(s.goalHours) });
    const auto = el('input', { type: 'checkbox' });
    auto.checked = !!s.autoStart;
    const ign = el('textarea', { spellcheck: 'false' });
    ign.value = s.ignored.join('\n');

    async function save() {
      snap.settings = await window.orbit.saveSettings({
        language: langSel.value,
        theme: themeSel.value,
        idleMinutes: Number(idle.value) || 0,
        goalHours: Number(goal.value) || 0,
        autoStart: auto.checked,
        ignored: ign.value.split(/[\r\n,;]+/),
      });
      applyLanguageAndTheme();
      render();
      const newToast = content.querySelector('.toast');
      if (newToast) { newToast.textContent = t.saved; setTimeout(() => { newToast.textContent = ''; }, 2500); }
    }

    return [
      el('div', { class: 'page-head' }, el('h1', { text: t.settingsTitle })),
      el('div', { class: 'settings' },
        el('section', { class: 'card' }, el('h2', { text: t.secAppearance }),
          el('div', { class: 'field' }, el('label', { text: t.language }), langSel),
          el('div', { class: 'field' }, el('label', { text: t.theme }), themeSel)
        ),
        el('section', { class: 'card' }, el('h2', { text: t.secTracking }),
          el('div', { class: 'field' }, el('label', { text: t.idle }), idle, el('div', { class: 'hint', text: t.idleHint })),
          el('div', { class: 'field' }, el('label', { text: t.goalHours }), goal, el('div', { class: 'hint', text: t.goalHint })),
          el('div', { class: 'field' },
            el('label', { class: 'check' }, auto, t.autoStart),
            el('div', { class: 'hint', text: `${t.autoStartHint} ${t.trayHint}` })
          ),
          el('div', { class: 'field' }, el('label', { text: t.ignored }), ign, el('div', { class: 'hint', text: t.ignoredHint }))
        ),
        el('div', { class: 'actions' }, el('button', { class: 'btn primary', text: t.save, onclick: save }), toast),
        el('section', { class: 'card' }, el('h2', { text: t.secData }),
          el('div', { class: 'field' }, el('div', { class: 'hint', text: t.dataHint })),
          el('div', { class: 'actions' },
            el('button', { class: 'btn', text: t.exportCsv, onclick: async () => { if (await window.orbit.exportCsv()) flash(t.exported); } }),
            el('button', { class: 'btn', text: t.openFolder, onclick: () => window.orbit.openDataFolder() }),
            el('button', { class: 'btn danger', text: t.clearHistory, onclick: async () => {
              if (await window.orbit.clearHistory()) { await refresh(); flash(t.cleared); }
            } })
          )
        ),
        el('section', { class: 'card' }, el('h2', { text: t.secAbout }),
          el('div', { class: 'field' }, el('div', { class: 'hint', text: t.about(snap.version) })),
          el('div', { class: 'actions' }, el('button', { class: 'btn', text: t.openRepo, onclick: () => window.orbit.openRepo() }))
        )
      ),
    ];
  }

  /* ---------- sidebar: mascot + status ---------- */
  function renderSidebar() {
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t[n.dataset.i18n]; });
    document.querySelectorAll('#nav button').forEach((b) => {
      const v = view.startsWith('app:') ? lastMainView : view;
      b.classList.toggle('active', b.dataset.view === v);
    });

    const total = S.totalsByDay(snap.days, [S.dayKey()])[0];
    const mood = S.mood(total, snap.settings.goalHours);
    const box = document.getElementById('mascot');
    if (mood !== lastMood) {
      box.innerHTML = window.OrbitMascot.svg(mood); // trusted static markup
      lastMood = mood;
    }
    const lines = t.mascot[mood];
    document.getElementById('bubble').textContent = lines[mascotIndex % lines.length];

    const st = snap.status || {};
    const status = document.getElementById('status');
    let text = t.statusPaused;
    let cls = 'status';
    if (st.error) text = t.statusError;
    else if (st.locked) text = t.statusLocked;
    else if (st.idle) { text = t.statusIdle; cls += ' idle'; }
    else if (st.tracking && st.fullscreen) { text = t.statusFullscreen; cls += ' on'; }
    else if (st.tracking) { text = t.statusTracking; cls += ' on'; }
    status.className = cls;
    document.getElementById('status-text').textContent = text;
  }

  /* ---------- routing ---------- */
  let lastMainView = 'today';

  function render() {
    if (!snap) return;
    renderSidebar();
    let nodes;
    if (view === 'today') nodes = renderToday();
    else if (view === 'week') nodes = renderRange(7);
    else if (view === 'month') nodes = renderRange(30);
    else if (view === 'settings') nodes = renderSettings();
    else if (view.startsWith('app:')) nodes = renderApp(view.slice(4));
    const scroll = content.scrollTop;
    content.replaceChildren(...nodes);
    content.scrollTop = scroll;
  }

  function go(v) {
    if (!v.startsWith('app:')) lastMainView = v;
    view = v;
    content.scrollTop = 0;
    render();
  }

  function applyLanguageAndTheme() {
    lang = I.pick(snap.settings.language, snap.locale);
    t = lang.t;
    document.documentElement.lang = lang.code;
    document.documentElement.dataset.theme = snap.settings.theme;
  }

  async function refresh(keepLook) {
    snap = await window.orbit.snapshot();
    if (!keepLook) applyLanguageAndTheme();
  }

  /* ---------- petals ---------- */
  function petals() {
    const box = document.getElementById('petals');
    for (let i = 0; i < 16; i++) {
      const p = el('div', { class: 'petal' });
      Object.assign(p.style, {
        left: `${Math.random() * 100}%`,
        animationDuration: `${12 + Math.random() * 14}s`,
        animationDelay: `${-Math.random() * 20}s`,
        width: `${8 + Math.random() * 8}px`,
        height: `${6 + Math.random() * 6}px`,
      });
      box.appendChild(p);
    }
  }

  /* ---------- start ---------- */
  document.getElementById('nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) go(b.dataset.view);
  });
  document.getElementById('mascot').addEventListener('click', () => { mascotIndex++; renderSidebar(); });

  window.orbit.onDemo(async ({ view: v }) => {
    await refresh();
    lastMood = null;
    mascotIndex = 0;
    go(v);
  });

  petals();
  refresh().then(() => go('today'));

  // Live update. The settings page only refreshes the sidebar so the form is not reset while typing.
  setInterval(async () => {
    if (view === 'settings') {
      const before = snap && snap.settings;
      await refresh(true);
      if (before) snap.settings = before;
      renderSidebar();
    } else {
      await refresh();
      render();
    }
  }, 2000);
  setInterval(() => { mascotIndex++; if (snap) renderSidebar(); }, 30000);
})();
