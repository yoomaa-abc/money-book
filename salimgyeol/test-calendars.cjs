const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const L=require('./assets/model.js');
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
let passed=0;
function check(fn){fn();passed++;}
const entry=(amount)=>({id:'same-id',date:'2026-10-22',amount,category:'food',card:'shinhan',memo:'분리 확인'});
async function main(){
 const old=L.defaults();old.entries=[entry(300000)];old.monthlySettings=[{card:'shinhan',month:'2026-10',payment:400000,limit:300000}];
 const migrated=L.validateBook(old);
 check(()=>assert.equal(migrated.calendars.length,1));
 check(()=>assert.equal(migrated.calendars[0].name,'집안 가계부'));
 check(()=>assert.deepEqual(L.activeLedger(migrated),old));
 const older=structuredClone(old);delete older.monthlySettings;
 check(()=>assert.deepEqual(L.activeLedger(L.validateBook(older)).monthlySettings,[]));
 const book=L.bookDefaults();book.calendars[0].ledger=old;book.calendars[1].ledger.entries=[entry(50000)];
 check(()=>assert.equal(L.summarize(book.calendars[0].ledger,'2026-10').sum,300000));
 check(()=>assert.equal(L.summarize(book.calendars[1].ledger,'2026-10').sum,50000));
 check(()=>assert.equal(L.summarize(book.calendars[2].ledger,'2026-10').sum,0));
 check(()=>assert.equal(L.cardState(book.calendars[0].ledger,'2026-10','shinhan').reached,true));
 check(()=>assert.equal(L.cardState(book.calendars[1].ledger,'2026-10','shinhan').reached,false));
 check(()=>assert.equal(L.cardState(book.calendars[1].ledger,'2026-10','shinhan').payment,null));
 check(()=>assert.deepEqual(L.validateBook(JSON.parse(JSON.stringify(book))),book));
 const many=L.bookDefaults();for(let i=0;i<200;i++)many.calendars.push({id:'c'+i,name:'추가달력 '+i,ledger:L.defaults()});
 check(()=>assert.equal(L.validateBook(many).calendars.length,203));
 for(const mutate of [b=>b.calendars.push(b.calendars[0]),b=>b.calendars[1].name=b.calendars[0].name,b=>b.activeCalendar='missing',b=>b.calendars[1].id="bad');alert(1)",b=>b.calendars=[],b=>b.calendars[0].ledger.entries[0].card='missing'])check(()=>{const b=structuredClone(book);mutate(b);assert.throws(()=>L.validateBook(b));});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await page.clock.setFixedTime(new Date(2026,9,22,12));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(path.join(__dirname,'assets/index.html')).href;
 await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();
 assert.equal(await page.locator('#calendarSelect option:checked').innerText(),'집안 가계부');passed++;
 assert.equal(await page.locator('#calendarSelect option').count(),3);passed++;
 async function add(amount,memo){await page.getByRole('button',{name:'＋ 지출 입력'}).click();await page.locator('#entryDate').fill('2026-10-22');await page.locator('#amount').fill(String(amount));await page.locator('#memo').fill(memo);await page.getByRole('button',{name:'지출 저장',exact:true}).click();}
 await add(300000,'집안 식비');
 assert.match(await page.locator('.hero .money').innerText(),/300,000/);passed++;
 await page.locator('#calendarSelect').selectOption('date');
 assert.match(await page.locator('.hero .money').innerText(),/^0/);passed++;
 await add(50000,'데이트 식사');
 assert.match(await page.locator('.hero .money').innerText(),/50,000/);passed++;
 assert.equal(await page.locator('.entry').filter({hasText:'집안 식비'}).count(),0);passed++;
 await page.locator('nav [data-tab=cards]').click();
 assert.match(await page.locator('.panel').first().innerText(),/50,000/);assert.match(await page.locator('.panel').first().innerText(),/기준 미도달/);passed++;
 await page.locator('.panel').first().getByRole('button',{name:'월 결제 금액 설정'}).click();
 await page.locator('#monthlyPayment').fill('75000');await page.locator('#monthlyLimit').fill('10000');await page.getByRole('button',{name:'월별 금액 저장'}).click();
 await page.locator('#calendarSelect').selectOption('home');
 assert.match(await page.locator('.panel').first().innerText(),/300,000/);assert.match(await page.locator('.panel').first().innerText(),/설정하지 않았어요/);passed++;
 await page.locator('#calendarSelect').selectOption('date');
 assert.match(await page.locator('.panel').first().innerText(),/75,000/);assert.match(await page.locator('.panel').first().innerText(),/10,000/);passed++;
 await page.reload();
 assert.equal(await page.locator('#calendarSelect').inputValue(),'date');assert.match(await page.locator('.hero .money').innerText(),/50,000/);passed++;
 // Filters belong to the selected calendar and reset when switching calendars.
 await page.locator('nav [data-tab=report]').click();await page.getByLabel('지출 용도로 조회').selectOption('cafe');
 assert.match(await page.locator('.hero .money').innerText(),/^0/);passed++;
 await page.locator('#calendarSelect').selectOption('home');
 assert.equal(await page.getByLabel('지출 용도로 조회').inputValue(),'');assert.match(await page.locator('.hero .money').innerText(),/300,000/);passed++;
 // Category edits in one calendar leave other calendars unchanged.
 await page.locator('nav [data-tab=settings]').click();await page.locator('.settingsrow').filter({hasText:'식비'}).getByRole('button',{name:'수정',exact:true}).click();
 await page.locator('#catName').fill('집밥');await page.getByRole('button',{name:'저장',exact:true}).click();
 await page.locator('#calendarSelect').selectOption('date');
 assert.equal(await page.locator('.settingsrow').filter({hasText:'집밥'}).count(),0);assert.equal(await page.locator('.settingsrow').filter({hasText:'식비'}).count(),1);passed++;
 // Create, rename, prevent duplicate names and safely remove an empty calendar.
 await page.getByRole('button',{name:'＋ 새 달력',exact:true}).click();await page.locator('#calendarNameInput').fill('여행 경비');await page.getByRole('button',{name:'달력 만들기',exact:true}).click();
 assert.equal(await page.locator('#calendarSelect option:checked').innerText(),'여행 경비');passed++;
 const travel=await page.locator('#calendarSelect').inputValue();
 await page.locator('nav [data-tab=calendar]').click();assert.match(await page.locator('.hero .money').innerText(),/^0/);passed++;
 await page.getByRole('button',{name:'＋ 새 달력',exact:true}).click();await page.locator('#calendarNameInput').fill('여행 경비');await page.getByRole('button',{name:'달력 만들기',exact:true}).click();
 assert.match(await page.locator('#formError').innerText(),/겹치지 않는/);passed++;
 await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'달력 관리',exact:true}).click();
 await page.locator('.settingsrow').filter({hasText:'여행 경비'}).getByRole('button',{name:'이름 수정',exact:true}).click();await page.locator('#calendarNameInput').fill('여름 여행');await page.getByRole('button',{name:'달력 이름 저장'}).click();
 assert.equal(await page.locator('#calendarSelect option:checked').innerText(),'여름 여행');passed++;
 await page.getByRole('button',{name:'달력 관리',exact:true}).click();await page.locator('.settingsrow').filter({hasText:'집안 가계부'}).getByRole('button',{name:'삭제',exact:true}).click();
 assert.match(await page.locator('#toast').innerText(),/삭제할 수 없어요/);passed++;
 await page.locator('.settingsrow').filter({hasText:'여름 여행'}).getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'확인',exact:true}).click();
 assert.equal(await page.locator('#calendarSelect option').count(),3);assert.equal(await page.locator('#calendarSelect').inputValue(),'home');passed++;
 // Export/restore the complete book without merging calendars.
 const saved=await page.evaluate(()=>JSON.stringify(database));
 await page.evaluate(()=>{window.Dalsseum={backup:s=>window.testExport=s};exportBackup();});
 const exported=await page.evaluate(()=>window.testExport);assert.equal(L.validateBook(JSON.parse(exported)).calendars.length,3);passed++;
 await page.evaluate(()=>delete window.Dalsseum);
 // Editing and deleting a date-calendar entry cannot alter home-calendar records.
 await page.locator('#calendarSelect').selectOption('date');await page.locator('.entry').click();await page.locator('#amount').fill('45000');await page.getByRole('button',{name:'수정 저장'}).click();
 assert.match(await page.locator('.hero .money').innerText(),/45,000/);await page.locator('#calendarSelect').selectOption('home');assert.match(await page.locator('.hero .money').innerText(),/300,000/);passed++;
 await page.locator('#calendarSelect').selectOption('date');await page.locator('.entry').click();await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'확인',exact:true}).click();
 assert.match(await page.locator('.hero .money').innerText(),/^0/);await page.locator('#calendarSelect').selectOption('home');assert.match(await page.locator('.hero .money').innerText(),/300,000/);passed++;
 await page.evaluate(raw=>receiveBackup(raw),exported);await page.getByRole('button',{name:'확인',exact:true}).click();
 await page.evaluate(()=>receiveBackup(JSON.stringify(Ledger.defaults())));await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.stringify(database)),saved);passed++;
 await page.evaluate(()=>receiveBackup(JSON.stringify(Ledger.defaults())));await page.getByRole('button',{name:'확인',exact:true}).click();assert.equal(await page.locator('#calendarSelect option').count(),1);passed++;
 await page.evaluate(raw=>receiveBackup(raw),exported);await page.getByRole('button',{name:'확인',exact:true}).click();
 assert.match(await page.locator('.hero .money').innerText(),/300,000/);await page.locator('#calendarSelect').selectOption('date');assert.match(await page.locator('.hero .money').innerText(),/50,000/);passed++;
 // Legacy storage migration, not just explicit restore.
 await page.evaluate(raw=>localStorage.setItem('dalsseum',raw),JSON.stringify(old));await page.reload();
 assert.equal(await page.locator('#calendarSelect option').count(),1);assert.match(await page.locator('.hero .money').innerText(),/300,000/);passed++;
 // Screenshot uses example transactions; user files/phone records are never touched.
 await page.evaluate(raw=>localStorage.setItem('dalsseum',raw),exported);await page.reload();
 await page.addStyleTag({content:'#toast{display:none!important}'});
 await page.setViewportSize({width:390,height:1100});await page.screenshot({path:path.join(__dirname,'build/test-home.png')});
 await page.locator('#calendarSelect').selectOption('date');await page.screenshot({path:path.join(__dirname,'build/test-date.png')});
 for(const width of [320,390,600]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));passed++;}
 assert.deepEqual(errors,[]);passed++;
 console.log(`PASS: ${passed} multi-calendar model/UI checks.`);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
