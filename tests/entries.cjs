const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root=join(__dirname,'..');

// Exercise production event handlers with an isolated in-memory browser model.
function app() {
  const html=readFileSync(join(root,'index.html'),'utf8');
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{
    value:'',textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){}},addEventListener(){}
  }]));
  const weekdays=[1,2,3,4,5].map(value=>({value:String(value),checked:true}));
  for(const [id,value] of Object.entries({workType:'daily',vacStatus:'requested',setCalcMode:'workdays',setDailyTargetMode:'auto',setTimeDisplayMode:'both'})) elements.get(id).value=value;
  let stored=null,fail=false;
  const context=vm.createContext({
    console,Intl,setTimeout:()=>{},navigator:{},window:{addEventListener(){}},confirm:()=>false,
    document:{getElementById:id=>{assert(elements.has(id),id);return elements.get(id)},querySelectorAll:selector=>selector.startsWith('.wd')?weekdays:[]},
    localStorage:{getItem:()=>stored,setItem:(key,value)=>{if(fail)throw Error('Quota exceeded');stored=value}}
  });
  vm.runInContext(readFileSync(join(root,'js/app.js'),'utf8'),context);
  return {el:id=>elements.get(id),read:()=>JSON.parse(stored),fail:()=>{fail=true},click:id=>elements.get(id).onclick()};
}
test('saving a month sum uses its date and changes overview to that month',()=>{
  const t=app(); t.el('workType').value='monthly';t.el('workDate').value='2026-08-17';t.el('workHours').value='60';
  t.click('addWork'); const state=t.read();
  assert.equal(state.workEntries[0].date,'2026-08-01');assert.equal(state.workEntries[0].minutes,3600);assert.equal(state.selectedMonth,7);
});
test('identical save is rejected without deleting the original',()=>{
  const t=app(); t.el('workDate').value='2026-09-11';t.click('addWork');t.click('addWork');
  assert.equal(t.read().workEntries.length,1);assert.match(t.el('toast').textContent,/bereits gespeichert/);
});
test('invalid weekly hours never reach persistent data',()=>{
  const t=app();t.el('workType').value='weekly';t.el('workHours').value='-4';t.click('addWork');
  assert.equal(t.read(),null);assert.match(t.el('toast').textContent,/positive Stunden/);
});
test('storage failure retains form values and reports failure',()=>{
  const t=app();t.el('workNote').value='Notiz erhalten';t.fail();t.click('addWork');
  assert.equal(t.el('workNote').value,'Notiz erhalten');assert.equal(t.read(),null);assert.match(t.el('toast').textContent,/Speichern fehlgeschlagen/);
});
test('reversed vacation dates are saved normalized',()=>{
  const t=app();t.el('vacStart').value='2026-09-18';t.el('vacEnd').value='2026-09-14';t.click('addVacation');
  const entry=t.read().vacations[0]; assert.equal(entry.start,'2026-09-14');assert.equal(entry.end,'2026-09-18');assert.equal(entry.days,5);
});
test('today button preserves entered clock times and break',()=>{
  const t=app();t.el('startTime').value='06:30';t.el('endTime').value='15:45';t.el('pauseMinutes').value='45';t.click('fillToday');
  assert.equal(t.el('startTime').value,'06:30');assert.equal(t.el('endTime').value,'15:45');assert.equal(t.el('pauseMinutes').value,'45');
});
test('month browsing preserves unsaved settings fields',()=>{
  const t=app();t.el('setMonthlyHours').value='123';t.click('nextMonth');
  assert.equal(t.el('setMonthlyHours').value,'123');
});
test('Sunday-only vacation is rejected',()=>{
  const t=app();t.el('vacStart').value='2026-09-13';t.el('vacEnd').value='2026-09-13';t.click('addVacation');
  assert.equal(t.read(),null);assert.match(t.el('toast').textContent,/keine Urlaubstage/);
});
test('calendar shows each daily shift, including overnight hint',()=>{
  const t=app();t.el('workDate').value='2026-09-11';t.el('startTime').value='22:00';t.el('endTime').value='06:00';t.click('addWork');
  assert.match(t.el('monthDayList').innerHTML,/22:00–06:00 \(\+1 Tag\)/);
  t.el('startTime').value='10:00';t.el('endTime').value='12:00';t.click('addWork');
  assert.match(t.el('monthDayList').innerHTML,/10:00–12:00/);
});
test('month hours always display decimal values independent of app time format',()=>{
  const t=app();t.el('setTimeDisplayMode').value='hours';t.click('saveSettings');
  t.el('workDate').value='2026-09-11';t.click('addWork');
  assert.equal(t.el('monthWorkHours').textContent,'4,00 h');assert.equal(t.el('monthTotalHours').textContent,'4,00 h');
});
