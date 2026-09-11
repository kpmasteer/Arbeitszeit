const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

// Load the real calculation functions without running browser event bindings.
const source = readFileSync(join(__dirname, '../js/app.js'), 'utf8');
const boundary = source.indexOf("  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener");
assert(boundary > 0);
function app(overrides = {}) {
  const context = vm.createContext({ Intl, console, localStorage: { getItem: () => null } });
  const exports = `\n globalThis.api = {
    setState(value) { state = value; }, defaultState, monthWorked, workedOnDate,
    monthRequired, requiredForDate, accountBalanceUntil, vacationDaysBetween,
    parseHours, parseDecimalHours, calcTimeRangeMinutes, minutesToText, summary,
    monthDayStats, countMonthMarkedDays, monthHourBreakdown, previousMonthTransfer,
    holidayOnDate, holidaysForYear, dayOverview, manualWorkOnDate,
    annualVacationDays: typeof annualVacationDays === 'function' ? annualVacationDays : null
  }; })();`;
  vm.runInContext(source.slice(0, boundary) + exports, context);
  const api = context.api;
  const state = api.defaultState();
  state.selectedYear = 2026; state.selectedMonth = 8;
  Object.assign(state.settings, { monthlyHours: 80, startBalanceMonth: '2026-09' }, overrides);
  api.setState(state);
  return { api, state };
}
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('60 monthly hours stay exactly 3600 minutes; free Sundays receive zero', () => {
  const { api, state } = app();
  state.workEntries = [{ type: 'monthly', date: '2026-08-01', minutes: 3600 }];
  near(api.monthWorked(2026, 7), 3600);
  near(api.workedOnDate('2026-08-09', 2026, 7), 0);
});
test('40-hour week crossing August/September: 8 hours + 32 hours', () => {
  const { api, state } = app();
  state.workEntries = [{ type: 'weekly', date: '2026-08-31', minutes: 2400 }];
  near(api.monthWorked(2026, 7), 480);
  near(api.monthWorked(2026, 8), 1920);
  near(api.workedOnDate('2026-09-05', 2026, 8), 0);
});
test('week crossing a year conserves all 101 minutes', () => {
  const { api, state } = app();
  const holidayCredits = api.monthWorked(2026,11) + api.monthWorked(2027,0);
  state.workEntries = [{ type: 'weekly', date: '2026-12-28', minutes: 101 }];
  near(api.monthWorked(2026, 11) + api.monthWorked(2027, 0), holidayCredits + 101);
});
test('all month targets sum exactly in leap years and both calculation modes', () => {
  for (const calcMode of ['workdays', 'calendar']) {
    const { api } = app({ calcMode, monthlyHours: 60.25 });
    for (const year of [2024, 2026]) for (let m = 0; m < 12; m++) {
      let total = 0;
      for (let d = 1; d <= new Date(year, m + 1, 0).getDate(); d++) total += api.requiredForDate(new Date(year,m,d));
      near(total, 3615);
    }
  }
});
test('fixed decimal target is not prematurely rounded', () => {
  const { api } = app({ dailyTargetMode: 'fixed', fixedDailyTargetHours: 2.32 });
  near(api.monthRequired(2026, 8), 22 * 139.2);
  assert.equal(api.minutesToText(4 * 139.2), '9:17');
});
test('negative and positive half-minute values round symmetrically', () => {
  const { api } = app();
  assert.equal(api.minutesToText(-139.5), '-2:20');
  assert.equal(api.minutesToText(139.5), '2:20');
});
test('daily overnight shift minus pause', () => {
  const { api } = app();
  near(api.calcTimeRangeMinutes('22:00', '06:00', 30), 450);
  near(api.calcTimeRangeMinutes('08:00', '12:00', 15), 225);
});
test('invalid time and negative pause cannot produce worked hours', () => {
  const { api } = app();
  for (const args of [['08:00','12:00',-30], ['25:00','06:00',0], ['08:00','12:00',300]]) {
    assert(!(api.calcTimeRangeMinutes(...args) > 0));
  }
});
test('hour parsing accepts comma and HH:MM, rejects impossible minutes', () => {
  const { api } = app();
  near(api.parseHours('4,5'), 270);
  near(api.parseHours('-2:15'), -135);
  for (const value of ['4:99', '1:2:3', 'Infinity', 'abc']) assert(!Number.isFinite(api.parseHours(value)));
});
test('only approved vacation credits time; sickness takes precedence', () => {
  const { api, state } = app({ dailyTargetMode:'fixed', fixedDailyTargetHours:4 });
  state.vacations = [{ start:'2026-09-07', end:'2026-09-08', status:'requested' }];
  near(api.workedOnDate('2026-09-07'), 0);
  state.vacations[0].status = 'approved';
  state.sickDays = [{ start:'2026-09-07', end:'2026-09-07' }];
  near(api.workedOnDate('2026-09-07'), 240);
  assert.equal(api.countMonthMarkedDays(2026,8,'vacation'), 1);
});
test('work on an absence day is topped up to target, never double-credited', () => {
  const { api, state } = app({ dailyTargetMode:'fixed', fixedDailyTargetHours:4 });
  state.sickDays = [{start:'2026-09-07',end:'2026-09-07'}];
  state.workEntries = [{type:'daily',date:'2026-09-07',minutes:120}];
  near(api.workedOnDate('2026-09-07'),240);
  state.workEntries[0].minutes = 300;
  near(api.workedOnDate('2026-09-07'),300);
});
test('weekly actual work stays intact when a full sick day is credited', () => {
  const {api,state} = app({dailyTargetMode:'fixed',fixedDailyTargetHours:8});
  state.workEntries = [{type:'weekly',date:'2026-09-07',minutes:2400}];
  state.sickDays = [{start:'2026-09-08',end:'2026-09-08'}];
  near(api.monthWorked(2026,8),2880);
  near(api.workedOnDate('2026-09-08'),480);
  near(api.workedOnDate('2026-09-07'),600);
});
test('annual vacation is year-specific and counts overlapping ranges once', () => {
  const { api, state } = app();
  state.vacations = [
    {start:'2026-12-31',end:'2027-01-04',status:'approved'},
    {start:'2026-12-31',end:'2026-12-31',status:'approved'},
    {start:'2026-09-07',end:'2026-09-07',status:'requested'}
  ];
  assert.equal(api.annualVacationDays(2026),1);
  assert.equal(api.annualVacationDays(2027),1); // Neujahr kostet keinen Urlaubstag.
});
test('vacation and sickness day counts do not depend on configured hours', () => {
  const { api, state } = app({monthlyHours:0});
  state.vacations = [{start:'2026-09-07',end:'2026-09-07',status:'approved'}];
  state.sickDays = [{start:'2026-09-08',end:'2026-09-08'}];
  const stats = api.monthDayStats(2026,8);
  assert.equal(stats.vacation,1); assert.equal(stats.sick,1);
});
test('time account adds exact differences and opening balance across months', () => {
  const { api, state } = app({monthlyHours:40,startBalanceMinutes:90,startBalanceMonth:'2026-08'});
  state.workEntries = [{type:'monthly',date:'2026-08-01',minutes:2400},{type:'monthly',date:'2026-09-01',minutes:2460}];
  near(api.accountBalanceUntil(2026,8),150);
});
test('past months have no remaining future workdays or fictitious daily requirement', () => {
  const { api, state } = app();
  state.selectedYear=2020; state.selectedMonth=0;
  assert.equal(api.monthDayStats(2020,0).open,0);
  assert.equal(api.summary().remainingDaily,null);
});
test('Niedersachsen 2026 has all ten statutory holidays and no All Saints Day', () => {
  const {api}=app();
  const dates=['2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14','2026-05-25','2026-10-03','2026-10-31','2026-12-25','2026-12-26'];
  assert.equal(api.holidaysForYear(2026).size,10);
  for (const ds of dates) assert(api.holidayOnDate(ds),ds);
  assert.equal(api.holidayOnDate('2026-11-01'),null);
  assert.equal(api.holidayOnDate('2026-12-24'),null);
});
test('movable holidays change correctly in 2027',()=>{
  const {api}=app();
  assert.equal(api.holidayOnDate('2027-03-26'),'Karfreitag');
  assert.equal(api.holidayOnDate('2027-03-29'),'Ostermontag');
  assert.equal(api.holidayOnDate('2027-05-06'),'Christi Himmelfahrt');
  assert.equal(api.holidayOnDate('2027-05-17'),'Pfingstmontag');
});
test('holiday credits exactly the fixed daily target, without vacation duplication',()=>{
  const {api,state}=app({dailyTargetMode:'fixed',fixedDailyTargetHours:2.32});
  state.vacations=[{start:'2026-04-03',end:'2026-04-06',status:'approved'}];
  state.sickDays=[{start:'2026-04-03',end:'2026-04-03'}];
  near(api.workedOnDate('2026-04-03'),139.2);
  near(api.monthHourBreakdown(2026,3).holiday,278.4);
  near(api.monthHourBreakdown(2026,3).vacation,0);
  near(api.monthHourBreakdown(2026,3).sick,0);
  assert.equal(api.vacationDaysBetween('2026-04-03','2026-04-06'),0);
});
test('Sunday is free even with old Sunday setting and calendar calculation',()=>{
  const {api,state}=app({calcMode:'calendar',workdays:[0,1,2,3,4,5,6],dailyTargetMode:'fixed',fixedDailyTargetHours:4});
  state.vacations=[{start:'2026-09-13',end:'2026-09-13',status:'approved'}];
  state.sickDays=[{start:'2026-09-13',end:'2026-09-13'}];
  near(api.requiredForDate(new Date(2026,8,13)),0);
  near(api.workedOnDate('2026-09-13'),0);
  assert.equal(api.vacationDaysBetween('2026-09-13','2026-09-13'),0);
  assert.equal(api.dayOverview(2026,8,13).status,'sunday');
});
test('explicit Sunday work counts fully and never creates a Sunday target',()=>{
  const {api,state}=app();
  state.workEntries=[{type:'daily',date:'2026-09-13',minutes:240,startTime:'10:00',endTime:'14:00'}];
  near(api.workedOnDate('2026-09-13'),240);
  const day=api.dayOverview(2026,8,13);
  assert.equal(day.status,'worked'); assert.equal(day.sunday,true); near(day.req,0);
});
test('weekly and monthly aggregates never manufacture Sunday work',()=>{
  const {api,state}=app({calcMode:'calendar'});
  state.workEntries=[{type:'weekly',date:'2026-09-07',minutes:2400},{type:'monthly',date:'2026-09-01',minutes:3600}];
  near(api.manualWorkOnDate('2026-09-13'),0);
  near(api.monthWorked(2026,8),6000);
});
test('holiday on a free Sunday stays zero; Saturday credit follows workday settings',()=>{
  const {api,state}=app({dailyTargetMode:'fixed',fixedDailyTargetHours:4});
  near(api.workedOnDate('2027-10-03'),0);
  near(api.workedOnDate('2026-10-31'),0);
  state.settings.workdays.push(6);
  near(api.workedOnDate('2026-10-31'),240);
});
test('carry contains only previous month difference, not cumulative balance',()=>{
  const {api,state}=app({monthlyHours:40,startBalanceMinutes:600,startBalanceMonth:'2026-07'});
  state.workEntries=[{type:'monthly',date:'2026-07-01',minutes:3000},{type:'monthly',date:'2026-08-01',minutes:2460}];
  near(api.previousMonthTransfer(2026,8),60);
  state.workEntries[1].minutes=2340;
  near(api.previousMonthTransfer(2026,8),-60);
});
test('January carry comes from December of the previous year only',()=>{
  const {api,state}=app({monthlyHours:0});
  state.workEntries=[{type:'daily',date:'2025-12-30',minutes:90},{type:'daily',date:'2026-01-02',minutes:300}];
  near(api.previousMonthTransfer(2026,0),90);
});
test('monthly component totals exactly match credited hours including sickness',()=>{
  const {api,state}=app({dailyTargetMode:'fixed',fixedDailyTargetHours:4});
  state.workEntries=[{type:'daily',date:'2026-04-07',minutes:300}];
  state.vacations=[{start:'2026-04-08',end:'2026-04-08',status:'approved'}];
  state.sickDays=[{start:'2026-04-09',end:'2026-04-09'}];
  const totals=api.monthHourBreakdown(2026,3);
  near(totals.work,300); near(totals.holiday,480); near(totals.vacation,240); near(totals.sick,240);
  near(totals.total,1260); near(totals.total,api.monthWorked(2026,3));
});
