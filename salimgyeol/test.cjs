const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const M=require('./assets/model.js');
let chromium;try{({chromium}=require('playwright'));}catch(e){({chromium}=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
async function main(){
 let n=0;function check(fn){fn();n++;}
 const s=M.defaults();
 const entry=(id,date,amount,category='food',card='shinhan')=>({id,date,amount,category,card,memo:''});
 s.entries=[entry('a','2026-10-01',100000),entry('b','2026-10-31',200000),entry('c','2026-11-01',500000),entry('d','2026-10-15',12000,'cafe','samsung')];
 check(()=>assert.equal(M.total(M.monthly(s,'2026-10')),312000));
 check(()=>assert.equal(M.total(M.monthly(s,'2026-10','food','shinhan')),300000));
 check(()=>assert.equal(M.cardState(s,'2026-10','shinhan').reached,true));
 check(()=>{const a=structuredClone(s);a.entries[1].amount=199999;assert.equal(M.cardState(a,'2026-10','shinhan').reached,false);});
 check(()=>{const a=structuredClone(s);a.cards[0].limit=0;assert.equal(M.cardState(a,'2026-10','shinhan').reached,false);});
 check(()=>assert.equal(M.dateOK('2024-02-29'),true));
 check(()=>assert.equal(M.dateOK('2026-02-29'),false));
 check(()=>assert.equal(M.moneyOK(0),false));
 check(()=>assert.equal(M.moneyOK(1.5),false));
 check(()=>assert.deepEqual(M.validate(JSON.parse(JSON.stringify(s))),s));
 check(()=>{const a=structuredClone(s);a.entries[0].card='missing';assert.throws(()=>M.validate(a));});
 check(()=>{const a=structuredClone(s);a.entries[0].id="bad');alert(1)";assert.throws(()=>M.validate(a));});
 check(()=>{const a=structuredClone(s);a.entries.push(a.entries[0]);assert.throws(()=>M.validate(a));});
 check(()=>{const a=structuredClone(s);delete a.monthlySettings;assert.deepEqual(M.validate(a).monthlySettings,[]);assert.equal(M.validate(a).entries.length,4);});
 const planned=structuredClone(s);planned.monthlySettings=[{card:'shinhan',month:'2026-10',payment:450000,limit:300000},{card:'shinhan',month:'2026-11',payment:110000,limit:600000}];
 check(()=>assert.equal(M.cardState(planned,'2026-10','shinhan').payment,450000));
 check(()=>assert.equal(M.cardState(planned,'2026-11','shinhan').payment,110000));
 check(()=>assert.equal(M.cardState(planned,'2026-11','shinhan').reached,false));
 check(()=>assert.equal(M.cardState(planned,'2026-10','samsung').payment,null));
 check(()=>assert.equal(M.cardState(planned,'2026-12','shinhan').limit,300000));
 check(()=>{const a=structuredClone(planned);a.monthlySettings[0].limit=0;assert.equal(M.cardState(a,'2026-10','shinhan').reached,false);});
 check(()=>assert.deepEqual(M.validate(JSON.parse(JSON.stringify(planned))),planned));
 for(const mutate of [a=>a.monthlySettings[0].month='2026-13',a=>a.monthlySettings[0].card='missing',a=>a.monthlySettings[0].payment=-1,a=>a.monthlySettings[0].limit=1.1,a=>a.monthlySettings.push(a.monthlySettings[0])])check(()=>{const a=structuredClone(planned);mutate(a);assert.throws(()=>M.validate(a));});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu'],downloadsPath:path.join(__dirname,'build/downloads')});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,acceptDownloads:true});
 await page.clock.setFixedTime(new Date(2026,9,22,12));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'assets/index.html')).href);
 await page.evaluate(()=>{localStorage.clear();});await page.reload();
 async function add(amount,card='shinhan',category='food'){
  await page.getByRole('button',{name:'＋ 지출 입력'}).click();
  await page.locator('#amount').fill(String(amount));
  await page.locator('#card').selectOption(card);await page.locator('#category').selectOption(category);
  await page.getByRole('button',{name:'지출 저장',exact:true}).click();
 }
 await add(100000);await add(200000);await add(12000,'samsung','cafe');
 const value=await page.locator('.hero .money').innerText();check(()=>assert.match(value,/312,000/));
 const day=await page.locator('.day.selected').innerText();check(()=>{assert.match(day,/3건/);assert.match(day,/312,000/);});
 await page.locator('nav [data-tab=cards]').click();
 const panels=page.locator('.panel');
 assert.match(await panels.nth(0).innerText(),/기준 도달/);n++;
 assert.match(await panels.nth(1).innerText(),/기준 미도달/);n++;
 await page.locator('nav [data-tab=report]').click();
 assert.deepEqual(await page.locator('.report-summary h2').allTextContents(),['용도별 합계','카드별 합계']);
 assert.equal(await page.locator('.entry,.groupdate,.pager').count(),0);
 assert.match(await page.getByRole('region',{name:'용도별 합계'}).innerText(),/식비/);
 assert.match(await page.getByRole('region',{name:'카드별 합계'}).innerText(),/신한카드/);
 await page.getByLabel('카드로 조회').selectOption('samsung');
 assert.match(await page.locator('.hero .money').innerText(),/12,000/);n++;
 await page.getByLabel('지출 용도로 조회').selectOption('food');
 assert.match(await page.locator('.hero .money').innerText(),/^0/);n++;
 await page.locator('nav [data-tab=calendar]').click();
 await page.locator('.entry').filter({hasText:'100,000원'}).click();
 await page.locator('#amount').fill('90000');await page.locator('#memo').fill('<간식 & 커피>');
 await page.getByRole('button',{name:'수정 저장'}).click();
 assert.match(await page.locator('.hero .money').innerText(),/302,000/);n++;
 await page.reload();assert.match(await page.locator('.hero .money').innerText(),/302,000/);n++;
 await page.locator('.entry').filter({hasText:'90,000원'}).click();
 await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'확인',exact:true}).click();
 assert.match(await page.locator('.hero .money').innerText(),/212,000/);n++;
 await page.locator('nav [data-tab=settings]').click();
 await page.locator('.settingsrow').filter({hasText:'신한카드'}).getByRole('button',{name:'삭제'}).click();
 assert.match(await page.locator('#toast').innerText(),/기록에 사용 중/);n++;
 await page.locator('.settingsrow').filter({hasText:'신한카드'}).getByRole('button',{name:'수정'}).click();
 await page.locator('#catName').fill('나의 신한');await page.locator('#catLimit').fill('200000');
 await page.getByRole('button',{name:'저장',exact:true}).click();
 await page.locator('nav [data-tab=cards]').click();
 assert.match(await page.locator('.panel').first().innerText(),/나의 신한/);assert.match(await page.locator('.panel').first().innerText(),/기준 도달/);n++;
 const before=await page.evaluate(()=>JSON.stringify(state));
 await page.evaluate(()=>receiveBackup('{"broken":true}'));
 assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);n++;
 await page.evaluate(()=>receiveBackup(JSON.stringify(Ledger.defaults())));
 await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);n++;
 await page.evaluate(()=>receiveBackup(JSON.stringify(Ledger.defaults())));
 await page.getByRole('button',{name:'확인',exact:true}).click();
 assert.equal(await page.evaluate(()=>state.entries.length),0);n++;
 // Verify native backup handoff receives a valid complete backup.
 await page.locator('nav [data-tab=settings]').click();
 await page.evaluate(()=>{window.Dalsseum={backup:raw=>{window.testBackup=raw;},restore:()=>{window.restoreRequested=true;}};});
 await page.getByRole('button',{name:'백업 저장',exact:true}).click();
 const backup=await page.evaluate(()=>window.testBackup);
 assert.equal(M.activeLedger(M.validateBook(JSON.parse(backup))).entries.length,0);n++;
 await page.getByRole('button',{name:'백업 복원',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.restoreRequested),true);n++;
 await page.evaluate(()=>delete window.Dalsseum);
 // Corrupt storage must remain unchanged until a valid restore is confirmed.
 await page.evaluate(()=>localStorage.setItem('dalsseum','BROKEN'));await page.reload();
 assert.equal(await page.evaluate(()=>commit(Ledger.defaults())),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dalsseum')),'BROKEN');n++;
 await page.evaluate(()=>receiveBackup(JSON.stringify(Ledger.defaults())));
 await page.getByRole('button',{name:'취소',exact:true}).click();
 assert.equal(await page.evaluate(()=>commit(Ledger.defaults())),false);n++;
 await page.evaluate(()=>receiveBackup(JSON.stringify(Ledger.defaults())));
 await page.getByRole('button',{name:'확인',exact:true}).click();
 assert.equal(await page.evaluate(()=>storageError),false);n++;
 // Add categories/cards without losing a partially completed expense.
 await page.locator('nav [data-tab=calendar]').click();
 await page.getByRole('button',{name:'＋ 지출 입력'}).click();
 await page.locator('#amount').fill('76500');await page.locator('#memo').fill('입력 유지 확인');
 await page.getByRole('button',{name:'＋ 용도 추가',exact:true}).click();
 await page.locator('#catName').fill('반려동물');await page.getByRole('button',{name:'저장',exact:true}).click();
 assert.equal(await page.locator('#amount').inputValue(),'76,500');assert.equal(await page.locator('#memo').inputValue(),'입력 유지 확인');assert.equal(await page.locator('#category option:checked').innerText(),'반려동물');n++;
 await page.getByRole('button',{name:'＋ 카드 추가',exact:true}).click();
 await page.locator('#catName').fill('국민 체크');await page.locator('#catLimit').fill('80000');await page.getByRole('button',{name:'저장',exact:true}).click();
 assert.equal(await page.locator('#card option:checked').innerText(),'국민 체크');assert.equal(await page.locator('#amount').inputValue(),'76,500');n++;
 await page.getByRole('button',{name:'＋ 용도 추가',exact:true}).click();await page.getByRole('button',{name:'닫기',exact:true}).click();
 assert.equal(await page.locator('#memo').inputValue(),'입력 유지 확인');n++;
 // Keyboard-sized viewports keep each focused text field within the visible sheet.
 for(const viewport of [{width:390,height:360},{width:640,height:260}]){
  await page.setViewportSize(viewport);
  for(const field of ['#amount','#memo']){
   await page.locator(field).focus();await page.evaluate(()=>syncViewport());await page.waitForTimeout(450);
   const bounds=await page.locator(field).boundingBox();
   assert.ok(bounds.y>=0&&bounds.y+bounds.height<=viewport.height,`Focused ${field} visible: ${JSON.stringify(bounds)}`);n++;
  }
 }
 await page.screenshot({path:path.join(__dirname,'build/test-keyboard.png')});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'지출 저장',exact:true}).click();
 const addedId=await page.evaluate(()=>state.cards.find(c=>c.name==='국민 체크').id);
 assert.equal(await page.evaluate(()=>state.entries.length),1);n++;
 // Native bridge contract: failed writes keep current in-memory state; successful writes read back.
 const nativeBefore=await page.evaluate(()=>JSON.stringify(state));
 await page.evaluate(()=>{window.Dalsseum={write:()=>false,read:()=>''};});
 assert.equal(await page.evaluate(()=>commit(Ledger.defaults())),false);assert.equal(await page.evaluate(()=>JSON.stringify(state)),nativeBefore);n++;
 await page.evaluate(()=>{window.Dalsseum={write:raw=>{window.nativeRaw=raw;return true;},read:()=>window.nativeRaw,checkStorage:()=>true};});
 assert.equal(await page.evaluate(()=>commit(clone())),true);n++;
 await page.locator('nav [data-tab=settings]').click();await page.getByRole('button',{name:'저장 상태 확인'}).click();assert.match(await page.locator('#toast').innerText(),/로컬 저장 정상/);n++;
 await page.evaluate(()=>delete window.Dalsseum);
 // Monthly values remain independent across cards and months, including after restart.
 await page.evaluate(()=>{month='2026-10';showTab('cards');});
 await page.locator('.panel').filter({hasText:'국민 체크'}).getByRole('button',{name:'월 결제 금액 설정'}).click();
 await page.locator('#monthlyPayment').fill('123000');await page.locator('#monthlyLimit').fill('76500');await page.getByRole('button',{name:'월별 금액 저장'}).click();
 assert.match(await page.locator('.panel').filter({hasText:'국민 체크'}).innerText(),/123,000/);assert.match(await page.locator('.panel').filter({hasText:'국민 체크'}).innerText(),/기준 도달/);n++;
 await page.getByRole('button',{name:'다음 달',exact:true}).click();
 assert.match(await page.locator('.panel').filter({hasText:'국민 체크'}).innerText(),/설정하지 않았어요/);n++;
 await page.locator('.panel').filter({hasText:'국민 체크'}).getByRole('button',{name:'월 결제 금액 설정'}).click();
 await page.locator('#monthlyPayment').fill('45000');await page.locator('#monthlyLimit').fill('0');await page.getByRole('button',{name:'월별 금액 저장'}).click();
 await page.reload();await page.evaluate(()=>{month='2026-10';showTab('cards');});
 assert.equal(await page.evaluate(card=>Ledger.cardState(state,'2026-10',card).payment,addedId),123000);n++;
 assert.equal(await page.evaluate(card=>Ledger.cardState(state,'2026-11',card).payment,addedId),45000);n++;
 assert.equal(await page.evaluate(card=>Ledger.cardState(state,'2026-11',card).limit,addedId),0);n++;
 assert.equal(await page.evaluate(()=>Ledger.cardState(state,'2026-10','shinhan').payment),null);n++;
 // Blank per-month fields remove overrides and restore card defaults.
 await page.locator('.panel').filter({hasText:'국민 체크'}).getByRole('button',{name:'월 결제 금액 설정'}).click();
 await page.locator('#monthlyPayment').fill('');await page.locator('#monthlyLimit').fill('');await page.getByRole('button',{name:'월별 금액 저장'}).click();
 assert.equal(await page.evaluate(card=>Ledger.cardState(state,'2026-10',card).limit,addedId),80000);n++;
 // Back handles open forms and other tabs, and delegates calendar root to Android's exit dialog.
 assert.equal(await page.evaluate(()=>handleBack()),true);n++;
 assert.equal(await page.evaluate(()=>handleBack()),false);n++;
 await page.getByRole('button',{name:'＋ 지출 입력'}).click();assert.equal(await page.evaluate(()=>handleBack()),true);assert.equal(await page.locator('#sheet').evaluate(el=>el.open),false);n++;
 // A realistic populated calendar preview, kept separate from the installed app's empty data.
 await page.evaluate(()=>{
  state=Ledger.defaults();month='2026-10';selected='2026-10-16';
  const samples=[[1,32000,'food','shinhan'],[2,5800,'cafe','shinhan'],[3,89000,'shop','samsung'],[5,14500,'traffic','hyundai'],[6,24000,'food','shinhan'],[8,62000,'home','hyundai'],[9,7500,'cafe','shinhan'],[12,135000,'shop','samsung'],[13,19000,'food','shinhan'],[15,42000,'health','hyundai'],[16,18500,'food','shinhan'],[16,4800,'cafe','shinhan']];
  state.entries=samples.map(([d,amount,category,card],i)=>({id:'preview'+i,date:'2026-10-'+String(d).padStart(2,'0'),amount,category,card,memo:d===16?'오늘의 작은 기록':''}));showTab('calendar');
 });
 await page.addStyleTag({content:'#toast{display:none!important}'});
 await page.setViewportSize({width:390,height:1100});
 await page.screenshot({path:path.join(__dirname,'build/test-calendar.png'),fullPage:false});
 await page.locator('nav [data-tab=report]').click();await page.screenshot({path:path.join(__dirname,'build/test-report.png'),fullPage:false});
 await page.evaluate(()=>{state.monthlySettings=[{card:'shinhan',month:'2026-10',payment:245000,limit:100000}];showTab('cards');});await page.screenshot({path:path.join(__dirname,'build/test-cards.png'),fullPage:false});
 for(const width of [320,390,600]){await page.setViewportSize({width,height:844});await page.evaluate(()=>showTab('calendar'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);n++;}
 assert.deepEqual(errors,[]);n++;
 console.log(`PASS: ${n} model/UI checks; no browser exceptions; 320/390/600px layouts fit.`);
 await browser.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});


