(() => {
  const STORAGE = 'arbeitszeiten-app-prototype-v7-clean-no-demo';
  const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
  const fmtDay = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
  const fmtShortMonth = new Intl.DateTimeFormat('de-DE', { month: 'short' });

  const defaultState = () => {
    const today = new Date();
    return ({
    selectedYear: today.getFullYear(),
    selectedMonth: today.getMonth(),
    settings: {
      monthlyHours: 0,
      calcMode: 'workdays',
      yearVacation: 0,
      workdays: [1,2,3,4,5],
      startBalanceMinutes: 0,
      startBalanceMonth: monthKey(today.getFullYear(), today.getMonth()),
      dailyTargetMode: 'auto',
      fixedDailyTargetHours: 0,
      timeDisplayMode: 'both'
    },
    workEntries: [],
    sickDays: [],
    vacations: []
  });
  };

  let state = load();
  migrate();

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE);
      return raw ? JSON.parse(raw) : defaultState();
    } catch { return defaultState(); }
  }
  function migrate() {
    state.settings ||= {};
    state.settings.workdays ||= [1,2,3,4,5];
    state.settings.startBalanceMinutes ??= 0;
    state.settings.startBalanceMonth ||= `${state.selectedYear}-${pad(state.selectedMonth+1)}`;
    state.settings.dailyTargetMode ||= 'auto';
    state.settings.timeDisplayMode ||= 'both';
    if (state.settings.fixedDailyTargetHours == null) {
      state.settings.fixedDailyTargetHours = state.settings.fixedDailyTargetMinutes ? Number(state.settings.fixedDailyTargetMinutes) / 60 : 0;
    }
    state.sickDays ||= [];
  }
  function save() { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2,'0'); }
  function dateStr(y,m,d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
  function monthKey(y,m) { return `${y}-${pad(m+1)}`; }
  function toDate(str) { const [y,m,d] = str.split('-').map(Number); return new Date(y, m-1, d); }
  function daysInMonth(y,m) { return new Date(y, m+1, 0).getDate(); }
  function minutesToText(min) {
    const sign = min < 0 ? '-' : '';
    const abs = Math.abs(Math.round(min));
    return sign + Math.floor(abs/60) + ':' + pad(abs % 60);
  }
  function parseHours(str) {
    // Allgemeine Stundeneingabe: Dezimalzahlen sind Dezimalstunden, HH:MM bleibt Stunden:Minuten.
    if (!str) return 0;
    str = String(str).trim().replace(',', '.');
    let sign = 1;
    if (str.startsWith('-')) { sign = -1; str = str.slice(1); }
    if (str.startsWith('+')) str = str.slice(1);
    if (str.includes(':')) {
      const [h, m='0'] = str.split(':');
      return sign * Math.round(Number(h || 0) * 60 + Number(m || 0));
    }
    return sign * Math.round(Number(str || 0) * 60);
  }
  function parseDecimalHours(str) {
    // Für den abweichenden Tagessoll: 2,32 bedeutet 2.32 Dezimalstunden, nicht 2:32.
    if (!str) return 0;
    const cleaned = String(str).trim().replace(',', '.');
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : 0;
  }
  function decimalHoursToMinutes(hours) {
    // Wichtig: NICHT pro Tag runden.
    // 2,32 Dezimalstunden = 139,2 Minuten.
    // Bei 4 Tagen: 139,2 × 4 = 556,8 Minuten = 9,28 Dezimalstunden ≈ 9:17.
    // Würde man jeden Tag vorher auf 139 Minuten runden, käme fälschlich 9:16 heraus.
    return Number(hours || 0) * 60;
  }
  function decimalHoursLabel(hours) {
    return Number(hours || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function minutesToDecimalLabel(minutes) {
    return (Number(minutes || 0) / 60).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatDuration(minutes, forceSign = false) {
    const value = Number(minutes || 0);
    const sign = forceSign && value > 0 ? '+' : '';
    const mode = state.settings.timeDisplayMode || 'both';
    const hoursText = minutesToText(value);
    const decimalText = `${minutesToDecimalLabel(value)} h`;
    if (mode === 'decimal') return sign + decimalText;
    if (mode === 'both') return sign + `${hoursText} / ${decimalText}`;
    return sign + hoursText;
  }
  function timeToMinutes(value) {
    if (!value) return null;
    const [h, m] = value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  }
  function calcTimeRangeMinutes(start, end, pause = 0) {
    const startMin = timeToMinutes(start), endMin = timeToMinutes(end);
    if (startMin === null || endMin === null) return 0;
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    return Math.max(0, diff - Number(pause || 0));
  }
  function updateTimePreview() {
    $('calculatedWorkTime').textContent = formatDuration(calcTimeRangeMinutes($('startTime').value, $('endTime').value, $('pauseMinutes').value));
  }
  function updateEntryMode() {
    const daily = $('workType').value === 'daily';
    $('timeFields').style.display = daily ? 'block' : 'none';
    $('hoursField').style.display = daily ? 'none' : 'block';
  }
  function sameMonth(dateString, y, m) {
    const d = toDate(dateString);
    return d.getFullYear() === y && d.getMonth() === m;
  }
  function isWorkday(date) { return state.settings.workdays.includes(date.getDay()); }
  function calcDays(y,m) {
    const all = daysInMonth(y,m);
    if (state.settings.calcMode === 'calendar') return all;
    let count = 0;
    for (let d=1; d<=all; d++) if (isWorkday(new Date(y,m,d))) count++;
    return count || all;
  }
  function requiredForDate(date) {
    if (state.settings.calcMode === 'workdays' && !isWorkday(date)) return 0;

    // Der feste/abweichende Tagessoll bleibt unverändert:
    // Dezimalstunden werden direkt in Minuten umgerechnet.
    if (state.settings.dailyTargetMode === 'fixed') {
      return decimalHoursToMinutes(state.settings.fixedDailyTargetHours);
    }

    // Automatischer Modus: Die gesamten Monatsminuten werden verlustfrei
    // auf die relevanten Tage verteilt. Dadurch bleibt z. B. ein Soll von
    // 60 Stunden immer exakt 60:00 und wird nicht durch tägliche Rundung 59:51.
    const y = date.getFullYear();
    const m = date.getMonth();
    const totalMinutes = Math.round(Number(state.settings.monthlyHours || 0) * 60);
    const relevantDates = [];
    for (let day = 1; day <= daysInMonth(y, m); day++) {
      const current = new Date(y, m, day);
      if (state.settings.calcMode === 'calendar' || isWorkday(current)) relevantDates.push(day);
    }
    if (!relevantDates.length) return 0;

    const index = relevantDates.indexOf(date.getDate());
    if (index < 0) return 0;

    const baseMinutes = Math.floor(totalMinutes / relevantDates.length);
    const remainderMinutes = totalMinutes - baseMinutes * relevantDates.length;
    return baseMinutes + (index < remainderMinutes ? 1 : 0);
  }
  function weekRange(date) {
    const d = new Date(date);
    const day = d.getDay() || 7;
    const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
    return [monday, sunday];
  }
  function inRange(dateString, start, end) {
    const d = toDate(dateString), s = toDate(start), e = toDate(end);
    return d >= s && d <= e;
  }
  function vacationOnDate(dateString) {
    return state.vacations.find(v => inRange(dateString, v.start, v.end));
  }
  function sickOnDate(dateString) {
    return state.sickDays.find(v => inRange(dateString, v.start, v.end));
  }
  function automaticCreditOnDate(dateString) {
    const date = toDate(dateString);
    const req = requiredForDate(date);
    if (!req) return 0;
    // Krankheit und Urlaub werden nur an den eingestellten Arbeitstagen gutgeschrieben.
    // Beispiel 6-Tage-Woche Mo-Sa: Sonntag zählt nicht als Urlaubs-/Krankheitstag.
    if (!isWorkday(date)) return 0;
    if (sickOnDate(dateString)) return req;
    if (vacationOnDate(dateString)) return req;
    return 0;
  }
  function workedOnDate(dateString, y = state.selectedYear, m = state.selectedMonth) {
    const date = toDate(dateString);
    let total = automaticCreditOnDate(dateString);
    for (const e of state.workEntries) {
      if (e.type === 'daily' && e.date === dateString) total += e.minutes;
      if (e.type === 'weekly') {
        const [a,b] = weekRange(toDate(e.date));
        if (date >= a && date <= b) {
          const days = [...Array(7)].map((_,i)=>{ const x=new Date(a); x.setDate(a.getDate()+i); return x; })
            .filter(x => x.getMonth() === m && (state.settings.calcMode === 'calendar' || isWorkday(x)));
          total += Math.round(e.minutes / Math.max(1, days.length));
        }
      }
      if (e.type === 'monthly' && sameMonth(e.date, y, m)) {
        total += Math.round(e.minutes / calcDays(y, m));
      }
    }
    return total;
  }
  function monthWorked(y,m) {
    let total = 0;
    const dim = daysInMonth(y,m);
    for (let d=1; d<=dim; d++) total += workedOnDate(dateStr(y,m,d), y, m);
    return total;
  }
  function monthRequired(y,m) {
    // Im automatischen Modus ist das Monatssoll exakt der eingegebene Wert.
    // Im festen Tagessoll-Modus bleibt die bisherige Rechnung unverändert.
    if (state.settings.dailyTargetMode !== 'fixed') {
      return Math.round(Number(state.settings.monthlyHours || 0) * 60);
    }
    let total = 0;
    for (let d=1; d<=daysInMonth(y,m); d++) total += requiredForDate(new Date(y,m,d));
    return total;
  }
  function monthDiff(y,m) { return monthWorked(y,m) - monthRequired(y,m); }
  function accountBalanceUntil(y,m) {
    const start = state.settings.startBalanceMonth || monthKey(y,m);
    let [sy, sm] = start.split('-').map(Number); sm -= 1;
    let total = Number(state.settings.startBalanceMinutes || 0);
    const cur = new Date(sy, sm, 1);
    const end = new Date(y, m, 1);
    while (cur <= end) {
      total += monthDiff(cur.getFullYear(), cur.getMonth());
      cur.setMonth(cur.getMonth()+1);
      if (cur.getFullYear() > y+3) break;
    }
    return total;
  }
  function vacationDaysBetween(start, end) {
    if (!start || !end) return 0;
    let s = toDate(start), e = toDate(end), count = 0;
    if (e < s) [s,e] = [e,s];
    const cur = new Date(s);
    while (cur <= e) {
      // Urlaubstage werden immer nach den eingestellten Arbeitstagen gezählt,
      // nicht nach Kalendertagen. Bei 6-Tage-Woche Mo-Sa fallen Sonntage heraus.
      if (isWorkday(cur)) count++;
      cur.setDate(cur.getDate()+1);
    }
    return count;
  }
  function summary() {
    const y = state.selectedYear, m = state.selectedMonth;
    const required = monthRequired(y,m);
    const worked = monthWorked(y,m);
    const diff = worked - required;
    const dim = daysInMonth(y,m);
    const today = new Date();
    let remainingCalcDays = 0;
    for (let d=1; d<=dim; d++) {
      const dt = new Date(y,m,d), ds = dateStr(y,m,d);
      const isFutureOrToday = dt >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) || y !== today.getFullYear() || m !== today.getMonth();
      if (isFutureOrToday && (state.settings.calcMode === 'calendar' || isWorkday(dt)) && !vacationOnDate(ds) && !sickOnDate(ds)) remainingCalcDays++;
    }
    const remaining = Math.max(0, required - worked);
    const normalDaily = state.settings.dailyTargetMode === 'fixed' ? decimalHoursToMinutes(state.settings.fixedDailyTargetHours) : Math.round(state.settings.monthlyHours * 60 / calcDays(y,m));
    return { required, worked, diff, remaining, account: accountBalanceUntil(y,m), daily: normalDaily, remainingDaily: Math.round(remaining / Math.max(1, remainingCalcDays)) };
  }
  function toast(msg='Gespeichert') {
    $('toast').textContent = msg;
    $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 1500);
  }
  function escapeHtml(str='') { return String(str).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function render() {
    const y = state.selectedYear, m = state.selectedMonth, s = summary();
    $('monthLabel').textContent = fmtMonth.format(new Date(y,m,1));
    $('mRequired').textContent = formatDuration(s.required);
    $('mWorked').textContent = formatDuration(s.worked);
    $('mDaily').textContent = state.settings.dailyTargetMode === 'fixed' ? `${formatDuration(s.daily)} · fester Dezimalwert ${decimalHoursLabel(state.settings.fixedDailyTargetHours)} h` : formatDuration(s.daily);
    $('mDiff').textContent = formatDuration(s.diff, true);
    $('mDiff').className = 'value ' + (s.diff >= 0 ? 'positive' : 'negative');
    $('mAccount').textContent = `Zeitkonto: ${formatDuration(s.account, true)}`;
    $('mAccount').className = 'row-sub ' + (s.account >= 0 ? 'positive' : 'negative');
    $('dashRemaining').textContent = s.diff >= 0
      ? formatDuration(s.diff, true)
      : formatDuration(s.remaining);
    $('dashRemainingLabel').textContent = s.diff >= 0 ? 'Überstunden in diesem Monat' : 'Restbedarf in diesem Monat';
    const pct = Math.min(100, Math.round((s.worked / Math.max(1, s.required))*100));
    $('dashProgress').style.width = pct + '%';
    $('dashProgressText').textContent = `${pct} % erfüllt · ${formatDuration(s.worked)} von ${formatDuration(s.required)}`;
    $('daysCount').textContent = daysInMonth(y,m);
    $('remainingDaily').textContent = formatDuration(s.remainingDaily);
    $('vacDaysMonth').textContent = countMonthMarkedDays(y,m,'vacation');
    renderQuickList(s);
    renderWorkEntries();
    renderSickList();
    renderMonthOverview();
    renderVacations();
    renderSettings();
  }
  function countMonthMarkedDays(y,m,type) {
    let count = 0;
    for (let d=1; d<=daysInMonth(y,m); d++) {
      const dt = new Date(y,m,d);
      if (!isWorkday(dt)) continue;
      const ds = dateStr(y,m,d);
      if (type === 'vacation' && vacationOnDate(ds)) count++;
      if (type === 'sick' && sickOnDate(ds)) count++;
    }
    return count;
  }
  function renderQuickList(s) {
    const items = [
      ['Berechnung', state.settings.calcMode === 'calendar' ? 'Kalendertage' : 'Arbeitstage'],
      ['Automatisch angerechnet', `${countMonthMarkedDays(state.selectedYear,state.selectedMonth,'vacation')} Urlaubstage · ${countMonthMarkedDays(state.selectedYear,state.selectedMonth,'sick')} Krankheitstage`],
      ['Tagessoll-Modus', state.settings.dailyTargetMode === 'fixed' ? `Abweichender Tagessoll: ${decimalHoursLabel(state.settings.fixedDailyTargetHours)} Dezimalstunden · Anzeige ${formatDuration(decimalHoursToMinutes(state.settings.fixedDailyTargetHours))}` : 'Automatisch aus Monatsstunden'],
      ['Startsaldo', `${formatDuration(state.settings.startBalanceMinutes, true)} ab ${state.settings.startBalanceMonth}`],
      ['Zeitkonto bis Monatsende', `${formatDuration(s.account, true)}`],
    ];
    $('quickList').innerHTML = items.map(([a,b]) => `<div class="row"><div><div class="row-title">${a}</div><div class="row-sub">${b}</div></div><span class="chip blue">Info</span></div>`).join('');
  }
  function renderWorkEntries() {
    const y = state.selectedYear, m = state.selectedMonth;
    const entries = state.workEntries.filter(e => sameMonth(e.date, y, m) || e.type !== 'daily').filter(e => e.type !== 'monthly' || sameMonth(e.date, y, m));
    if (!entries.length) { $('workEntriesList').innerHTML = '<div class="empty">Noch keine Arbeitszeiten im Monat.</div>'; return; }
    $('workEntriesList').innerHTML = entries.map(e => {
      const type = e.type === 'daily' ? 'Täglich' : e.type === 'weekly' ? 'Wöchentlich' : 'Monatlich';
      const timeInfo = e.type === 'daily' && e.startTime && e.endTime
        ? ` · ${e.startTime}–${e.endTime}${Number(e.pauseMinutes || 0) ? ` · Pause ${e.pauseMinutes} Min.` : ''}` : '';
      return `<div class="row"><div><div class="row-title">${type} · ${formatDuration(e.minutes)}</div><div class="row-sub">${fmtDay.format(toDate(e.date))}${timeInfo}${e.note ? ' · '+escapeHtml(e.note) : ''}</div></div><button class="danger small" data-del-work="${e.id}">Löschen</button></div>`;
    }).join('');
    document.querySelectorAll('[data-del-work]').forEach(btn => btn.onclick = () => { state.workEntries = state.workEntries.filter(e => e.id !== btn.dataset.delWork); save(); render(); });
  }
  function renderSickList() {
    const y = state.selectedYear, m = state.selectedMonth;
    const entries = state.sickDays.filter(e => {
      for (let d=1; d<=daysInMonth(y,m); d++) if (inRange(dateStr(y,m,d), e.start, e.end)) return true;
      return false;
    });
    if (!entries.length) { $('sickList').innerHTML = '<div class="empty">Keine Krankheitstage im Monat.</div>'; return; }
    $('sickList').innerHTML = entries.map(e => `<div class="row"><div><div class="row-title">Krankheit · ${vacationDaysBetween(e.start,e.end)} Tag(e)</div><div class="row-sub">${fmtDay.format(toDate(e.start))} – ${fmtDay.format(toDate(e.end))}${e.note ? ' · '+escapeHtml(e.note) : ''}</div></div><button class="danger small" data-del-sick="${e.id}">Löschen</button></div>`).join('');
    document.querySelectorAll('[data-del-sick]').forEach(btn => btn.onclick = () => { state.sickDays = state.sickDays.filter(e => e.id !== btn.dataset.delSick); save(); render(); });
  }
  function hasManualDailyWork(dateString) {
    return state.workEntries.some(e => e.type === 'daily' && e.date === dateString && Number(e.minutes || 0) > 0);
  }
  function dayOverview(y, m, d) {
    const date = new Date(y,m,d), ds = dateStr(y,m,d);
    const req = requiredForDate(date);
    const worked = workedOnDate(ds, y, m);
    const vac = vacationOnDate(ds), sick = sickOnDate(ds);
    const isFree = req === 0;
    let status = 'open';
    let label = 'Noch zu arbeiten';
    let chip = '<span class="chip blue">Offen</span>';
    if (isFree) { status = 'free'; label = 'Frei'; chip = '<span class="chip blue">Frei</span>'; }
    if (hasManualDailyWork(ds) || (!sick && !vac && worked > 0)) {
      status = 'worked'; label = 'Gearbeitet'; chip = '<span class="chip green">Gearbeitet</span>';
    }
    if (vac) {
      status = 'vacation'; label = vac.status === 'approved' ? 'Urlaub genehmigt' : 'Urlaub beantragt';
      chip = `<span class="chip ${vac.status === 'approved' ? 'green' : 'yellow'}">Urlaub</span>`;
    }
    if (sick) { status = 'sick'; label = 'Krank'; chip = '<span class="chip red">Krank</span>'; }
    return { date, ds, req, worked, diff: worked - req, status, label, chip, isFree };
  }
  function monthDayStats(y, m) {
    const stats = { worked:0, vacation:0, sick:0, open:0 };
    for (let d=1; d<=daysInMonth(y,m); d++) {
      const day = dayOverview(y,m,d);
      if (day.status === 'worked') stats.worked++;
      if (!day.isFree && day.status === 'vacation') stats.vacation++;
      if (!day.isFree && day.status === 'sick') stats.sick++;
      if (!day.isFree && day.status === 'open') stats.open++;
    }
    return stats;
  }
  function renderMonthOverview() {
    const y = state.selectedYear, m = state.selectedMonth;
    const list = $('monthDayList');
    if (!list) return;
    const stats = monthDayStats(y,m);
    $('workedDaysCount').textContent = stats.worked;
    $('sickDaysCount').textContent = stats.sick;
    $('vacDaysMonth').textContent = stats.vacation;
    $('openWorkDaysCount').textContent = stats.open;
    const today = new Date();
    const todayString = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
    const html = [];
    for (let d=1; d<=daysInMonth(y,m); d++) {
      const day = dayOverview(y,m,d);
      html.push(`<div class="day-row ${day.status}${day.ds === todayString ? ' today' : ''}" title="${escapeHtml(day.label)}">
        <div class="day-date">
          <div class="day-number">${d}</div>
          <div><div class="day-weekday">${fmtWeekday.format(day.date)}</div><div class="day-month">${fmtShortMonth.format(day.date)} ${y}</div></div>
        </div>
        <div class="day-status">${day.chip}</div>
        <div class="day-times">
          <div class="day-time">Soll<strong>${formatDuration(day.req)}</strong></div>
          <div class="day-time">Ist<strong>${formatDuration(day.worked)}</strong></div>
          <div class="day-time">Differenz<strong class="${day.diff>=0?'positive':'negative'}">${day.req || day.worked ? formatDuration(day.diff, true) : '–'}</strong></div>
        </div>
      </div>`);
    }
    list.innerHTML = html.join('');
  }

  function renderVacations() {
    const approved = state.vacations
      .filter(v => v.status === 'approved')
      .reduce((a,v)=>a+vacationDaysBetween(v.start, v.end),0);
    $('yearVac').textContent = state.settings.yearVacation;
    $('approvedVac').textContent = approved;
    $('remainingVac').textContent = Math.max(0, state.settings.yearVacation - approved);
    const future = state.vacations.slice().sort((a,b)=>toDate(a.start)-toDate(b.start));
    const next = future.find(v => toDate(v.end) >= new Date(new Date().toDateString()));
    $('nextVacationBox').innerHTML = next ? `<div class="row"><div><div class="row-title">${escapeHtml(next.title)}</div><div class="row-sub">${fmtDay.format(toDate(next.start))} – ${fmtDay.format(toDate(next.end))} · ${vacationDaysBetween(next.start,next.end)} Urlaubstage nach Arbeitstage-Regel</div></div><span class="chip ${next.status==='approved'?'green':'yellow'}">${next.status==='approved'?'Genehmigt':'Beantragt'}</span></div>` : '<div class="empty">Kein kommender Urlaub eingetragen.</div>';
    if (!state.vacations.length) { $('vacationList').innerHTML = '<div class="empty">Noch kein Urlaub eingetragen.</div>'; return; }
    $('vacationList').innerHTML = future.map(v => {
      const calcDays = vacationDaysBetween(v.start, v.end);
      const storedHint = Number(v.days||0) !== calcDays ? `<br><span class="muted">Hinweis: gespeichert war ${v.days} Tage, aktuell nach Arbeitstage-Regel ${calcDays} Tage.</span>` : '';
      return `<div class="row"><div><div class="row-title">${escapeHtml(v.title)} · ${calcDays} Tage</div><div class="row-sub">${fmtDay.format(toDate(v.start))} – ${fmtDay.format(toDate(v.end))}${v.note ? ' · '+escapeHtml(v.note):''}<br>Urlaubstage werden nach den eingestellten Arbeitstagen gezählt und automatisch als Sollzeit angerechnet.${storedHint}</div></div><div style="display:flex;gap:8px;align-items:center"><span class="chip ${v.status==='approved'?'green':'yellow'}">${v.status==='approved'?'Genehmigt':'Beantragt'}</span><button class="danger small" data-del-vac="${v.id}">×</button></div></div>`;
    }).join('');
    document.querySelectorAll('[data-del-vac]').forEach(btn => btn.onclick = () => { state.vacations = state.vacations.filter(v => v.id !== btn.dataset.delVac); save(); render(); });
  }
  function updateFixedDailyPreview() {
    const el = $('fixedDailyPreview');
    if (!el) return;
    const value = parseDecimalHours($('setFixedDailyTarget')?.value || state.settings.fixedDailyTargetHours || 0);
    if (!value) { el.textContent = ''; return; }
    const perDayMinutes = decimalHoursToMinutes(value);
    el.textContent = `Vorschau: ${decimalHoursLabel(value)} Dezimalstunden pro Tag. Je nach Anzeigeeinstellung erscheint das als ${formatDuration(perDayMinutes)}. Für 4 Tage rechnet die App intern ${decimalHoursLabel(value * 4)} Dezimalstunden und zeigt ${formatDuration(perDayMinutes * 4)} an.`;
  }

  function renderSettings() {
    $('setMonthlyHours').value = state.settings.monthlyHours;
    $('setCalcMode').value = state.settings.calcMode;
    $('setYearVacation').value = state.settings.yearVacation;
    $('setStartBalance').value = (state.settings.startBalanceMinutes >= 0 ? '+' : '') + minutesToText(state.settings.startBalanceMinutes);
    $('setStartBalanceMonth').value = state.settings.startBalanceMonth;
    $('setDailyTargetMode').value = state.settings.dailyTargetMode || 'auto';
    $('setTimeDisplayMode').value = state.settings.timeDisplayMode || 'both';
    $('setFixedDailyTarget').value = state.settings.fixedDailyTargetHours ? String(state.settings.fixedDailyTargetHours).replace('.', ',') : ''; updateFixedDailyPreview();
    document.querySelectorAll('.wd').forEach(cb => cb.checked = state.settings.workdays.includes(Number(cb.value)));
  }

  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active'); $(btn.dataset.tab).classList.add('active');
  }));
  $('prevMonth').onclick = () => { state.selectedMonth--; if (state.selectedMonth < 0) { state.selectedMonth = 11; state.selectedYear--; } save(); render(); };
  $('nextMonth').onclick = () => { state.selectedMonth++; if (state.selectedMonth > 11) { state.selectedMonth = 0; state.selectedYear++; } save(); render(); };
  $('workType').onchange = () => { updateEntryMode(); updateTimePreview(); };
  $('setFixedDailyTarget').addEventListener('input', updateFixedDailyPreview);
  ['startTime','endTime','pauseMinutes'].forEach(id => $(id).addEventListener('input', updateTimePreview));
  document.querySelectorAll('.time-pill').forEach(btn => btn.addEventListener('click', () => {
    const wrap = btn.closest('.quick-times');
    const target = wrap?.dataset.timeTarget;
    if (!target) return;
    if (btn.dataset.time) $(target).value = btn.dataset.time;
    if (btn.dataset.pause) $(target).value = btn.dataset.pause;
    updateTimePreview();
  }));
  $('fillToday').onclick = () => {
    const d = new Date(); $('workDate').value = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
    $('workType').value = 'daily'; $('startTime').value = '08:00'; $('endTime').value = '12:00'; $('pauseMinutes').value = '0';
    updateEntryMode(); updateTimePreview();
  };
  $('addWork').onclick = () => {
    let date = $('workDate').value || dateStr(state.selectedYear, state.selectedMonth, 1);
    const type = $('workType').value;
    if (type === 'monthly') date = dateStr(state.selectedYear, state.selectedMonth, 1);
    const entry = { id: uid(), type, date, minutes: 0, note: $('workNote').value.trim() };
    let minutes = 0;
    if (type === 'daily') {
      minutes = calcTimeRangeMinutes($('startTime').value, $('endTime').value, $('pauseMinutes').value);
      if (!minutes) return toast('Bitte Start- und Endzeit eintragen');
      entry.startTime = $('startTime').value; entry.endTime = $('endTime').value; entry.pauseMinutes = Number($('pauseMinutes').value || 0);
    } else {
      minutes = parseHours($('workHours').value); if (!minutes) return toast('Bitte Stunden eintragen');
    }
    entry.minutes = minutes; state.workEntries.push(entry);
    $('workHours').value = ''; $('workNote').value = ''; save(); render(); updateTimePreview(); toast('Arbeitszeit gespeichert');
  };
  $('sickToday').onclick = () => { const d = new Date(); const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate()); $('sickStart').value = ds; $('sickEnd').value = ds; };
  $('addSick').onclick = () => {
    let start = $('sickStart').value, end = $('sickEnd').value || start;
    if (!start) return toast('Bitte Krankheitsdatum wählen');
    if (toDate(end) < toDate(start)) [start,end] = [end,start];
    state.sickDays.push({ id: uid(), start, end, note: $('sickNote').value.trim() });
    $('sickNote').value = ''; save(); render(); toast('Krankheit gespeichert');
  };
  $('calcVacDays').onclick = () => { $('vacDays').value = vacationDaysBetween($('vacStart').value, $('vacEnd').value); };
  $('addVacation').onclick = () => {
    const title = $('vacTitle').value.trim() || 'Urlaub'; const start = $('vacStart').value, end = $('vacEnd').value;
    if (!start || !end) return toast('Bitte Zeitraum wählen');
    const days = vacationDaysBetween(start,end);
    $('vacDays').value = days;
    state.vacations.push({ id: uid(), title, start, end, days, status: $('vacStatus').value, note: $('vacNote').value.trim() });
    $('vacTitle').value = ''; $('vacStart').value = ''; $('vacEnd').value = ''; $('vacDays').value = ''; $('vacNote').value = '';
    save(); render(); toast('Urlaub gespeichert und als Sollzeit angerechnet');
  };
  $('saveSettings').onclick = () => {
    const wds = [...document.querySelectorAll('.wd:checked')].map(cb => Number(cb.value));
    state.settings.monthlyHours = Number($('setMonthlyHours').value || 0);
    state.settings.calcMode = $('setCalcMode').value;
    state.settings.yearVacation = Number($('setYearVacation').value || 0);
    state.settings.startBalanceMinutes = parseHours($('setStartBalance').value);
    state.settings.startBalanceMonth = $('setStartBalanceMonth').value || monthKey(state.selectedYear,state.selectedMonth);
    state.settings.dailyTargetMode = $('setDailyTargetMode').value;
    state.settings.timeDisplayMode = $('setTimeDisplayMode').value;
    state.settings.fixedDailyTargetHours = parseDecimalHours($('setFixedDailyTarget').value);
    state.settings.workdays = wds.length ? wds : [1,2,3,4,5];
    save(); render(); toast('Einstellungen gespeichert');
  };
  $('resetDemo').onclick = () => { state = defaultState(); save(); render(); toast('Leerer Startzustand wiederhergestellt'); };
  $('clearAll').onclick = () => { if (confirm('Wirklich alle lokalen Daten löschen?')) { localStorage.removeItem(STORAGE); state = defaultState(); save(); render(); toast('Daten gelöscht'); } };

  const today = new Date();
  $('workDate').value = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  $('startTime').value = '08:00'; $('endTime').value = '12:00'; $('pauseMinutes').value = '0';
  $('sickStart').value = dateStr(today.getFullYear(), today.getMonth(), today.getDate()); $('sickEnd').value = $('sickStart').value;
  updateEntryMode(); updateTimePreview();
  $('vacStart').value = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const e = new Date(today); e.setDate(e.getDate()+4); $('vacEnd').value = dateStr(e.getFullYear(), e.getMonth(), e.getDate());
  save(); render();
})();


