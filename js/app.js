(() => {
  const STORAGE = 'arbeitszeiten-app-prototype-v7-clean-no-demo';
  const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
  const fmtDay = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
  const fmtShortMonth = new Intl.DateTimeFormat('de-DE', { month: 'short' });
  const holidayCache = new Map();

  // Gesetzliche Feiertage Niedersachsen (§ 2 NFeiertagsG); offline berechnet.
  function holidaysForYear(year) {
    if (holidayCache.has(year)) return holidayCache.get(year);
    const result = new Map();
    const add = (m,d,name) => result.set(dateStr(year,m-1,d), name);
    add(1,1,'Neujahr'); add(5,1,'Tag der Arbeit'); add(10,3,'Tag der Deutschen Einheit');
    if (year >= 2017) add(10,31,'Reformationstag');
    add(12,25,'1. Weihnachtstag'); add(12,26,'2. Weihnachtstag');
    // Gregorianischer Osteralgorithmus (Meeus/Jones/Butcher).
    const a=year%19, b=Math.floor(year/100), c=year%100, d=Math.floor(b/4), e=b%4;
    const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
    const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7, n=Math.floor((a+11*h+22*l)/451);
    const month=Math.floor((h+l-7*n+114)/31), day=(h+l-7*n+114)%31+1;
    for (const [offset,name] of [[-2,'Karfreitag'],[1,'Ostermontag'],[39,'Christi Himmelfahrt'],[50,'Pfingstmontag']]) {
      const date = new Date(year,month-1,day+offset);
      result.set(dateStr(year,date.getMonth(),date.getDate()),name);
    }
    holidayCache.set(year,result);
    return result;
  }
  function holidayOnDate(ds) { return holidaysForYear(toDate(ds).getFullYear()).get(ds) || null; }

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
  let savedSnapshot = JSON.stringify(state);
  let storageError = false;

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE);
      return raw ? JSON.parse(raw) : defaultState();
    } catch { return defaultState(); }
  }
  function migrate() {
    if (!state || typeof state !== 'object' || Array.isArray(state)) state = defaultState();
    state.settings ||= {};
    const legacyFixedTarget = state.settings.fixedDailyTargetHours == null ? Number(state.settings.fixedDailyTargetMinutes || 0) / 60 : state.settings.fixedDailyTargetHours;
    state.settings = { ...defaultState().settings, ...state.settings, fixedDailyTargetHours: legacyFixedTarget };
    state.settings.workdays = (state.settings.workdays || [1,2,3,4,5]).filter(day => day !== 0);
    if (!state.settings.workdays.length) state.settings.workdays = [1,2,3,4,5];
    state.settings.startBalanceMinutes ??= 0;
    state.settings.startBalanceMonth ||= `${state.selectedYear}-${pad(state.selectedMonth+1)}`;
    state.settings.dailyTargetMode ||= 'auto';
    state.settings.timeDisplayMode ||= 'both';
    if (state.settings.fixedDailyTargetHours == null) {
      state.settings.fixedDailyTargetHours = state.settings.fixedDailyTargetMinutes ? Number(state.settings.fixedDailyTargetMinutes) / 60 : 0;
    }
    state.sickDays ||= [];
    state.workEntries ||= [];
    state.vacations ||= [];
    for (const collection of [state.sickDays, state.vacations]) {
      for (const entry of collection) if (entry.start > entry.end) [entry.start,entry.end] = [entry.end,entry.start];
    }
  }
  function save() {
    try { const snapshot = JSON.stringify(state); localStorage.setItem(STORAGE, snapshot); savedSnapshot = snapshot; storageError = false; return true; }
    catch { state = JSON.parse(savedSnapshot); storageError = true; toast(); return false; }
  }
  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2,'0'); }
  function dateStr(y,m,d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
  function monthKey(y,m) { return `${y}-${pad(m+1)}`; }
  function toDate(str) { const [y,m,d] = String(str || '').split('-').map(Number); return new Date(y, m-1, d); }
  function validDate(str) { const d = toDate(str); return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(d) && dateStr(d.getFullYear(),d.getMonth(),d.getDate()) === str; }
  function todayDate() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function daysInMonth(y,m) { return new Date(y, m+1, 0).getDate(); }
  function minutesToText(min) {
    const abs = Math.round(Math.abs(min));
    const sign = min < 0 && abs ? '-' : '';
    return sign + Math.floor(abs/60) + ':' + pad(abs % 60);
  }
  function parseHours(str) {
    const value = String(str ?? '').trim().replace(',', '.');
    if (!value) return 0;
    const match = value.match(/^([+-]?)(\d+):([0-5]\d)$/);
    if (match) return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return NaN;
    const number = Number(value);
    return Number.isFinite(number * 60) ? Math.sign(number) * Math.round(Math.abs(number) * 60) : NaN;
  }
  function parseDecimalHours(str) {
    // Für den abweichenden Tagessoll: 2,32 bedeutet 2.32 Dezimalstunden, nicht 2:32.
    if (!str) return 0;
    const cleaned = String(str).trim().replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned)) return NaN;
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : NaN;
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
    const value = Math.abs(Number(minutes || 0)) < 1e-7 ? 0 : Number(minutes || 0);
    const sign = forceSign && value > 0 ? '+' : '';
    const mode = state.settings.timeDisplayMode || 'both';
    const hoursText = minutesToText(value);
    const decimalText = `${minutesToDecimalLabel(value)} h`;
    if (mode === 'decimal') return sign + decimalText;
    if (mode === 'both') return sign + `${hoursText} / ${decimalText}`;
    return sign + hoursText;
  }
  function timeToMinutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
    const [h, m] = value.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  }
  function calcTimeRangeMinutes(start, end, pause = 0) {
    const startMin = timeToMinutes(start), endMin = timeToMinutes(end);
    if (startMin === null || endMin === null) return 0;
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    const pauseMin = Number(pause || 0);
    if (!Number.isInteger(pauseMin) || pauseMin < 0 || pauseMin >= diff) return 0;
    return diff - pauseMin;
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
  function isWorkday(date) { return date.getDay() !== 0 && state.settings.workdays.includes(date.getDay()); }
  function isCalculationDay(date) { return date.getDay() !== 0 && (state.settings.calcMode === 'calendar' || isWorkday(date)); }
  function calcDays(y,m) {
    const all = daysInMonth(y,m);
    let count = 0;
    for (let d=1; d<=all; d++) if (isCalculationDay(new Date(y,m,d))) count++;
    return count || all;
  }
  function requiredForDate(date) {
    if (!isCalculationDay(date)) return 0;

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
      if (isCalculationDay(current)) relevantDates.push(day);
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
    if (toDate(dateString).getDay() === 0 || holidayOnDate(dateString)) return undefined;
    const matches = state.vacations.filter(v => inRange(dateString, v.start, v.end));
    return matches.find(v => v.status === 'approved') || matches[0];
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
    if (holidayOnDate(dateString)) return req;
    if (sickOnDate(dateString)) return req;
    if (vacationOnDate(dateString)?.status === 'approved') return req;
    return 0;
  }
  function entryRange(entry) {
    const date = toDate(entry.date);
    if (entry.type === 'weekly') return weekRange(date);
    if (entry.type === 'monthly') return [new Date(date.getFullYear(),date.getMonth(),1), new Date(date.getFullYear(),date.getMonth()+1,0)];
    return [date,date];
  }
  function allocatedWorkOnDate(entry, dateString) {
    if (entry.type === 'daily') return entry.date === dateString ? Number(entry.minutes) : 0;
    const [start,end] = entryRange(entry), date = toDate(dateString);
    if (date < start || date > end) return 0;
    const candidates = [];
    for (const day = new Date(start); day <= end; day.setDate(day.getDate()+1)) {
      if (isCalculationDay(day)) candidates.push(dateStr(day.getFullYear(),day.getMonth(),day.getDate()));
    }
    // Aggregate entries contain actual work. Allocate it to available days so
    // full-day absence credits do not swallow part of the entered work total.
    const available = candidates.filter(ds => !holidayOnDate(ds) && !(isWorkday(toDate(ds)) && (sickOnDate(ds) || vacationOnDate(ds)?.status === 'approved')));
    const dates = available.length ? available : candidates;
    const index = dates.indexOf(dateString);
    if (index < 0) return 0;
    // Allocate the whole period once, including across month/year boundaries.
    // Distribute remainder minutes so the original entry total is preserved.
    const total = Math.round(Number(entry.minutes));
    return Math.floor(total / dates.length) + (index < total % dates.length ? 1 : 0);
  }
  function manualWorkOnDate(dateString) {
    return state.workEntries.reduce((total, entry) => total + allocatedWorkOnDate(entry, dateString), 0);
  }
  function workedOnDate(dateString) {
    // Work already booked on an absence day is included in the day's target credit.
    return Math.max(manualWorkOnDate(dateString), automaticCreditOnDate(dateString));
  }
  function monthHourBreakdown(y,m) {
    const totals = {work:0,holiday:0,vacation:0,sick:0,total:0};
    for (let d=1; d<=daysInMonth(y,m); d++) {
      const ds=dateStr(y,m,d), work=manualWorkOnDate(ds);
      const credit=Math.max(0,automaticCreditOnDate(ds)-work);
      totals.work += work;
      if (holidayOnDate(ds)) totals.holiday += credit;
      else if (sickOnDate(ds)) totals.sick += credit;
      else if (vacationOnDate(ds)?.status === 'approved') totals.vacation += credit;
    }
    totals.total=totals.work+totals.holiday+totals.vacation+totals.sick;
    return totals;
  }
  function previousMonthTransfer(y,m) {
    const previous=new Date(y,m-1,1);
    const difference=monthDiff(previous.getFullYear(),previous.getMonth());
    return Math.abs(difference)<1e-7 ? 0 : difference;
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
  function vacationDaysBetween(start, end, excludeHolidays = true) {
    if (!start || !end) return 0;
    let s = toDate(start), e = toDate(end), count = 0;
    if (e < s) [s,e] = [e,s];
    const cur = new Date(s);
    while (cur <= e) {
      // Urlaubstage werden immer nach den eingestellten Arbeitstagen gezählt,
      // nicht nach Kalendertagen. Bei 6-Tage-Woche Mo-Sa fallen Sonntage heraus.
      if (isWorkday(cur) && (!excludeHolidays || !holidayOnDate(dateStr(cur.getFullYear(),cur.getMonth(),cur.getDate())))) count++;
      cur.setDate(cur.getDate()+1);
    }
    return count;
  }
  function summary() {
    const y = state.selectedYear, m = state.selectedMonth;
    const required = monthRequired(y,m);
    const worked = monthWorked(y,m);
    const diff = worked - required;
    const remainingCalcDays = monthDayStats(y,m).open;
    const remaining = Math.max(0, required - worked);
    const normalDaily = state.settings.dailyTargetMode === 'fixed' ? decimalHoursToMinutes(state.settings.fixedDailyTargetHours) : Math.round(state.settings.monthlyHours * 60 / calcDays(y,m));
    return { required, worked, diff, remaining, account: accountBalanceUntil(y,m), daily: normalDaily, remainingDaily: remainingCalcDays ? Math.round(remaining / remainingCalcDays) : null };
  }
  function toast(msg='Gespeichert') {
    if (storageError) msg = 'Speichern fehlgeschlagen. Bitte Gerätespeicher und Browser-Einstellungen prüfen.';
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
    $('dashRemainingLabel').textContent = !s.required ? 'Noch kein Stundensoll eingestellt' : s.diff > 0 ? 'Überstunden in diesem Monat' : s.diff === 0 ? 'Monatssoll erreicht' : 'Restbedarf in diesem Monat';
    const pct = s.required ? Math.max(0, Math.min(100, Math.round((s.worked / s.required)*100))) : 0;
    $('dashProgress').style.width = pct + '%';
    $('dashProgressText').textContent = `${pct} % erfüllt · ${formatDuration(s.worked)} von ${formatDuration(s.required)}`;
    $('daysCount').textContent = daysInMonth(y,m);
    $('remainingDaily').textContent = s.remainingDaily === null ? 'Keine offenen Tage' : formatDuration(s.remainingDaily);
    $('vacDaysMonth').textContent = countMonthMarkedDays(y,m,'vacation');
    renderQuickList(s);
    renderWorkEntries();
    renderSickList();
    renderMonthOverview();
    renderVacations();
    updateTimePreview();
  }
  function countMonthMarkedDays(y,m,type) {
    let count = 0;
    for (let d=1; d<=daysInMonth(y,m); d++) {
      const dt = new Date(y,m,d);
      if (!isWorkday(dt)) continue;
      const ds = dateStr(y,m,d);
      if (type === 'vacation' && vacationOnDate(ds)?.status === 'approved' && !sickOnDate(ds)) count++;
      if (type === 'sick' && sickOnDate(ds) && !holidayOnDate(ds)) count++;
    }
    return count;
  }
  function renderQuickList(s) {
    const items = [
      ['Berechnung', state.settings.calcMode === 'calendar' ? 'Montag bis Samstag (Sonntage frei)' : 'Eingestellte Arbeitstage (Sonntage frei)'],
      ['Automatisch angerechnet', `${countMonthMarkedDays(state.selectedYear,state.selectedMonth,'vacation')} Urlaubstage · ${countMonthMarkedDays(state.selectedYear,state.selectedMonth,'sick')} Krankheitstage`],
      ['Tagessoll-Modus', state.settings.dailyTargetMode === 'fixed' ? `Abweichender Tagessoll: ${decimalHoursLabel(state.settings.fixedDailyTargetHours)} Dezimalstunden · Anzeige ${formatDuration(decimalHoursToMinutes(state.settings.fixedDailyTargetHours))}` : 'Automatisch aus Monatsstunden'],
      ['Startsaldo', `${formatDuration(state.settings.startBalanceMinutes, true)} ab ${state.settings.startBalanceMonth}`],
      ['Zeitkonto bis Monatsende', `${formatDuration(s.account, true)}`],
    ];
    $('quickList').innerHTML = items.map(([a,b]) => `<div class="row"><div><div class="row-title">${a}</div><div class="row-sub">${b}</div></div><span class="chip blue">Info</span></div>`).join('');
  }
  function renderWorkEntries() {
    const y = state.selectedYear, m = state.selectedMonth;
    const entries = state.workEntries.filter(e => {
      const [start,end] = entryRange(e);
      return start <= new Date(y,m+1,0) && end >= new Date(y,m,1);
    }).sort((a,b) => b.date.localeCompare(a.date));
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
    $('sickList').innerHTML = entries.map(e => `<div class="row"><div><div class="row-title">Krankheit · ${vacationDaysBetween(e.start,e.end)} Arbeitstag(e) ohne Feiertage</div><div class="row-sub">${fmtDay.format(toDate(e.start))} – ${fmtDay.format(toDate(e.end))}${e.note ? ' · '+escapeHtml(e.note) : ''}</div></div><button class="danger small" data-del-sick="${e.id}">Löschen</button></div>`).join('');
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
    const holiday = holidayOnDate(ds), sunday = date.getDay() === 0;
    const isFree = !isWorkday(date);
    let status = 'open';
    let label = 'Noch zu arbeiten';
    let chip = '<span class="chip blue">Offen</span>';
    if (isFree) { status = 'free'; label = 'Frei'; chip = '<span class="chip blue">Frei</span>'; }
    if (sunday) { status = 'sunday'; label = 'Sonntag · frei'; chip = '<span class="chip purple">Sonntag</span>'; }
    if (manualWorkOnDate(ds) > 0) {
      status = 'worked'; label = 'Gearbeitet'; chip = '<span class="chip green">Gearbeitet</span>';
    }
    if (vac && !isFree) {
      if (vac.status === 'approved') {
        status = 'vacation'; label = 'Urlaub genehmigt'; chip = '<span class="chip yellow">Urlaub</span>';
      } else { chip += '<span class="chip yellow">Beantragt</span>'; label += ' · Urlaub beantragt'; }
    }
    if (sick && !isFree) { status = 'sick'; label = 'Krank'; chip = '<span class="chip red">Krank</span>'; }
    if (holiday && !sunday) { status = 'holiday'; label = holiday; chip = '<span class="chip orange">Feiertag</span>'; }
    if (hasManualDailyWork(ds)) {
      status = 'worked'; label = sunday ? 'Sonntagsarbeit' : 'Gearbeitet'; chip = '<span class="chip green">Arbeit</span>';
      if (holiday) chip += '<span class="chip orange">Feiertag</span>';
    }
    if (sunday && status === 'worked') chip += '<span class="chip purple">Sonntag</span>';
    return { date, ds, req, worked, diff: worked - req, status, label, chip, isFree, sunday, holiday };
  }
  function monthDayStats(y, m) {
    const stats = { worked:0, vacation:0, sick:0, open:0, missing:0 };
    const today = todayDate();
    for (let d=1; d<=daysInMonth(y,m); d++) {
      const day = dayOverview(y,m,d);
      if (day.status === 'worked') stats.worked++;
      if (!day.isFree && vacationOnDate(day.ds)?.status === 'approved' && !sickOnDate(day.ds)) stats.vacation++;
      if (!day.isFree && sickOnDate(day.ds) && !day.holiday) stats.sick++;
      const unfinished = !day.isFree && !day.holiday && !sickOnDate(day.ds) && vacationOnDate(day.ds)?.status !== 'approved' && (day.worked < day.req || (day.req === 0 && day.worked === 0));
      if (unfinished && day.date >= today) stats.open++;
      if (unfinished && day.date < today) stats.missing++;
    }
    return stats;
  }
  function renderMonthOverview() {
    const y = state.selectedYear, m = state.selectedMonth;
    const list = $('monthDayList');
    if (!list) return;
    const hours=monthHourBreakdown(y,m), transfer=previousMonthTransfer(y,m);
    $('previousMonthName').textContent = fmtMonth.format(new Date(y,m-1,1));
    $('previousMonthHours').textContent = `${transfer > 0 ? '+' : ''}${minutesToDecimalLabel(Math.abs(transfer)<1e-7 ? 0 : transfer)} h`;
    $('previousMonthHours').className = 'value ' + (transfer>1e-7 ? 'positive' : transfer < -1e-7 ? 'negative' : '');
    $('monthHoursTitle').textContent = `Stunden im ${fmtMonth.format(new Date(y,m,1))}`;
    for (const [id,key] of [['monthWorkHours','work'],['monthHolidayHours','holiday'],['monthVacationHours','vacation'],['monthTotalHours','total']]) $(id).textContent = `${minutesToDecimalLabel(hours[key])} h`;
    $('monthSickHours').textContent = `Zusätzlich enthalten: ${minutesToDecimalLabel(hours.sick)} h Krankheit. Gesamt ohne Vormonatsübertrag.`;
    const stats = monthDayStats(y,m);
    $('workedDaysCount').textContent = stats.worked;
    $('sickDaysCount').textContent = stats.sick;
    $('vacDaysMonth').textContent = stats.vacation;
    $('openWorkDaysCount').textContent = stats.open;
    $('monthCountNote').textContent = `Ab heute noch ${stats.open} offene Arbeitstage. ${stats.missing} frühere Arbeitstage sind noch nicht vollständig erfasst. Wochen- und Monatssummen werden rechnerisch auf die Berechnungstage verteilt.`;
    const today = new Date();
    const todayString = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
    const html = [];
    for (let d=1; d<=daysInMonth(y,m); d++) {
      const day = dayOverview(y,m,d);
      const shifts=state.workEntries.filter(e => e.type === 'daily' && e.date === day.ds && e.minutes > 0);
      const shiftText=shifts.map(e => e.startTime && e.endTime ? `${escapeHtml(e.startTime)}–${escapeHtml(e.endTime)}${e.endTime < e.startTime ? ' (+1 Tag)' : ''}${Number(e.pauseMinutes)>0 ? ` · ${Number(e.pauseMinutes)} Min. Pause` : ''}` : 'Arbeitszeit ohne Uhrzeit').join('<br>');
      html.push(`<div class="day-row ${day.status}${day.sunday ? ' is-sunday' : ''}${day.ds === todayString ? ' today' : ''}" title="${escapeHtml(day.label)}">
        <div class="day-date">
          <div class="day-number">${d}</div>
          <div><div class="day-weekday">${fmtWeekday.format(day.date)}${day.ds === todayString ? ' · Heute' : ''}</div><div class="day-month">${fmtShortMonth.format(day.date)} ${y}</div></div>
        </div>
        <div class="day-status">${day.chip}${shiftText ? `<span class="day-shifts">${shiftText}</span>` : day.status === 'worked' ? '<span class="row-sub">rechnerisch verteilt</span>' : ''}${day.holiday ? `<span class="row-sub">${escapeHtml(day.holiday)}</span>` : ''}</div>
        <div class="day-times">
          <div class="day-time">Soll<strong>${formatDuration(day.req)}</strong></div>
          <div class="day-time">Ist<strong>${formatDuration(day.worked)}</strong></div>
          <div class="day-time">Differenz<strong class="${day.diff>=0?'positive':'negative'}">${day.req || day.worked ? formatDuration(day.diff, true) : '–'}</strong></div>
        </div>
      </div>`);
    }
    list.innerHTML = html.join('');
  }

  function annualVacationDays(year) {
    let total = 0;
    for (let m=0; m<12; m++) total += countMonthMarkedDays(year,m,'vacation');
    return total;
  }
  function renderVacations() {
    const approved = annualVacationDays(state.selectedYear);
    $('vacationYear').textContent = state.selectedYear;
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
      return `<div class="row"><div><div class="row-title">${escapeHtml(v.title)} · ${calcDays} Tage</div><div class="row-sub">${fmtDay.format(toDate(v.start))} – ${fmtDay.format(toDate(v.end))}${v.note ? ' · '+escapeHtml(v.note):''}<br>${v.status === 'approved' ? 'Genehmigt: Sollzeit wird an Arbeitstagen angerechnet.' : 'Beantragt: noch keine Zeitgutschrift.'}${storedHint}</div></div><div class="entry-actions">${v.status === 'requested' ? `<button class="secondary small" data-approve-vac="${v.id}">Genehmigen</button>` : '<span class="chip green">Genehmigt</span>'}<button class="danger small" aria-label="Urlaub löschen" data-del-vac="${v.id}">×</button></div></div>`;
    }).join('');
    document.querySelectorAll('[data-del-vac]').forEach(btn => btn.onclick = () => { state.vacations = state.vacations.filter(v => v.id !== btn.dataset.delVac); save(); render(); });
    document.querySelectorAll('[data-approve-vac]').forEach(btn => btn.onclick = () => { state.vacations.find(v => v.id === btn.dataset.approveVac).status = 'approved'; save(); render(); });
  }
  function updateFixedDailyPreview() {
    const el = $('fixedDailyPreview');
    if (!el) return;
    const value = parseDecimalHours($('setFixedDailyTarget')?.value || state.settings.fixedDailyTargetHours || 0);
    if (!Number.isFinite(value) || value <= 0) { el.textContent = ''; return; }
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
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b === btn ? 'page' : 'false'));
    window.scrollTo({top:0, behavior:'instant'});
  }));
  $('currentMonth').onclick = () => { const d = todayDate(); state.selectedYear = d.getFullYear(); state.selectedMonth = d.getMonth(); save(); render(); };
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
    $('workType').value = 'daily';
    updateEntryMode(); updateTimePreview();
  };
  $('addWork').onclick = () => {
    let date = $('workDate').value;
    const type = $('workType').value;
    if (!validDate(date)) return toast('Bitte ein gültiges Datum wählen.');
    if (type === 'monthly') { const d = toDate(date); date = dateStr(d.getFullYear(), d.getMonth(), 1); }
    const entry = { id: uid(), type, date, minutes: 0, note: $('workNote').value.trim() };
    let minutes = 0;
    if (type === 'daily') {
      minutes = calcTimeRangeMinutes($('startTime').value, $('endTime').value, $('pauseMinutes').value);
      if (!minutes) return toast('Bitte gültige Uhrzeiten und eine Pause kürzer als die Schicht eintragen.');
      entry.startTime = $('startTime').value; entry.endTime = $('endTime').value; entry.pauseMinutes = Number($('pauseMinutes').value || 0);
    } else {
      minutes = parseHours($('workHours').value); if (!Number.isFinite(minutes) || minutes <= 0) return toast('Bitte positive Stunden eingeben, z. B. 4:30 oder 4,5.');
    }
    entry.minutes = minutes;
    if (state.workEntries.some(e => e.type === type && e.date === date && e.minutes === minutes && e.startTime === entry.startTime && e.endTime === entry.endTime && Number(e.pauseMinutes || 0) === Number(entry.pauseMinutes || 0))) return toast('Diese Arbeitszeit ist bereits gespeichert.');
    state.workEntries.push(entry);
    state.selectedYear = toDate(date).getFullYear(); state.selectedMonth = toDate(date).getMonth();
    if (!save()) return;
    $('workHours').value = ''; $('workNote').value = ''; render(); updateTimePreview(); toast('Arbeitszeit gespeichert');
  };
  $('sickToday').onclick = () => { const d = new Date(); const ds = dateStr(d.getFullYear(), d.getMonth(), d.getDate()); $('sickStart').value = ds; $('sickEnd').value = ds; };
  $('addSick').onclick = () => {
    let start = $('sickStart').value, end = $('sickEnd').value || start;
    if (!validDate(start) || !validDate(end)) return toast('Bitte gültige Krankheitsdaten wählen.');
    if (toDate(end) < toDate(start)) [start,end] = [end,start];
    if (state.sickDays.some(e => e.start === start && e.end === end)) return toast('Dieser Krankheitszeitraum ist bereits gespeichert.');
    state.sickDays.push({ id: uid(), start, end, note: $('sickNote').value.trim() });
    state.selectedYear = toDate(start).getFullYear(); state.selectedMonth = toDate(start).getMonth();
    if (!save()) return;
    $('sickNote').value = ''; render(); toast('Krankheit gespeichert');
  };
  $('calcVacDays').onclick = () => { $('vacDays').value = vacationDaysBetween($('vacStart').value, $('vacEnd').value); };
  ['vacStart','vacEnd'].forEach(id => $(id).addEventListener('input', () => { $('vacDays').value = vacationDaysBetween($('vacStart').value,$('vacEnd').value); }));
  $('addVacation').onclick = () => {
    const title = $('vacTitle').value.trim() || 'Urlaub'; let start = $('vacStart').value, end = $('vacEnd').value || start;
    if (!validDate(start) || !validDate(end)) return toast('Bitte einen gültigen Zeitraum wählen.');
    if (end < start) [start,end] = [end,start];
    if (state.vacations.some(v => v.start === start && v.end === end)) return toast('Dieser Urlaub ist bereits gespeichert.');
    const days = vacationDaysBetween(start,end);
    if (!days) return toast('In diesem Zeitraum liegen keine Urlaubstage. Sonntage, Feiertage und freie Tage zählen nicht.');
    $('vacDays').value = days;
    state.vacations.push({ id: uid(), title, start, end, days, status: $('vacStatus').value, note: $('vacNote').value.trim() });
    if (!save()) return;
    $('vacTitle').value = ''; $('vacStart').value = ''; $('vacEnd').value = ''; $('vacDays').value = ''; $('vacNote').value = '';
    render(); toast($('vacStatus').value === 'approved' ? 'Urlaub gespeichert: Sollzeit angerechnet.' : 'Urlaubsantrag gespeichert: noch keine Zeitgutschrift.');
  };
  $('saveSettings').onclick = () => {
    const wds = [...document.querySelectorAll('.wd:checked')].map(cb => Number(cb.value));
    const monthlyHours = parseDecimalHours($('setMonthlyHours').value);
    const yearVacation = parseDecimalHours($('setYearVacation').value);
    const fixedHours = parseDecimalHours($('setFixedDailyTarget').value);
    const balance = parseHours($('setStartBalance').value);
    if (![monthlyHours,yearVacation,fixedHours].every(n => Number.isFinite(n) && n >= 0) || !Number.isFinite(balance)) return toast('Bitte gültige Zahlen eintragen. Stunden und Urlaub dürfen nicht negativ sein.');
    if ($('setDailyTargetMode').value === 'fixed' && fixedHours <= 0) return toast('Bitte ein Tagessoll größer als 0 eintragen.');
    if (!wds.length) return toast('Bitte mindestens einen Arbeitstag auswählen.');
    state.settings.monthlyHours = monthlyHours;
    state.settings.calcMode = $('setCalcMode').value;
    state.settings.yearVacation = yearVacation;
    state.settings.startBalanceMinutes = balance;
    state.settings.startBalanceMonth = $('setStartBalanceMonth').value || monthKey(state.selectedYear,state.selectedMonth);
    state.settings.dailyTargetMode = $('setDailyTargetMode').value;
    state.settings.timeDisplayMode = $('setTimeDisplayMode').value;
    state.settings.fixedDailyTargetHours = fixedHours;
    state.settings.workdays = wds.length ? wds : [1,2,3,4,5];
    if (!save()) return;
    renderSettings(); render(); toast('Einstellungen gespeichert');
  };
  $('clearAll').onclick = () => { if (confirm('Alle Arbeitszeiten, Krankheiten, Urlaube und Einstellungen auf diesem Gerät unwiderruflich löschen?')) { state = defaultState(); if (!save()) return; renderSettings(); render(); toast('Daten gelöscht'); } };
  $('exportData').onclick = () => {
    const blob = new Blob([JSON.stringify({ app:'Arbeitszeiten', version:APP_VERSION, exportedAt:new Date().toISOString(), data:state }, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `Arbeitszeiten-Sicherung-${dateStr(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const today = new Date();
  $('workDate').value = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  $('startTime').value = '08:00'; $('endTime').value = '12:00'; $('pauseMinutes').value = '0';
  $('sickStart').value = dateStr(today.getFullYear(), today.getMonth(), today.getDate()); $('sickEnd').value = $('sickStart').value;
  updateEntryMode(); updateTimePreview();
  $('vacStart').value = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const e = new Date(today); e.setDate(e.getDate()+4); $('vacEnd').value = dateStr(e.getFullYear(), e.getMonth(), e.getDate());
  $('vacDays').value = vacationDaysBetween($('vacStart').value,$('vacEnd').value);
  renderSettings(); render();
})();


// PWA-Updatefunktion
const APP_VERSION = '0.4.0';
let pendingServiceWorker = null;

async function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    window.__pwaRegistration = registration;

    if (registration.waiting) {
      pendingServiceWorker = registration.waiting;
      document.getElementById('updateStatus').textContent = 'Eine neue Version ist bereit zur Installation.';
      document.getElementById('checkUpdate').textContent = 'Update installieren';
    }
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
    } else if (registration.installing) {
      if (status) status.textContent = 'Die neue Version wird geladen. Bitte kurz warten und erneut prüfen.';
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

let hadServiceWorkerController = Boolean(navigator.serviceWorker?.controller);
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  // First offline installation must not clear a form already being filled in.
  if (hadServiceWorkerController) location.reload();
  hadServiceWorkerController = true;
});
window.addEventListener('load', () => {
  registerPwaServiceWorker();
  const version = document.getElementById('appVersion');
  if (version) version.textContent = APP_VERSION;
  document.getElementById('checkUpdate')?.addEventListener('click', checkForPwaUpdate);
});
