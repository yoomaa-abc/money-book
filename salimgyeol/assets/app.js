'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won=n=>n.toLocaleString('ko-KR'), pad=n=>String(n).padStart(2,'0');
const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>localDate(new Date()),id=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,11);
let database,state,tab='calendar',selected=today(),month=selected.slice(0,7),filterCard='',filterType='',reportCategoryDetail='',storageError=false,sheetReturn=null,monthData;
const pages={calendar:1,report:1},PAGE_SIZE=50;
try{const raw=window.Dalsseum?Dalsseum.read():localStorage.getItem('dalsseum');database=raw?Ledger.validateBook(JSON.parse(raw)):Ledger.bookDefaults();state=Ledger.activeLedger(database);}
catch(e){database=Ledger.bookDefaults();state=Ledger.activeLedger(database);storageError=true;}
function persistBook(candidate,recovering=false){
 if(storageError&&!recovering){toast('원본 기록 보호를 위해 백업 복원이 먼저 필요해요.');return false;}
 try{
  const normalized=Ledger.validateBook(candidate),raw=JSON.stringify(normalized);
  if(window.Dalsseum){if(!Dalsseum.write(raw)||Dalsseum.read()!==raw)throw Error();}
  else{localStorage.setItem('dalsseum',raw);if(localStorage.getItem('dalsseum')!==raw)throw Error();}
  database=normalized;state=Ledger.activeLedger(database);if(recovering)storageError=false;return true;
 }catch(e){toast('저장하지 못했어요. 저장 공간과 입력값을 확인해 주세요.');return false;}
}
function commit(next,recovering=false){
 const candidate={...database,calendars:database.calendars.map(c=>c.id===database.activeCalendar?{...c,ledger:next}:c)};
 return persistBook(candidate,recovering);
}
function calendarName(){return database.calendars.find(c=>c.id===database.activeCalendar).name;}
function resetCalendarView(){reportCategoryDetail='';filterCard='';filterType='';pages.calendar=pages.report=1;}
function calendarPicker(){return `<section class="calendar-picker" aria-label="달력 선택"><div class="picker-heading"><label for="calendarSelect">용도별 달력</label><button class="subtle" onclick="manageCalendars()">달력 관리</button></div><div class="picker-row"><select id="calendarSelect" aria-label="사용할 달력" onchange="switchCalendar(this.value)">${options(database.calendars,database.activeCalendar)}</select><button class="primary small" onclick="calendarForm()">＋ 새 달력</button></div><p>선택한 달력의 지출만 표시하고 계산합니다.</p></section>`;}
function switchCalendar(calendarId){
 if($('sheet').open||calendarId===database.activeCalendar)return;
 if(!database.calendars.some(c=>c.id===calendarId))return;
 if(persistBook({...database,activeCalendar:calendarId})){resetCalendarView();render();window.scrollTo(0,0);}
 else render();
}
function calendarForm(editId){
 const current=database.calendars.find(c=>c.id===editId);
 openSheet(sheetHead(current?'달력 이름 수정':'새 달력 만들기')+`<p class="intro">집안·데이트·모임 등 목적별로 만들어 보세요.<br>새 달력의 기록과 금액은 다른 달력과 합산되지 않아요.</p><form id="calendarForm"><label for="calendarNameInput">달력 이름</label><input id="calendarNameInput" name="name" maxlength="30" required placeholder="예: 여행 경비" value="${current?esc(current.name):''}"><p class="error" id="formError" role="alert"></p><div class="actions"><button class="primary" type="submit">${current?'달력 이름 저장':'달력 만들기'}</button></div></form>`);
 $('calendarForm').onsubmit=event=>{
  event.preventDefault();const name=$('calendarNameInput').value.trim();
  if(!name||name.length>30||database.calendars.some(c=>c.name===name&&c.id!==editId)){$('formError').textContent='겹치지 않는 달력 이름을 1~30자로 입력해 주세요.';return;}
  const candidate=JSON.parse(JSON.stringify(database));
  if(current)candidate.calendars.find(c=>c.id===editId).name=name;
  else{const newId=id();candidate.calendars.push({id:newId,name,ledger:Ledger.defaults()});candidate.activeCalendar=newId;}
  if(persistBook(candidate)){resetCalendarView();closeSheet();render();window.scrollTo(0,0);toast(current?'달력 이름을 저장했어요':'새 달력을 만들었어요');}
 };
}
function manageCalendars(){
 openSheet(sheetHead('내 달력 관리')+`<p class="intro">필요할 때마다 새 달력을 추가하세요.<br>용도·카드·월별 결제 설정도 달력마다 따로 보관돼요.</p><button class="primary full" onclick="calendarForm()">＋ 새 달력 만들기</button><section class="panel">${database.calendars.map(c=>`<div class="settingsrow"><span>${esc(c.name)}${c.id===database.activeCalendar?' <span class="badge">선택 중</span>':''}<small>지출 ${c.ledger.entries.length}건</small></span><div class="rowbuttons"><button onclick="calendarForm('${esc(c.id)}')">이름 수정</button><button class="danger" onclick="removeCalendar('${esc(c.id)}')">삭제</button></div></div>`).join('')}</section><p class="hint">기록이나 월별 카드 설정이 있는 달력은 삭제할 수 없어요.</p>`);
}
function removeCalendar(calendarId){
 const current=database.calendars.find(c=>c.id===calendarId);
 if(!current)return;
 if(database.calendars.length===1){toast('달력은 최소 1개가 필요해요.');return;}
 if(current.ledger.entries.length||current.ledger.monthlySettings.length){toast('기록이나 월별 카드 설정이 있는 달력은 삭제할 수 없어요.');return;}
 confirmSheet('빈 달력을 삭제할까요?',current.name,()=>{
  const candidate={...database,calendars:database.calendars.filter(c=>c.id!==calendarId)};
  if(candidate.activeCalendar===calendarId)candidate.activeCalendar=candidate.calendars[0].id;
  if(persistBook(candidate)){resetCalendarView();closeSheet();render();toast('빈 달력을 삭제했어요');}
 },manageCalendars);
}
function clone(){return JSON.parse(JSON.stringify(state));}
function toast(s){$('toast').textContent=s;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function monthTitle(){const [y,m]=month.split('-');return `${y}년 ${Number(m)}월`;}
function monthBar(){return `<div class="monthbar"><button onclick="moveMonth(-1)" aria-label="이전 달">‹</button><strong>${monthTitle()}</strong><button onclick="moveMonth(1)" aria-label="다음 달">›</button><button class="today" onclick="goToday()">이번 달</button></div>`;}
function moveMonth(delta){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+delta,1);if(d.getFullYear()<1900||d.getFullYear()>2199)return;month=localDate(d).slice(0,7);selected=month+'-01';reportCategoryDetail='';pages.calendar=pages.report=1;render();}
function goToday(){reportCategoryDetail='';selected=today();month=selected.slice(0,7);pages.calendar=pages.report=1;render();}
function showTab(t,card=''){filterCard=t==='report'?card:'';reportCategoryDetail='';tab=t;if(t in pages)pages[t]=1;render();window.scrollTo(0,0);}
function render(){monthData=Ledger.summarize(state,month);document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('main').innerHTML=calendarPicker()+(tab==='calendar'?calendarView():tab==='report'?reportView():tab==='cards'?cardsView():settingsView());}
function hero(entries,label,showFixedTotal=false){
 let fixed=0,fixedSum=0,total=0;
 for(const entry of entries){total+=entry.amount;if(Ledger.entryType(entry)==='fixed'){fixed++;fixedSum+=entry.amount;}}
 return `<section class="hero"><div class="eyebrow">${esc(calendarName())} · ${label}</div><div class="money">${won(total)}<small>원</small></div><div class="hero-foot"><span class="pill">총 ${entries.length}건</span><span style="align-self:center">${monthTitle()} · 지출일 기준</span></div>${fixed||showFixedTotal?`<div class="hero-split"><span>일반 ${won(total-fixedSum)}원</span><span class="fixed-total">고정 ${won(fixedSum)}원</span></div>`:''}</section>`;
}
function calendarView(){
 const entries=Ledger.monthly(state,month,'','',monthData),[y,m]=month.split('-').map(Number),first=new Date(y,m-1,1).getDay(),last=new Date(y,m,0).getDate();
 let cells='<div aria-hidden="true"></div>'.repeat(first);
 for(let d=1;d<=last;d++){
  const date=month+'-'+pad(d),bucket=monthData.byDay.get(date),general=bucket?bucket.generalCount:0,fixed=bucket?bucket.fixedCount:0,sum=bucket?bucket.generalSum:0,fixedSum=bucket?bucket.fixedSum:0;
  cells+=`<button class="day ${(first+d-1)%7===0?'sunday':''} ${date===selected?'selected':''} ${date===today()?'todaydate':''}" onclick="selectDay('${date}')" aria-label="${m}월 ${d}일, 일반지출 ${general}건, ${won(sum)}원${fixed?', 고정지출 '+fixed+'건, '+won(fixedSum)+'원':''}" aria-pressed="${date===selected}"><span class="num">${d}</span>${general?`<span class="count">${general}건</span><span class="amt">${won(sum)}</span>`:''}${fixed?`<span class="fixed-count">${fixed}건</span><span class="amt fixed-amt">${won(fixedSum)}</span>`:''}</button>`;
 }
 const dayBucket=monthData.byDay.get(selected),dayEntries=dayBucket?dayBucket.entries:[];
 return monthBar()+hero(entries,'이번 달 쓴 돈',true)+`<div class="sectiontop"><h2>${esc(calendarName())}</h2><span class="subtle">날짜를 눌러 기록하세요</span></div><section class="calendar"><div class="week">${['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')}</div><div class="grid">${cells}</div></section><div class="sectiontop" id="dayDetails"><h2>${Number(selected.slice(5,7))}월 ${Number(selected.slice(8))}일 <span class="subtle">${dayEntries.length}건</span></h2><button class="primary small" onclick="entryForm()">＋ 지출 입력</button></div><section class="panel" style="margin-top:0">${dayEntries.length?`<div class="cardrow"><span class="subtle">하루 합계</span><b>${won(dayBucket.sum)}원</b></div>${dayBucket.fixedCount?`<div class="day-split"><span>일반 ${dayBucket.generalCount}건 · ${won(dayBucket.generalSum)}원</span><span class="fixed-text">고정 ${dayBucket.fixedCount}건 · ${won(dayBucket.fixedSum)}원</span></div>`:'' }`+entryList(dayEntries,'calendar'):'<div class="empty"><span class="symbol">＋</span>아직 기록한 지출이 없어요.<br>오늘 쓴 돈을 하나씩 남겨 보세요.</div>'}</section><div class="sectiontop"><h2>카드 기준 금액</h2><button class="subtle" onclick="showTab('cards')">전체 보기 ›</button></div><div class="mini-cards">${state.cards.map(c=>{const s=Ledger.cardState(state,month,c.id,monthData);return `<button class="mini-card" onclick="showTab('cards')"><i class="dot ${!s.limit?'off':s.reached?'red':''}"></i>${esc(c.name)} · ${s.limit?s.reached?'도달':'미도달':'미설정'}</button>`;}).join('')}</div>`;
}
function selectDay(date){selected=date;pages.calendar=1;render();const heading=$('dayDetails');if(heading)heading.scrollIntoView({behavior:'smooth',block:'start'});}
function entryRow(e){
 const fixed=Ledger.entryType(e)==='fixed',category=(fixed?monthData.fixedCategories:monthData.categories).get(e.category),card=monthData.cards.get(e.card);
 return `<button class="entry" onclick="entryForm('${esc(e.id)}')"><span class="entry-icon ${fixed?'fixed-icon':''}">${fixed?'↻':categoryIcon(e.category)}</span><span class="desc"><b>${esc(category.name)}${fixed?'<span class="fixed-badge">고정지출</span>':''}</b><small>${esc(card.name)}${e.memo?' · '+esc(e.memo):''}</small></span><span class="value">${won(e.amount)}원</span><span class="arrow">›</span></button>`;
}
function categoryIcon(c){const icons={food:'♧',cafe:'☕',shop:'◇',traffic:'↗',home:'⌂',health:'♡',etc:'·'};return Object.prototype.hasOwnProperty.call(icons,c)?icons[c]:'◇';}
function entryList(entries,scope,dated=false){
 const count=Math.max(1,Math.ceil(entries.length/PAGE_SIZE));pages[scope]=Math.min(pages[scope],count);
 const from=(pages[scope]-1)*PAGE_SIZE,to=Math.min(entries.length,from+PAGE_SIZE);let html='',previous='';
 for(const entry of entries.slice(from,to)){if(dated&&previous!==entry.date){previous=entry.date;html+=`<div class="groupdate">${Number(entry.date.slice(5,7))}월 ${Number(entry.date.slice(8))}일</div>`;}html+=entryRow(entry);}
 if(count>1)html+=`<div class="pager" aria-label="내역 페이지"><button class="secondary small" onclick="changePage('${scope}',-1)" ${pages[scope]===1?'disabled':''}>이전 내역</button><span>${from+1}–${to} / ${entries.length}건</span><button class="secondary small" onclick="changePage('${scope}',1)" ${pages[scope]===count?'disabled':''}>다음 내역</button></div>`;
 return html;
}
function changePage(scope,direction){pages[scope]=Math.max(1,pages[scope]+direction);render();const heading=$(scope==='calendar'?'dayDetails':'reportEntries');if(heading)heading.scrollIntoView({block:'start'});}
function options(items,chosen,all=false){return (all?'<option value="">전체</option>':'')+items.map(x=>`<option value="${esc(x.id)}" ${x.id===chosen?'selected':''}>${esc(x.name)}</option>`).join('');}
function totalsSection(title,sectionId,items,totals,sum,selectable=false){
 const groups=items.map(c=>({...c,sum:totals.get(c.id)||0})).filter(g=>g.sum>0).sort((a,b)=>b.sum-a.sum);
 return `<section class="report-summary" aria-labelledby="${sectionId}"><div class="sectiontop"><h2 id="${sectionId}">${title}</h2><span class="subtle">${groups.length}개</span></div><div class="panel">${groups.length?groups.map(g=>{
  const content=`<span>${esc(g.name)}${g.fixed?'<span class="fixed-badge">고정지출</span>':''}</span><b>${won(g.sum)}원 <span class="subtle">${Math.round(g.sum/sum*100)}%</span>${selectable?' <span aria-hidden="true">›</span>':''}</b>`;
  return (selectable?`<button class="statline category-total" data-category="${esc(g.id)}" onclick="viewCategory('${esc(g.id)}')" aria-label="${esc(g.name)}${g.fixed?' 고정지출':''} 지출 내역 보기" aria-expanded="${reportCategoryDetail===g.id}">${content}</button>`:`<div class="statline">${content}</div>`)+`<div class="breakbar"><i style="width:${g.sum/sum*100}%"></i></div>`;
 }).join(''):'<div class="empty">이 조건의 지출이 없어요.</div>'}</div></section>`;
}
function viewCategory(category){
 reportCategoryDetail=category;pages.report=1;render();
 const heading=$('reportEntries');if(heading){heading.focus();heading.scrollIntoView({block:'start'});}
}
function closeCategoryDetails(){
 const category=reportCategoryDetail;reportCategoryDetail='';render();
 const button=Array.from(document.querySelectorAll('.category-total')).find(el=>el.dataset.category===category);if(button)button.focus();
}
function categoryDetails(entries,items){
 const category=items.find(c=>c.id===reportCategoryDetail);if(!category)return '';
 const matches=entries.filter(entry=>Ledger.categoryKey(entry)===category.id);
 return `<section class="category-details" aria-labelledby="reportEntries"><div class="sectiontop"><h2 id="reportEntries" tabindex="-1">${esc(category.name)}${category.fixed?' · 고정지출':''} 지출 내역</h2><button class="secondary small" onclick="closeCategoryDetails()">내역 닫기</button></div><p class="subtle">${esc(calendarName())} · ${monthTitle()}</p><div class="panel"><div class="cardrow"><span>총 ${matches.length}건</span><b>${won(Ledger.total(matches))}원</b></div>${matches.length?entryList(matches,'report',true):'<div class="empty">이 조건의 지출이 없어요.</div>'}</div></section>`;
}
function reportView(){
 const entries=Ledger.monthly(state,month,'',filterCard,monthData,filterType),categoryTotals=new Map(),cardTotals=new Map();
 for(const entry of entries){
  const key=Ledger.categoryKey(entry);
  categoryTotals.set(key,(categoryTotals.get(key)||0)+entry.amount);
  cardTotals.set(entry.card,(cardTotals.get(entry.card)||0)+entry.amount);
 }
 const fixedOptions=state.fixedCategories.map(c=>({id:'fixed:'+c.id,name:c.name,fixed:true})),sum=Ledger.total(entries);
 const card=state.cards.find(c=>c.id===filterCard);
 return monthBar()+(card?`<div class="sectiontop"><span class="subtle">${esc(card.name)} 지출</span><button class="secondary small" onclick="showTab('report')">전체 카드 보기</button></div>`:'')+hero(entries,'선택한 조건의 지출')+`<div class="filter"><label class="filter-type">지출 구분<select aria-label="지출 구분으로 조회" onchange="filterType=this.value;reportCategoryDetail='';pages.report=1;render()">${options([{id:'',name:'전체 지출'},{id:'general',name:'일반 지출'},{id:'fixed',name:'고정 지출'}],filterType)}</select></label></div>`
  +totalsSection('용도별 합계','categoryTotals',[...state.categories,...fixedOptions],categoryTotals,sum,true)
  +categoryDetails(entries,[...state.categories,...fixedOptions])
  +totalsSection('카드별 합계','cardTotals',state.cards,cardTotals,sum);
}
function cardsView(){return monthBar()+`<h2>카드별 월 결제 관리</h2><p class="intro">결제 예정 금액과 알림 기준을 카드별·월별로 설정하세요.<br>예정 금액은 직접 입력한 값으로 보관됩니다.</p>`+state.cards.map(c=>{const s=Ledger.cardState(state,month,c.id,monthData);return `<section class="panel"><div class="cardrow"><strong>${esc(c.name)}</strong><span class="signal ${!s.limit?'off':s.reached?'red':''}" aria-label="${s.reached?'기준 도달':'기준 미도달'}">${!s.limit?'−':s.reached?'!':'✓'}</span></div><p class="subtle" style="margin-bottom:0">${monthTitle()} 결제 예정 · 직접 설정</p><div class="cardmoney">${s.payment===null?'<span class="subtle">설정하지 않았어요</span>':won(s.payment)+'<small> 원</small>'}</div><div class="payment-actions"><button class="primary small" onclick="monthlyCardForm('${esc(c.id)}')">월 결제 금액 설정</button><button class="subtle" onclick="viewCard('${esc(c.id)}')">월별 조회 ›</button></div><div class="cardrow" style="margin-top:20px"><span class="subtle">입력한 지출 합계</span><b>${won(s.sum)}원</b></div><div class="cardrow" style="margin-top:12px"><span class="subtle">${s.limit?'알림 기준 '+won(s.limit)+'원':'알림 기준 미설정'} · ${s.overridden?'이번 달 설정':'카드 기본값'}</span><span class="badge ${s.reached?'red':''}">${s.limit?s.reached?'기준 도달':'기준 미도달':'알림 꺼짐'}</span></div><div class="progress ${s.reached?'red':''}"><i style="width:${s.ratio*100}%"></i></div><span class="subtle">${s.limit?s.reached?won(s.sum-s.limit)+'원 초과 · '+Math.floor(s.sum/s.limit*100)+'%':won(s.limit-s.sum)+'원 남았어요':'기준 금액을 설정하면 색상 알림이 켜져요'}</span></section>`;}).join('')+`<p class="hint">입력한 지출 합계는 지출일이 속한 달 기준입니다. 직접 설정한 결제 예정 금액은 카드사 청구 내역과 자동 연동되지 않습니다. 색상 알림은 입력한 지출 합계를 기준으로 합니다.</p><button class="secondary full" onclick="categoryForm('cards')">＋ 카드 종류 추가</button>`;}
function monthlyCardForm(cardId){
 const formCalendar=database.activeCalendar,c=state.cards.find(c=>c.id===cardId),plan=state.monthlySettings.find(p=>p.card===cardId&&p.month===month),formMonth=month;
 openSheet(sheetHead('월 결제 금액 설정')+`<p class="intro">${esc(calendarName())}<br>${esc(c.name)} · ${monthTitle()}<br>다른 달의 설정은 유지됩니다.</p><form id="monthlyCardForm"><label for="monthlyPayment">이 달에 결제할 예정 금액 · 원</label><input id="monthlyPayment" name="payment" inputmode="numeric" maxlength="15" placeholder="직접 입력 · 비워 두면 미설정" value="${plan&&plan.payment!==null?won(plan.payment):''}"><label for="monthlyLimit">이 달의 알림 기준 금액 · 원</label><input id="monthlyLimit" name="limit" inputmode="numeric" maxlength="15" placeholder="비워 두면 기본값 ${won(c.limit)}원" value="${plan&&plan.limit!==null?won(plan.limit):''}"><p class="hint">입력한 지출 합계가 기준 이상이면 빨간 아이콘으로 표시해요. 기준 0원은 이 달 알림 끄기, 빈칸은 카드 기본 기준 사용입니다.</p><p class="error" id="formError" role="alert"></p><div class="actions"><button class="primary" type="submit">월별 금액 저장</button></div></form>`);
 for(const field of ['monthlyPayment','monthlyLimit'])bindMoney($(field));
 $('monthlyCardForm').onsubmit=ev=>{ev.preventDefault();if(database.activeCalendar!==formCalendar)return;const f=new FormData(ev.target),values={};for(const key of ['payment','limit']){const raw=String(f.get(key)).replace(/,/g,'').trim();if(raw!==''&&(!/^\d+$/.test(raw)||!Ledger.moneyOK(Number(raw),true))){$('formError').textContent='금액은 0~999,999,999,999원으로 입력해 주세요.';return;}values[key]=raw===''?null:Number(raw);}const next=clone();next.monthlySettings=next.monthlySettings.filter(p=>!(p.card===cardId&&p.month===formMonth));if(values.payment!==null||values.limit!==null)next.monthlySettings.push({card:cardId,month:formMonth,...values});if(commit(next)){closeSheet();render();toast('이 달의 카드 금액을 휴대폰에 저장했어요');}};
}
function viewCard(card){filterType='';showTab('report',card);}
function categorySettings(kind,title){return `<div class="sectiontop"><h2>${title}</h2><button class="secondary small" onclick="categoryForm('${kind}')">＋ 추가</button></div><section class="panel" aria-label="${title}">${state[kind].map(c=>`<div class="settingsrow"><span>${esc(c.name)}</span><div class="rowbuttons"><button onclick="categoryForm('${kind}','${esc(c.id)}')">수정</button><button class="danger" onclick="removeCategory('${kind}','${esc(c.id)}')">삭제</button></div></div>`).join('')}</section>`;}
function settingsView(){return `<div class="sectiontop"><h2 style="font-size:24px">나에게 맞는 살림결</h2></div><p class="intro">자주 쓰는 용도와 카드를 미리 설정하세요.</p>${categorySettings('categories','일반 지출 용도')}${categorySettings('fixedCategories','고정 지출 항목')}<div class="sectiontop"><h2>카드 · 기본 알림 기준</h2><button class="secondary small" onclick="categoryForm('cards')">＋ 추가</button></div><section class="panel">${state.cards.map(c=>`<div class="settingsrow"><span>${esc(c.name)}<small>${c.limit?won(c.limit)+'원 이상이면 빨간 아이콘':'기준 알림 꺼짐'}</small></span><div class="rowbuttons"><button onclick="categoryForm('cards','${esc(c.id)}')">수정</button><button class="danger" onclick="removeCategory('cards','${esc(c.id)}')">삭제</button></div></div>`).join('')}</section><button class="secondary full" onclick="showTab('cards')">카드별·월별 결제 금액 설정하기</button><p class="hint">기록에 사용된 용도·카드는 삭제할 수 없어요. 이름을 수정하면 기존 내역에도 적용됩니다. 같은 카드사의 합계를 보려면 하나의 카드 항목으로 입력하세요.</p><div class="sectiontop"><h2>기록 보관하기</h2></div><section class="panel"><h3>내 휴대폰에 안전하게</h3><div class="local-status"><b>● ${window.Dalsseum?'휴대폰 내부 저장 사용 중':'브라우저 로컬 저장 사용 중'}</b><span>저장된 지출 ${state.entries.length}건 · 인터넷 없이 사용</span><button class="secondary small" onclick="checkLocalStorage()">저장 상태 확인</button></div><p class="intro">입력한 내역은 선택한 달력에 구분하여 이 기기에 저장돼요. 백업 파일에는 모든 달력이 포함됩니다. 앱 삭제·기기 변경 전에 백업 파일을 저장해 주세요.</p><div class="backupbuttons"><button class="primary" onclick="exportBackup()">백업 저장</button><button class="secondary" onclick="importBackup()">백업 복원</button></div><input id="backupFile" class="fileinput" type="file" accept="application/json,.json" onchange="readBrowserBackup(this)"><p class="hint">백업은 암호화되지 않은 JSON 파일입니다. 복원하면 현재 모든 달력이 백업 내용으로 교체돼요.</p></section><p class="hint" style="text-align:center;margin-top:25px">살림결 1.3.4 · 작은 기록, 편안한 한 달<br>원화(KRW) · 인터넷 연결 없이 사용</p>`;}
function openSheet(html){$('sheet').appendChild($('toast'));$('sheetContent').innerHTML=html;if(!$('sheet').open)$('sheet').showModal();$('sheetContent').scrollTop=0;syncViewport();}
function closeSheet(){if($('sheet').open)$('sheet').close();document.body.appendChild($('toast'));if(sheetReturn){const resume=sheetReturn;sheetReturn=null;resume();}}
function syncViewport(){
 const vv=window.visualViewport,height=Math.max(120,vv?vv.height:innerHeight),top=vv?vv.offsetTop:0;
 document.documentElement.style.setProperty('--sheet-height',height+'px');
 document.documentElement.style.setProperty('--sheet-top',top+'px');
 if($('sheet').open)requestAnimationFrame(keepInputVisible);
}
function keepInputVisible(){
 const el=document.activeElement,container=$('sheetContent');
 if(!$('sheet').open||!el||!container.contains(el)||!el.matches('input,select,textarea'))return;
 const r=el.getBoundingClientRect(),c=container.getBoundingClientRect();
 const top=c.top+76,bottom=c.bottom-24;
 if(r.bottom>bottom)container.scrollTop+=r.bottom-bottom;
 else if(r.top<top)container.scrollTop-=top-r.top;
}
function bindMoney(el){
 function format(event){
  if(event&&event.isComposing)return;
  const raw=el.value,caret=el.selectionStart===null?raw.length:el.selectionStart;
  if(!/^[\d,]*$/.test(raw)){el.setCustomValidity('금액은 0~9 숫자로 입력해 주세요. 소수점과 음수는 사용할 수 없어요.');el.setAttribute('aria-invalid','true');return;}
  const digits=raw.replace(/,/g,''),value=digits===''?'':won(Number(digits));
  let before=(raw.slice(0,caret).match(/\d/g)||[]).length;
  const removed=digits.length-(digits?String(Number(digits)).length:0);before=Math.max(0,before-Math.max(0,removed));
  el.value=value;
  const valid=digits===''||Ledger.moneyOK(Number(digits),true);
  el.setCustomValidity(valid?'':'금액은 999,999,999,999원 이하로 입력해 주세요.');el.setAttribute('aria-invalid',String(!valid));
  let position=0,seen=0;while(position<value.length&&seen<before){if(/\d/.test(value[position]))seen++;position++;}
  el.setSelectionRange(position,position);
 }
 el.addEventListener('input',format);el.addEventListener('compositionend',format);
}
function captureEntry(){const f=new FormData($('entryForm'));return {type:f.get('type'),date:f.get('date'),amount:String(f.get('amount')).replace(/,/g,''),category:f.get('category'),card:f.get('card'),memo:f.get('memo')};}
function addFromEntry(kind,entryId){
 const draft=captureEntry();
 const resume=(newId)=>{if(newId)draft[kind==='cards'?'card':'category']=newId;entryForm(entryId,draft);};
 categoryForm(kind,undefined,resume);
}
function sheetHead(title){return `<div class="sheethead"><h2>${title}</h2><button class="close" onclick="closeSheet()" aria-label="닫기">×</button></div>`;}
function entryForm(entryId,draft){
 const formCalendar=database.activeCalendar;
 if(entryId&&!state.entries.some(e=>e.id===entryId)){toast('이 달력의 지출을 찾을 수 없어요.');return;}
 const e=draft||state.entries.find(x=>x.id===entryId)||{date:selected,amount:'',category:state.categories[0].id,card:state.cards[0].id,memo:''};
 const initialType=Ledger.entryType(e),categoryChoices={[initialType]:e.category};
 const categoryKind=type=>type==='fixed'?'fixedCategories':'categories';
 const categoryLabel=type=>type==='fixed'?'고정 지출 항목':'지출 용도';
 openSheet(sheetHead(entryId?'지출 수정':'새 지출 기록')+`<p class="entry-calendar">${esc(calendarName())}에 기록합니다</p><form id="entryForm"><fieldset class="expense-type"><legend>지출 구분</legend><label><input type="radio" name="type" value="general" ${initialType==='general'?'checked':''}><span>일반 지출</span></label><label><input type="radio" name="type" value="fixed" ${initialType==='fixed'?'checked':''}><span>고정 지출</span></label></fieldset><label for="entryDate">지출 날짜</label><input id="entryDate" name="date" type="date" value="${e.date}" min="1900-01-01" max="2199-12-31" required><label for="amount">지출 금액 · 원</label><input id="amount" class="amount" name="amount" inputmode="numeric" type="text" pattern="[0-9,]*" maxlength="15" autocomplete="off" placeholder="0" value="${esc(e.amount!==''&&Number.isFinite(Number(e.amount))?won(Number(e.amount)):e.amount)}" required><div class="formrow"><div><label for="category" id="categoryLabel">${categoryLabel(initialType)}</label><select id="category" name="category">${options(state[categoryKind(initialType)],e.category)}</select><button type="button" id="addEntryCategory" class="add-option">${initialType==='fixed'?'＋ 항목 추가':'＋ 용도 추가'}</button></div><div><label for="card">사용 카드</label><select id="card" name="card">${options(state.cards,e.card)}</select><button type="button" class="add-option" onclick="addFromEntry('cards',${entryId?'&quot;'+esc(entryId)+'&quot;':'undefined'})">＋ 카드 추가</button></div></div><label for="memo">메모 <span class="subtle">선택</span></label><input id="memo" name="memo" maxlength="100" placeholder="어디에 썼나요?" value="${esc(e.memo)}"><p id="formError" class="error" role="alert"></p><div class="actions">${entryId?'<button type="button" class="secondary danger" id="deleteEntry">삭제</button>':''}<button type="submit" class="primary">${entryId?'수정 저장':'지출 저장'}</button></div></form>`);
 let visibleType=initialType;
 $('addEntryCategory').onclick=()=>addFromEntry(categoryKind(visibleType),entryId);
 $('entryForm').addEventListener('change',event=>{
  if(event.target.name!=='type')return;
  categoryChoices[visibleType]=$('category').value;visibleType=event.target.value;
  $('category').innerHTML=options(state[categoryKind(visibleType)],categoryChoices[visibleType]);
  $('categoryLabel').textContent=categoryLabel(visibleType);
  $('addEntryCategory').textContent=visibleType==='fixed'?'＋ 항목 추가':'＋ 용도 추가';
 });
 $('entryForm').onsubmit=ev=>{ev.preventDefault();if(database.activeCalendar!==formCalendar)return;const f=new FormData(ev.target),raw=String(f.get('amount')).replace(/,/g,''),amount=Number(raw),date=f.get('date');if(!/^\d+$/.test(raw)||!Ledger.moneyOK(amount)||!Ledger.dateOK(date)){$('formError').textContent='날짜와 금액을 확인해 주세요. 금액은 1~999,999,999,999원까지 입력할 수 있어요.';return;}
 const next=clone(),entry={id:entryId||id(),date,amount,category:f.get('category'),card:f.get('card'),memo:String(f.get('memo')).trim(),...(f.get('type')==='fixed'?{type:'fixed'}:{})};
 if(entryId){const idx=next.entries.findIndex(x=>x.id===entryId);next.entries[idx]=entry;}else next.entries.push(entry);
 if(commit(next)){selected=date;month=date.slice(0,7);pages.calendar=pages.report=1;closeSheet();render();toast('지출을 휴대폰에 저장했어요');}};
 bindMoney($('amount'));
 if(entryId)$('deleteEntry').onclick=()=>{const draft=captureEntry();confirmSheet('지출을 삭제할까요?',`${won(e.amount)}원 · ${e.date}\n삭제 후에는 되돌릴 수 없어요.`,()=>{const next=clone();next.entries=next.entries.filter(x=>x.id!==entryId);if(commit(next)){closeSheet();render();toast('지출을 삭제했어요');}},()=>entryForm(entryId,draft));};
}
function confirmSheet(title,text,action,onCancel=null){sheetReturn=onCancel;openSheet(sheetHead(title)+`<p class="confirmtext">${esc(text)}</p><div class="actions"><button class="secondary" onclick="closeSheet()">취소</button><button class="primary" id="confirmAction">확인</button></div>`);$('confirmAction').onclick=()=>{sheetReturn=null;action();};}
function categoryForm(kind,editId,resume){sheetReturn=resume?()=>resume():null;const isCard=kind==='cards',item=state[kind].find(c=>c.id===editId),title=isCard?'카드':kind==='fixedCategories'?'고정 지출 항목':'지출 용도';openSheet(sheetHead(title+' '+(item?'수정':'추가'))+`<form id="categoryForm"><label for="catName">${title} 이름</label><input id="catName" name="name" maxlength="30" required placeholder="${isCard?'예: 국민카드':kind==='fixedCategories'?'예: 인터넷 요금':'예: 문화·여가'}" value="${item?esc(item.name):''}">${isCard?`<label for="catLimit">기본 알림 기준 금액 · 원</label><input id="catLimit" name="limit" inputmode="numeric" type="text" pattern="[0-9,]*" maxlength="15" value="${item?won(item.limit):'300,000'}" required><p class="hint">월 지출 합계가 이 금액 이상이면 빨간색으로 표시해요. 월별 기준을 따로 설정할 수도 있어요.<br>0원을 입력하면 기준 알림이 꺼집니다.</p>`:''}<p class="error" id="formError" role="alert"></p><div class="actions"><button class="primary" type="submit">저장</button></div></form>`);
 $('categoryForm').onsubmit=ev=>{ev.preventDefault();const f=new FormData(ev.target),name=String(f.get('name')).trim(),raw=isCard?String(f.get('limit')).replace(/,/g,''):'0',limit=Number(raw);if(!name||name.length>30||state[kind].some(c=>c.name===name&&c.id!==editId)){$('formError').textContent='겹치지 않는 이름을 1~30자로 입력해 주세요.';return;}if(isCard&&(!/^\d+$/.test(raw)||!Ledger.moneyOK(limit,true))){$('formError').textContent='기준 금액을 0~999,999,999,999원으로 입력해 주세요.';return;}if(!item&&state[kind].length>=100){$('formError').textContent='최대 100개까지 만들 수 있어요.';return;}const next=clone(),value={id:item?item.id:id(),name};if(isCard)value.limit=limit;if(item)next[kind][next[kind].findIndex(c=>c.id===editId)]=value;else next[kind].push(value);if(commit(next)){if(resume){sheetReturn=null;render();resume(value.id);}else{closeSheet();render();}toast('설정을 저장했어요');}};
 if(isCard)bindMoney($('catLimit'));
}
function removeCategory(kind,removeId){const inUse=state.entries.some(e=>kind==='cards'?e.card===removeId:e.category===removeId&&Ledger.entryType(e)===(kind==='fixedCategories'?'fixed':'general'));if(inUse){toast('기록에 사용 중이에요. 해당 지출을 수정한 뒤 삭제해 주세요.');return;}if(state[kind].length<=1){toast('항목은 최소 1개가 필요해요.');return;}const c=state[kind].find(c=>c.id===removeId);confirmSheet('항목을 삭제할까요?',c.name,()=>{const next=clone();next[kind]=next[kind].filter(c=>c.id!==removeId);if(kind==='cards')next.monthlySettings=next.monthlySettings.filter(p=>p.card!==removeId);if(commit(next)){if(kind==='cards'&&filterCard===removeId)filterCard='';closeSheet();render();toast('항목을 삭제했어요');}});}
function exportBackup(){const raw=JSON.stringify(database,null,2);if(window.Dalsseum){Dalsseum.backup(raw);return;}const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='dalsseum-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function importBackup(){if(window.Dalsseum)Dalsseum.restore();else $('backupFile').click();}
async function readBrowserBackup(input){
 try{const file=input.files[0];if(!file)return;if(file.size>50*1024*1024){toast('50MB 이하 파일을 선택해 주세요.');return;}receiveBackup(await file.text());}
 catch(e){toast('백업 파일을 읽지 못했어요. 파일 권한을 확인해 주세요.');}
 finally{input.value='';}
}
function receiveBackup(raw){
 let next;try{next=Ledger.validateBook(JSON.parse(raw));}catch(e){toast('복원 실패: '+(e instanceof SyntaxError?'JSON 파일을 확인해 주세요.':e.message));return;}
 const count=next.calendars.reduce((sum,c)=>sum+c.ledger.entries.length,0);
 confirmSheet('모든 달력을 복원할까요?',`달력 ${next.calendars.length}개 · 지출 ${count}건\n현재 모든 달력을 이 백업으로 교체합니다. 먼저 현재 기록을 백업해 두세요.`,()=>{
  if(persistBook(next,true)){resetCalendarView();closeSheet();render();toast('달력 백업을 복원했어요');}
 });
}
function checkLocalStorage(){let ok=false;try{if(window.Dalsseum)ok=Dalsseum.checkStorage();else{const key='dalsseum-storage-probe',value=String(Date.now());localStorage.setItem(key,value);ok=localStorage.getItem(key)===value;localStorage.removeItem(key);}}catch(e){}toast(ok?'로컬 저장 정상 · 입력한 내역은 저장 후 보관됩니다':'저장 상태를 확인하지 못했어요. 저장 공간을 확인해 주세요.');}
function handleBack(){if($('sheet').open){closeSheet();return true;}if(tab!=='calendar'){showTab('calendar');return true;}return false;}
$('sheet').addEventListener('cancel',e=>{e.preventDefault();closeSheet();});
window.addEventListener('resize',syncViewport);if(window.visualViewport){visualViewport.addEventListener('resize',syncViewport);visualViewport.addEventListener('scroll',syncViewport);}
document.addEventListener('focusin',()=>{syncViewport();setTimeout(keepInputVisible,180);setTimeout(keepInputVisible,400);});
document.addEventListener('input',()=>requestAnimationFrame(keepInputVisible));
$('sheet').addEventListener('click',e=>{if(e.target===$('sheet')){const r=$('sheet').getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)closeSheet();}});
render();
if(storageError){openSheet(sheetHead('저장된 기록 확인이 필요해요')+'<p class="confirmtext">저장된 데이터를 읽지 못했어요. 원본 보호를 위해 입력을 잠갔습니다. 앱을 다시 실행하거나 보관한 백업을 복원해 주세요.</p><button class="primary full" onclick="importBackup()">백업 복원</button>');}

