/* Numeric answers and source-backed reading lessons. No expression evaluation. */
function parseNumber(text) {
  let value=String(text).trim().replaceAll('−','-');
  const percentage=value.endsWith('%');if(percentage)value=value.slice(0,-1).trim();
  const atom='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
  if(!new RegExp(`^${atom}(?:\\s*/\\s*${atom})?$`).test(value))throw Error('Enter a number, fraction such as 3/10, or percentage such as 30%.');
  const parts=value.split('/').map(Number);
  if(parts.length===2 && parts[1]===0)throw Error('A fraction cannot have a zero denominator.');
  const number=(parts.length===2?parts[0]/parts[1]:parts[0])/(percentage?100:1);
  if(!Number.isFinite(number))throw Error('Enter a finite number.');return number;
}
function numericInputs() {
  const values=entry(current.id).numericAnswers||[];
  $('#numeric-wrap').innerHTML=current.numericFields.map((f,i)=>`<label>${esc(f.label)}<input type="text" data-number="${i}" value="${esc(values[i]||'')}" placeholder="e.g. 3/10, 0.3, or 30%" autocomplete="off" spellcheck="false"></label>`).join('')+'<p class="section-caption">Only the final value is required. Fractions, decimals, and percentages are accepted. Ordinary answers use absolute tolerance 0.00001; approximation questions specify their tolerance below.</p>'+current.numericFields.filter(f=>f.tolerance!==1e-5).map(f=>`<p class="section-caption">${esc(f.label)}: absolute tolerance ${f.tolerance}.</p>`).join('');
  if(entry(current.id).answer?.trim())$('#numeric-wrap').innerHTML+=`<details><summary>Previous written attempt (saved)</summary><p style="white-space:pre-wrap">${esc(entry(current.id).answer)}</p></details>`;
}
function checkNumbers() {
  snapshotDraft();const e=entry(current.id);let all=true;
  const rows=current.numericFields.map((field,i)=>{
    try {const value=parseNumber(e.numericAnswers[i]);const pass=Math.abs(value-field.expected)<=field.tolerance;all&&=pass;return `<div class="test-row">${pass?'✓':'✕'} ${esc(field.label)}: ${pass?'Correct':'Not quite — try again or use a hint.'}</div>`;}
    catch(err){all=false;return `<div class="test-row">${esc(field.label)}: ${esc(err.message)}</div>`;}
  });
  $('#results').innerHTML=`<div class="result-summary ${all?'passed':''}">${all?'Correct. No written steps needed.':'Check your final values.'}</div>${rows.join('')}`;
  if(all){e.numericPassed=true;e.lastReview=Date.now();e.due=Date.now()+3*DAY;e.interval=3;recordActivity(current.id);saveSoon();updateCounts();updateReviewInfo();}
}
function readingCards() {
  return `<section class="review-catalog"><h2>Read & review</h2><p class="section-caption">Green Book readings open the actual pages from your local PDF. ML/DL lessons are original review notes with textbook references. Mark readings reviewed independently of question completion.</p><div class="resource-grid">${(boot.readings||[]).map(r=>`<article class="panel resource"><div class="eyebrow">${esc(r.kind)} ${state.readings[r.id]?'· REVIEWED ✓':''}</div><h3>${esc(r.title)}</h3><p>${esc(r.source)}</p><button class="secondary" data-reading="${r.id}">Read section →</button></article>`).join('')}</div></section>`;
}
let activeReading=null;
function openReading(id) {
  const r=(boot.readings||[]).find(r=>r.id===id);if(!r)return;
  activeReading=r;$('#reading-title').textContent=r.title;
  const available=r.book&&boot.books[r.book];
  $('#reading-content').innerHTML=`<p class="section-caption">${esc(r.source)}</p>${r.sections.map(s=>`<section><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></section>`).join('')}${r.book?(available?`<a href="${window.PrepPlatform?.bookUrl(r.book)||`/api/book/${r.book}`}#page=${r.page}" target="_blank" rel="noopener">Open these book pages in a separate tab ↗</a><iframe class="book-reader" title="${esc(r.title)} — local Green Book PDF" src="${window.PrepPlatform?.bookUrl(r.book)||`/api/book/${r.book}`}#page=${r.page}&view=FitH"></iframe>`:`<div class="error-banner">Your Green Book PDF is unavailable here. ${window.PrepPlatform?.static?'Choose it on this device below; the file is not uploaded.':'Set PREP_GREEN_BOOK to its path and restart the server.'} The reading guide and related practice still work. ${deviceBookControls()}</div>`):''}<h2>Related practice</h2><div class="reading-practice">${r.practice.filter(id=>byId.has(id)).map(id=>`<button class="secondary" data-reading-practice="${id}">${esc(byId.get(id).title)} →</button>`).join('')}</div><button id="mark-reading" class="primary">${state.readings[id]?'Reviewed ✓ · Mark reviewed again':'Mark section reviewed ✓'}</button>`;
  if(!$('#reading-dialog').open)$('#reading-dialog').showModal();$('#reading-dialog').scrollTop=0;
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.reading)openReading(button.dataset.reading);
  if(button.dataset.readingPractice){$('#reading-dialog').close();openProblem(button.dataset.readingPractice);}
  if(button.id==='close-reading'){$('#reading-dialog').close();if(view==='resources')render();}
  if(button.id==='mark-reading'&&activeReading){state.readings[activeReading.id]={reviewed:Date.now()};saveSoon();button.textContent='Reviewed ✓';toast('Reading review saved.');}
});
document.addEventListener('input',event=>{if(event.target.dataset.number!==undefined)snapshotDraft();});