// PWA-Updatefunktion
const APP_VERSION = '0.3.0';
let pendingServiceWorker = null;

async function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    window.__pwaRegistration = registration;

    if (registration.waiting) pendingServiceWorker = registration.waiting;
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          pendingServiceWorker = worker;
          const status = document.getElementById('updateStatus');
          if (status) status.textContent = 'Neue Version verfügbar. Tippe erneut auf „Update installieren“.';
          const button = document.getElementById('checkUpdate');
          if (button) button.textContent = 'Update installieren';
        }
      });
    });
  } catch (error) {
    console.error('Service Worker konnte nicht registriert werden:', error);
  }
}

async function checkForPwaUpdate() {
  const status = document.getElementById('updateStatus');
  const button = document.getElementById('checkUpdate');
  if (!('serviceWorker' in navigator)) {
    if (status) status.textContent = 'Dieser Browser unterstützt keine PWA-Updates.';
    return;
  }
  try {
    if (button) button.disabled = true;
    if (status) status.textContent = 'Suche nach einer neuen Version …';
    const registration = window.__pwaRegistration || await navigator.serviceWorker.getRegistration();
    if (!registration) {
      await registerPwaServiceWorker();
      if (status) status.textContent = 'Updatefunktion wurde eingerichtet.';
      return;
    }
    if (pendingServiceWorker || registration.waiting) {
      (pendingServiceWorker || registration.waiting).postMessage({type: 'SKIP_WAITING'});
      if (status) status.textContent = 'Update wird installiert …';
      return;
    }
    await registration.update();
    await new Promise(resolve => setTimeout(resolve, 1200));
    if (registration.waiting) {
      pendingServiceWorker = registration.waiting;
      registration.waiting.postMessage({type: 'SKIP_WAITING'});
      if (status) status.textContent = 'Update wird installiert …';
    } else {
      if (status) status.textContent = `Version ${APP_VERSION} ist aktuell.`;
    }
  } catch (error) {
    console.error(error);
    if (status) status.textContent = 'Updateprüfung fehlgeschlagen. Prüfe kurz die Internetverbindung.';
  } finally {
    if (button) button.disabled = false;
  }
}

navigator.serviceWorker?.addEventListener('controllerchange', () => location.reload());
window.addEventListener('load', () => {
  registerPwaServiceWorker();
  const version = document.getElementById('appVersion');
  if (version) version.textContent = APP_VERSION;
  document.getElementById('checkUpdate')?.addEventListener('click', checkForPwaUpdate);
});
