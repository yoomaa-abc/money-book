(function(root){
 'use strict';
 const MAX=999999999999;
 const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
 const fixedDefaults=()=>[{id:'maintenance',name:'관리비'},{id:'electricity',name:'전기요금'},{id:'hipass',name:'하이패스'},{id:'fuel',name:'주유비'},{id:'insurance',name:'보험금'},{id:'dues',name:'모임회비'}];
 const entryType=entry=>entry.type==='fixed'?'fixed':'general';
 const categoryKey=entry=>entryType(entry)==='fixed'?'fixed:'+entry.category:entry.category;
 const defaults=()=>({
  version:1,
  categories:[{id:'food',name:'식비'},{id:'cafe',name:'카페·간식'},{id:'shop',name:'쇼핑'},{id:'traffic',name:'교통'},{id:'home',name:'생활'},{id:'health',name:'건강'},{id:'etc',name:'기타'}],
  fixedCategories:fixedDefaults(),
  cards:[{id:'shinhan',name:'신한카드',limit:300000},{id:'samsung',name:'삼성카드',limit:300000},{id:'hyundai',name:'현대카드',limit:300000}],
  entries:[],monthlySettings:[]
 });
 function dateOK(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number);
  return y>=1900&&y<=2199&&m>=1&&m<=12&&d>=1&&d<=new Date(y,m,0).getDate();
 }
 function moneyOK(value,zero=false){return Number.isSafeInteger(value)&&value>=(zero?0:1)&&value<=MAX;}
 function validate(source){
  if(!source||source.version!==1||!Array.isArray(source.categories)||!Array.isArray(source.cards)||!Array.isArray(source.entries)||source.entries.length>50000)throw Error('살림결 백업 파일 형식이 아니에요.');
  const references={},fixedCategories=source.fixedCategories===undefined?fixedDefaults():source.fixedCategories;
  for(const [key,items] of [['categories',source.categories],['fixedCategories',fixedCategories],['cards',source.cards]]){
   if(!Array.isArray(items)||!items.length||items.length>100)throw Error('카테고리 개수를 확인해 주세요.');
   const ids=new Set(),names=new Set();
   for(const item of items){
    if(!item||!safeId(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>30||names.has(item.name.trim())||(key==='cards'&&!moneyOK(item.limit,true)))throw Error('카테고리 정보가 올바르지 않아요.');
    ids.add(item.id);names.add(item.name.trim());
   }
   references[key]=ids;
  }
  const entryIds=new Set();let sum=0;
  for(const entry of source.entries){
   if(!entry||!safeId(entry.id)||entryIds.has(entry.id)||!dateOK(entry.date)||!moneyOK(entry.amount)||(entry.type!==undefined&&entry.type!=='general'&&entry.type!=='fixed')||!references[entryType(entry)==='fixed'?'fixedCategories':'categories'].has(entry.category)||!references.cards.has(entry.card)||typeof entry.memo!=='string'||entry.memo.length>100)throw Error('지출 내역이 올바르지 않아요.');
   entryIds.add(entry.id);sum+=entry.amount;
   if(!Number.isSafeInteger(sum))throw Error('총금액이 처리 범위를 초과했어요.');
  }
  const plans=source.monthlySettings===undefined?[]:source.monthlySettings;
  if(!Array.isArray(plans)||plans.length>12000)throw Error('월별 카드 설정을 확인해 주세요.');
  const planIds=new Set();
  for(const plan of plans){
   if(!plan||!references.cards.has(plan.card)||typeof plan.month!=='string'||!dateOK(plan.month+'-01')||(plan.payment!==null&&!moneyOK(plan.payment,true))||(plan.limit!==null&&!moneyOK(plan.limit,true))||planIds.has(plan.card+':'+plan.month))throw Error('월별 카드 금액이 올바르지 않아요.');
   planIds.add(plan.card+':'+plan.month);
  }
  return {
   version:1,
   categories:source.categories.map(c=>({id:c.id,name:c.name.trim()})),
   fixedCategories:fixedCategories.map(c=>({id:c.id,name:c.name.trim()})),
   cards:source.cards.map(c=>({id:c.id,name:c.name.trim(),limit:c.limit})),
   entries:source.entries.map(e=>({id:e.id,date:e.date,amount:e.amount,category:e.category,card:e.card,memo:e.memo,...(entryType(e)==='fixed'?{type:'fixed'}:{})})),
   monthlySettings:plans.map(p=>({card:p.card,month:p.month,payment:p.payment,limit:p.limit}))
  };
 }
 const total=entries=>entries.reduce((sum,entry)=>sum+entry.amount,0);
 // One shared month index per render; no cache of mutable ledger data.
 function summarize(state,month){
  const entries=state.entries.filter(e=>e.date.slice(0,7)===month).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  const byDay=new Map(),byCategory=new Map(),byCard=new Map();let sum=0;
  for(const entry of entries){
   sum+=entry.amount;
   let day=byDay.get(entry.date);
   if(!day){day={sum:0,entries:[],generalCount:0,generalSum:0,fixedCount:0,fixedSum:0};byDay.set(entry.date,day);}
   day.sum+=entry.amount;day.entries.push(entry);
   if(entryType(entry)==='fixed'){day.fixedCount++;day.fixedSum+=entry.amount;}else{day.generalCount++;day.generalSum+=entry.amount;}
   const key=categoryKey(entry);
   byCategory.set(key,(byCategory.get(key)||0)+entry.amount);
   byCard.set(entry.card,(byCard.get(entry.card)||0)+entry.amount);
  }
  return {state,month,entries,sum,byDay,byCategory,byCard,categories:new Map(state.categories.map(c=>[c.id,c])),fixedCategories:new Map((state.fixedCategories||fixedDefaults()).map(c=>[c.id,c])),cards:new Map(state.cards.map(c=>[c.id,c])),plans:new Map((state.monthlySettings||[]).filter(p=>p.month===month).map(p=>[p.card,p]))};
 }
 function monthIndex(state,month,index){return index&&index.state===state&&index.month===month?index:summarize(state,month);}
 function monthly(state,month,category='',card='',index,type=''){
  const entries=monthIndex(state,month,index).entries;
  return !category&&!card&&!type?entries:entries.filter(e=>(!category||categoryKey(e)===category)&&(!card||e.card===card)&&(!type||entryType(e)===type));
 }
 function cardState(state,month,id,index){
  const data=monthIndex(state,month,index),card=data.cards.get(id),plan=data.plans.get(id),sum=data.byCard.get(id)||0;
  const limit=plan&&plan.limit!==null?plan.limit:card.limit;
  return {sum,limit,payment:plan?plan.payment:null,overridden:!!plan&&plan.limit!==null,reached:limit>0&&sum>=limit,ratio:limit>0?Math.min(1,sum/limit):0};
 }
 function bookDefaults(){
  return {version:3,activeCalendar:'home',calendars:[
   {id:'home',name:'집안 가계부',ledger:defaults()},
   {id:'date',name:'데이트비용',ledger:defaults()},
   {id:'group',name:'모임 지출',ledger:defaults()}
  ]};
 }
 function validateBook(source){
  // Upgrade previous installations/backups without mixing their records with new calendars.
  if(source&&source.version===1)return {version:3,activeCalendar:'home',calendars:[{id:'home',name:'집안 가계부',ledger:validate(source)}]};
  if(!source||(source.version!==2&&source.version!==3)||!Array.isArray(source.calendars)||!source.calendars.length)throw Error('달력 가계부 백업 형식을 확인해 주세요.');
  const ids=new Set(),names=new Set();
  const calendars=source.calendars.map(c=>{
   if(!c||!safeId(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>30||names.has(c.name.trim()))throw Error('달력 이름과 정보를 확인해 주세요.');
   ids.add(c.id);names.add(c.name.trim());
   return {id:c.id,name:c.name.trim(),ledger:validate(c.ledger)};
  });
  if(!ids.has(source.activeCalendar))throw Error('선택한 달력을 찾을 수 없어요.');
  return {version:3,activeCalendar:source.activeCalendar,calendars};
 }
 function activeLedger(book){return book.calendars.find(c=>c.id===book.activeCalendar).ledger;}
 const api={defaults,validate,dateOK,moneyOK,monthly,total,cardState,summarize,bookDefaults,validateBook,activeLedger,entryType,categoryKey,MAX};
 if(typeof module!=='undefined')module.exports=api;else root.Ledger=api;
})(this);
