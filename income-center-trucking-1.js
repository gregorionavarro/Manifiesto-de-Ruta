let manualFee=false,editingId=null;
const TODAY=new Date('2026-09-23T12:00:00');
const $=id=>document.getElementById(id);
const state={
  producers:JSON.parse(localStorage.getItem('tm_prod_v13')||'["Greg","Carlos","Paulina","Fabiola"]'),
  carriers:JSON.parse(localStorage.getItem('tm_car_v13')||'["Imperial PFS","Great West","RPS"]'),
  tasks:JSON.parse(localStorage.getItem('tm_tasks_v13')||'[]'),
  records:JSON.parse(localStorage.getItem('tm_rec_v13')||'[]')
};
function uid(){return Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4)}
function money(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0))}
function num(id){return Number($(id).value||0)}
function persist(){localStorage.setItem('tm_prod_v13',JSON.stringify(state.producers));localStorage.setItem('tm_car_v13',JSON.stringify(state.carriers));localStorage.setItem('tm_tasks_v13',JSON.stringify(state.tasks));localStorage.setItem('tm_rec_v13',JSON.stringify(state.records))}
function toast(m){const t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(window._tt);window._tt=setTimeout(()=>t.style.display='none',2200)}
function days(d){if(!d)return 999;return Math.round((new Date(d+'T12:00:00')-TODAY)/86400000)}
function currentMonth(){return $('yearSelect').value+'-'+$('monthSelect').value}
function monthRecords(){return state.records.filter(r=>(r.paymentDate||'').slice(0,7)===currentMonth())}
function switchView(id,btn){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderAll()}
function closeRegister(){$('registerModal').classList.remove('open')}
function renderSelects(){
  $('producer').innerHTML=state.producers.map(x=>`<option>${x}</option>`).join('');
  $('carrierName').innerHTML='<option></option>'+state.carriers.map(x=>`<option>${x}</option>`).join('');
}
function previousMonthKey(){
  let y=Number($('yearSelect').value), m=Number($('monthSelect').value);
  m--;
  if(m===0){m=12;y--;}
  return y+'-'+String(m).padStart(2,'0');
}
function monthLabelFromKey(key){
  const [y,m]=key.split('-').map(Number);
  return new Intl.DateTimeFormat('es',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));
}
function last12MonthRecords(){
  const endY=Number($('yearSelect').value), endM=Number($('monthSelect').value);
  const endIndex=endY*12+(endM-1);
  return state.records.filter(r=>{
    const p=(r.paymentDate||'').slice(0,7);
    if(!p) return false;
    const [y,m]=p.split('-').map(Number);
    const idx=y*12+(m-1);
    return idx<=endIndex && idx>=endIndex-11;
  });
}
function renderRanking(containerId, items, green=false){
  const el=$(containerId);
  if(!items.length){el.innerHTML='<div class="analytics-empty">Aún no hay pagos marcados como pagados para este período. Registra pagos a Carrier / MGA / PFA para ver este ranking.</div>';return}
  const max=Math.max(...items.map(x=>x.value),1);
  el.innerHTML=items.slice(0,5).map(x=>`
    <div class="rank-row">
      <div class="rank-name">${x.name}</div>
      <div class="rank-track"><div class="rank-fill ${green?'green':''}" style="width:${Math.max(5,(x.value/max*100))}%"></div></div>
      <div class="rank-value">${money(x.value)}</div>
    </div>`).join('');
}
function renderAnalytics(){
  const hist=last12MonthRecords();
  const carrierAgg={};
  hist.forEach(r=>{
    if(r.carrierStatus==='Pagado' && Number(r.carrierAmount||0)>0){
      const name=r.carrierName||'Sin nombre';
      carrierAgg[name]=(carrierAgg[name]||0)+Number(r.carrierAmount||0);
    }
  });
  const carrierItems=Object.entries(carrierAgg).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  renderRanking('carrierAnalytics',carrierItems,false);
  const prodAgg={};
  hist.forEach(r=>{
    const name=r.producer||'Sin Producer';
    prodAgg[name]=(prodAgg[name]||0)+Number(r.producerFee||0);
  });
  const prodItems=Object.entries(prodAgg).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  renderRanking('producerAnalytics',prodItems,true);
  if(prodItems.length){
    $('insightProducer').textContent=prodItems[0].name;
    $('insightProducerSub').textContent=money(prodItems[0].value)+' en fees acumulados.';
  }else{
    $('insightProducer').textContent='—';
    $('insightProducerSub').textContent='Sin datos todavía.';
  }
  if(carrierItems.length){
    $('insightCarrier').textContent=carrierItems[0].name;
    $('insightCarrierSub').textContent=money(carrierItems[0].value)+' pagados en 12 meses.';
  }else{
    $('insightCarrier').textContent='—';
    $('insightCarrierSub').textContent='Sin pagos registrados.';
  }
  const methodAgg={};
  hist.forEach(r=>{const name=r.method||'Sin método'; methodAgg[name]=(methodAgg[name]||0)+Number(r.gross||0);});
  const methodItems=Object.entries(methodAgg).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  if(methodItems.length){
    const total=methodItems.reduce((a,x)=>a+x.value,0)||1;
    $('insightMethod').textContent=methodItems[0].name;
    $('insightMethodSub').textContent=(methodItems[0].value/total*100).toFixed(1)+'% del total cobrado.';
  }else{
    $('insightMethod').textContent='—';
    $('insightMethodSub').textContent='Sin transacciones todavía.';
  }
  const alertsCount=Number($('aCarrier').textContent||0)+Number($('aDeferred').textContent||0)+Number($('aProcessing').textContent||0);
  $('insightAlerts').textContent=String(alertsCount);
  $('insightAlertsSub').textContent=alertsCount?'Requieren revisión operativa.':'Sin alertas críticas.';
}