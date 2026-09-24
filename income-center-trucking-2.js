function renderAll(){
  renderSelects();renderSettings();renderTasks();renderYear();
  const rr=monthRecords();
  const received=rr.reduce((a,r)=>a+Number(r.gross||0),0),pending=rr.reduce((a,r)=>a+Number(r.pendingAmount||0),0),
        net=rr.reduce((a,r)=>a+Number(r.netDeposit||0),0),processing=rr.filter(r=>r.depositStatus==='En proceso').reduce((a,r)=>a+Number(r.netDeposit||0),0),
        feesTotal=rr.reduce((a,r)=>a+Number(r.producerFee||0),0);
  $('summaryTitle').textContent='Resumen · '+new Intl.DateTimeFormat('es',{month:'long',year:'numeric'}).format(new Date(Number($('yearSelect').value),Number($('monthSelect').value)-1,1));
  $('kReceived').textContent=money(received);$('kPending').textContent=money(pending);$('kProcessing').textContent=money(processing);$('kNet').textContent=money(net);
  $('heroReceived').textContent=money(received);$('heroPending').textContent=money(pending);$('heroProcessing').textContent=money(processing);$('heroNet').textContent=money(net);$('heroFees').textContent=money(feesTotal);
  const prevKey=previousMonthKey();
  const prevReceived=state.records.filter(r=>(r.paymentDate||'').slice(0,7)===prevKey).reduce((a,r)=>a+Number(r.gross||0),0);
  const diffPct=prevReceived>0?((received-prevReceived)/prevReceived*100):null;
  const cmp=$('receivedCompare');
  if(diffPct===null){
    cmp.textContent='Sin base anterior';
    cmp.className='compare-pill compare-flat';
    $('heroCompare').textContent='Sin base anterior';
    $('heroCompare').className='hero-badge';
  }else if(Math.abs(diffPct)<0.05){
    cmp.textContent='0.0% vs. '+monthLabelFromKey(prevKey);
    cmp.className='compare-pill compare-flat';
    $('heroCompare').textContent='0.0% vs. '+monthLabelFromKey(prevKey);
    $('heroCompare').className='hero-badge';
  }else if(diffPct>0){
    cmp.textContent='↑ +'+diffPct.toFixed(1)+'% vs. '+monthLabelFromKey(prevKey);
    cmp.className='compare-pill compare-up';
    $('heroCompare').textContent='↑ +'+diffPct.toFixed(1)+'% vs. '+monthLabelFromKey(prevKey);
    $('heroCompare').className='hero-badge positive';
  }else{
    cmp.textContent='↓ '+diffPct.toFixed(1)+'% vs. '+monthLabelFromKey(prevKey);
    cmp.className='compare-pill compare-down';
    $('heroCompare').textContent='↓ '+diffPct.toFixed(1)+'% vs. '+monthLabelFromKey(prevKey);
    $('heroCompare').className='hero-badge negative';
  }
  $('receivedPrev').textContent='Mes pasado: '+money(prevReceived);
  $('heroPrev').textContent='Mes pasado: '+money(prevReceived);
  $('aCarrier').textContent=rr.filter(r=>r.carrierStatus==='Pendiente'&&r.carrierDue&&days(r.carrierDue)<0).length;
  $('aDeferred').textContent=rr.flatMap(r=>r.installments||[]).filter(i=>!i.paid&&days(i.date)<=7).length;
  $('aProcessing').textContent=rr.filter(r=>r.depositStatus==='En proceso').length;
  $('aTasks').textContent=state.tasks.filter(t=>!t.done).length;
  $('movements').innerHTML=rr.slice().reverse().slice(0,8).map(r=>`<tr>
<td><span class="clickable" data-open="${r.id}">${r.client}</span></td><td><span class="clickable" data-open="${r.id}">${r.invoice}</span></td><td>${r.producer}</td><td>${r.method}</td>
<td class="money">${money(r.gross)}</td><td>${money(r.producerFee)}</td><td>${money(r.processorFee)}</td><td class="money">${money(r.netDeposit)}</td>
<td>${r.depositStatus==='Depositado'?'<span class="badge b-ok">Depositado</span>':'<span class="badge b-proc">En proceso</span>'}</td>
<td>${r.carrierStatus==='Pagado'?'<span class="badge b-ok">Pagado</span>':r.carrierStatus==='Pendiente'?'<span class="badge b-proc">Pendiente</span>':'<span class="badge b-blue">N/A</span>'}</td>
<td><button class="linkbtn" data-edit="${r.id}">Editar</button></td></tr>`).join('')||'<tr><td colspan="11">Sin registros</td></tr>';
  $('incomeBody').innerHTML=rr.map(r=>`<tr><td>${r.paymentDate}</td><td><span class="clickable" data-open="${r.id}">${r.client}</span></td><td>${r.company||''}</td><td><span class="clickable" data-open="${r.id}">${r.invoice}</span></td><td>${r.producer}</td><td>${r.method}</td><td>${money(r.gross)}</td><td>${money(r.producerFee)}</td><td>${money(r.netDeposit)}</td><td>${r.depositStatus}</td><td><button class="linkbtn" data-edit="${r.id}">Editar</button></td></tr>`).join('')||'<tr><td colspan="11">Sin registros</td></tr>';
  let di=rr.flatMap(r=>(r.installments||[]).map(i=>({...i,client:r.client,invoice:r.invoice}))).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  $('deferred').innerHTML=di.slice(0,6).map(i=>`<tr><td><span class="clickable">${i.client}</span></td><td>${i.invoice}</td><td>${i.date}</td><td class="money">${money(i.amount)}</td><td>${i.paid?'<span class="badge b-ok">Pagado</span>':days(i.date)<0?'<span class="badge b-late">Vencido</span>':'<span class="badge b-proc">'+days(i.date)+' días</span>'}</td></tr>`).join('')||'<tr><td colspan="5">Sin diferidos</td></tr>';
  $('deferredAllBody').innerHTML=$('deferred').innerHTML;
  $('carrierBody').innerHTML=rr.filter(r=>r.carrierAmount>0).map(r=>`<tr><td>${r.client}</td><td>${r.invoice}</td><td>${r.carrierName}</td><td>${money(r.carrierAmount)}</td><td>${r.carrierDue||''}</td><td>${r.carrierStatus}</td></tr>`).join('')||'<tr><td colspan="6">Sin obligaciones</td></tr>';
  let agg={};rr.forEach(r=>{agg[r.producer]??={n:0,f:0};agg[r.producer].n++;agg[r.producer].f+=Number(r.producerFee||0)});
  $('feesBody').innerHTML=Object.entries(agg).map(([p,x])=>`<tr><td>${p}</td><td>${x.n}</td><td>${money(x.f)}</td><td>${money(x.n?x.f/x.n:0)}</td></tr>`).join('')||'<tr><td colspan="4">Sin fees</td></tr>';
  renderAnalytics();
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openRecordDetail(b.dataset.open)));
  document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editRecord(b.dataset.edit)));
}