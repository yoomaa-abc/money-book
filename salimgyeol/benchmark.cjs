const L=require('./assets/model.js');
const {performance}=require('node:perf_hooks');
const s=L.defaults();
s.categories=Array.from({length:100},(_,i)=>({id:'cat'+i,name:'용도'+i}));
s.cards=Array.from({length:100},(_,i)=>({id:'card'+i,name:'카드'+i,limit:300000}));
s.entries=Array.from({length:50000},(_,i)=>({id:'e'+String(i).padStart(8,'0'),date:'2026-10-'+String(i%31+1).padStart(2,'0'),amount:1000+(i%100)*100,category:'cat'+i%100,card:'card'+i%100,memo:'성능 검증용'}));
const runs=[];
for(let i=0;i<7;i++){
 const t=performance.now();
 const index=L.summarize?L.summarize(s,'2026-10'):undefined;
 const es=L.monthly(s,'2026-10','','',index);
 const sums=s.cards.map(c=>L.cardState(s,'2026-10',c.id,index).sum);
 const days=Array.from({length:31},(_,d)=>index?index.byDay.get('2026-10-'+String(d+1).padStart(2,'0')).sum:L.total(es.filter(e=>e.date==='2026-10-'+String(d+1).padStart(2,'0'))));
 if(sums.reduce((a,b)=>a+b,0)!==297500000||days.reduce((a,b)=>a+b,0)!==297500000)throw Error('Aggregate mismatch');
 runs.push(performance.now()-t);
}
runs.sort((a,b)=>a-b);console.log(JSON.stringify({entries:50000,cards:100,medianMs:Number(runs[3].toFixed(2)),runs:runs.map(n=>Number(n.toFixed(2)))}));
