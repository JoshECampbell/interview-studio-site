'use strict';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY = 86400000;
const STORAGE = 'interview-studio-v1';
let boot, problems = [], byId, state, current = null, view = 'home', tab = 'prompt', hints = 0;
let editor, changingEditor = false, solutionRevealed = false, assessing = false, runBusy = false;
let saveTimer, saveChain = Promise.resolve(), toastTimer;
const filters = {search:'', topic:'all', type:'all', status:'all', level:'all'};
const topicOrder = ['Calculus','Linear algebra','Probability','Stochastic processes','Numerical methods','ML foundations','Deep learning','ML practice','Python / DSA','NumPy','PyTorch','SQL','Finance (optional)'];
const learningPaths = [
  ['Math foundations',['Calculus','Linear algebra','Numerical methods']],
  ['Probability & processes',['Probability','Stochastic processes']],
  ['Machine learning',['ML foundations','ML practice']],
  ['Deep learning',['Deep learning']],
  ['Python & ML coding',['Python / DSA','NumPy','PyTorch']]
];

function toast(message) {
  $('#toast').textContent = message; $('#toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 3500);
}
function entry(id) { return state.items[id] || (state.items[id] = {}); }
function completed(p) { const e=entry(p.id); return p.type==='coding' ? !!e.passed : p.answerFormat==='numeric' ? !!e.numericPassed : ['good','mastered'].includes(e.rating); }
function due(p) { return !!entry(p.id).due && entry(p.id).due <= Date.now(); }
function dateKey(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function recordActivity(id) { const key=dateKey(); state.activity[key] ||= []; if(!state.activity[key].includes(id)) state.activity[key].push(id); }
function saveSoon() {
  state.updated = Date.now();
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); $('#save-status').textContent='Saved in browser · syncing…'; }
  catch { $('#save-status').textContent='Browser backup unavailable · syncing…'; }
  clearTimeout(saveTimer); saveTimer=setTimeout(flushSave,400);
}
function flushSave() {
  clearTimeout(saveTimer);
  const payload=JSON.stringify(state);
  saveChain=saveChain.catch(()=>{}).then(async()=>{
    try { await api('/api/state',JSON.parse(payload)); $('#save-status').textContent=window.PrepPlatform?.static?'Saved in this browser ✓':'Saved on this computer ✓'; }
    catch { $('#save-status').textContent=window.PrepPlatform?.static?'Browser storage unavailable · export progress':'Server offline · browser backup only'; toast(window.PrepPlatform?.static?'Could not save in this browser. Export progress to retain your work.':'Could not sync to disk. Your browser backup is retained.'); }
  });
  return saveChain;
}
async function api(path,body) {
  if(window.PrepPlatform?.static)return window.PrepPlatform.api(path,body);
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Prep-Token':boot.token},body:JSON.stringify(body)});
  const data=await response.json(); if(!response.ok) throw new Error(data.error || 'Request failed'); return data;
}
function statusPill(p) {
  const e=entry(p.id);
  if(due(p)) return '<span class="pill warn">Due for review</span>';
  if(completed(p)) return `<span class="pill solved">${p.type==='coding'?'Checks passed':p.answerFormat==='numeric'?'Answer checked':'Self-reviewed'}</span>`;
  if(e.answer?.trim() || e.numericAnswers?.some(v=>v.trim()) || (p.type==='coding'&&e.attempts>0)) return '<span class="pill warn">In progress</span>';
  if(e.rating==='again') return '<span class="pill warn">Learning</span>';
  return '<span class="pill">Not started</span>';
}
function row(p,index) {
  return `<button class="problem-row" data-open="${p.id}"><span class="num">${String(index+1).padStart(2,'0')}</span><span class="row-text"><strong>${esc(p.title)}</strong><span class="sub">${esc(p.topic)} · ${p.minutes} min</span></span><span class="pill ${p.type==='coding'?'code':''}">${p.type==='coding'?'Code':'Theory'}</span><span class="arrow">↗</span></button>`;
}
function eligible() { return problems.filter(p=>p.topic!=='Finance (optional)'); }
function priority(p) { return due(p)?0:!entry(p.id).lastReview?1:!completed(p)?2:3; }
function recommended(type='all') {
  return eligible().filter(p=>type==='all'||p.type===type).sort((a,b)=>priority(a)-priority(b)||(entry(a.id).lastReview||0)-(entry(b.id).lastReview||0));
}
function mixedQueue() {
  const first=(topics,type)=>recommended(type).find(p=>topics.includes(p.topic));
  return [first(learningPaths[0][1],'theory'),first(['Python / DSA'],'coding'),first(learningPaths[1][1],'theory'),first(['NumPy','PyTorch'],'coding'),first(['ML foundations','ML practice','Deep learning'],'theory')].filter(Boolean);
}
function navigate(next) {
  view=next; $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const label={home:'Overview',library:'Practice library',review:'Review queue',notes:'My notebook',resources:'Reading room',catalog:'More source practice',sql:'SQL from zero',probability:'Probability drills'}[view];
  $('#breadcrumb').innerHTML=`Workspace <span>/</span> ${label}`;
  $('#library-count').textContent=problems.length; $('#due-count').textContent=problems.filter(due).length;
  render();
}
function heading(kicker,title,description,actions='') {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${actions}</div>`;
}
function sessionOptions() {
  return '<div class="session-options"><select id="session-mode" class="session-select" aria-label="Session type"><option value="mixed">Mixed practice</option><option value="theory">Theory only</option><option value="coding">Coding only</option></select><button class="primary" data-action="start">Start a session ↗</button></div>';
}
function streak() {
  const d=new Date(); let n=0;
  if(!state.activity[dateKey(d)]?.length) d.setDate(d.getDate()-1);
  while(state.activity[dateKey(d)]?.length){n++;d.setDate(d.getDate()-1);} return n;
}
function renderHome() {
  const done=problems.filter(completed).length, dueCount=problems.filter(due).length;
  const todayDone=state.activity[dateKey()]?.length||0;
  const queue=mixedQueue();
  const tracks=learningPaths.map(([name,topics])=>{
    const ps=problems.filter(p=>topics.includes(p.topic)), n=ps.filter(completed).length;
    return `<div class="track" role="button" tabindex="0" data-topics="path:${esc(name)}" aria-label="Browse ${name}"><div class="track-head"><strong>${name}</strong><span>${n} / ${ps.length}</span></div><div class="progress-bar"><i style="width:${100*n/ps.length}%"></i></div></div>`;
  }).join('');
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const count=state.activity[dateKey(d)]?.length||0;return `<div title="${dateKey(d)}: ${count} reviewed"><i style="height:${Math.max(5,Math.min(65,count*10))}px"></i>${d.toLocaleDateString(undefined,{weekday:'narrow'})}</div>`;}).join('');
  return heading('A LITTLE PROGRESS, EVERY DAY','Make room for your next role.','Build intuition. Write it out. Put your code to the test.',sessionOptions())+
    `<section class="hero"><div><div class="eyebrow">YOUR DAILY PRACTICE</div><h2>Think it through.<br>Then make it work.</h2><p>A focused mix of quantitative foundations, ML concepts, and hands-on Python. Five questions, at your own pace.</p><button class="primary" data-action="${state.session?.ids?.length?'resume':'start'}">${state.session?.ids?.length?'Resume your session':'Begin mixed practice'} <span>→</span></button></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="math">∇L(θ)</div><small>one step at a time.</small></div></section>`+
    `<section class="stats" aria-label="Progress"><div class="stat"><div class="label">Questions completed <span class="stat-icon">◫</span></div><strong>${done}<span style="font-size:14px;color:#9eaa94"> / ${problems.length}</span></strong><small>Numbers checked · concepts self-reviewed</small></div><div class="stat"><div class="label">Ready to revisit <span class="stat-icon">↻</span></div><strong>${dueCount}</strong><small>Keep the concepts fresh</small></div><div class="stat"><div class="label">Current streak <span class="stat-icon">♧</span></div><strong>${streak()} <span style="font-size:14px;color:#9eaa94">days</span></strong><small>A review or passed submission counts</small></div><div class="stat"><div class="label">Today’s progress <span class="stat-icon">↗</span></div><strong>${todayDone}<span style="font-size:14px;color:#9eaa94"> / 5</span></strong><small>${todayDone>=5?'Daily goal reached. Nice work.':'Your next small step is waiting'}</small></div></section>`+
    `<div class="overview-grid"><section><div class="section-title"><h2>A good place to start</h2><button class="quiet" data-view="library">Browse all questions ↗</button></div><p class="section-caption">A little theory, a little code. Understanding comes from both.</p><div class="panel">${queue.map(row).join('')}</div><div class="note-card"><div class="eyebrow">THE PRACTICE METHOD</div><p>Try first, then compare. Every question includes concept notes, progressive hints, and a worked solution. Turn what you missed into a note for next time.</p></div></section><section><div class="section-title"><h2>Your learning paths</h2><button class="quiet" data-view="library">Explore ↗</button></div><p class="section-caption">Start with foundations. Build toward applied ML.</p><div class="panel">${tracks}</div><div class="panel" style="padding:20px;margin-top:20px"><div class="track-head"><strong>This week</strong><span>Questions reviewed</span></div><div class="activity">${days}</div></div></section></div>`;
}
function renderLibrary() {
  const review=view==='review';
  const topics=topicOrder.filter(t=>problems.some(p=>p.topic===t));
  const options=(values,selected)=>values.map(([v,l])=>`<option value="${esc(v)}" ${selected===v?'selected':''}>${esc(l)}</option>`).join('');
  const search=filters.search.toLowerCase();
  const selectedPath=learningPaths.find(([name])=>filters.topic===`path:${name}`);
  const matches=problems.filter(p=>(!review||due(p)) && (filters.level==='all'||p.difficulty===filters.level) && (filters.topic==='all'||p.topic===filters.topic||selectedPath?.[1].includes(p.topic)) && (filters.type==='all'||p.type===filters.type||(filters.type==='numeric'&&p.answerFormat==='numeric')||(filters.type==='written'&&p.type==='theory'&&p.answerFormat!=='numeric')) && `${p.title} ${p.topic} ${p.source} ${p.prompt}`.toLowerCase().includes(search) &&
    (filters.status==='all'||(filters.status==='done'&&completed(p))||(filters.status==='new'&&!completed(p)&&!entry(p.id).lastReview)||(filters.status==='saved'&&entry(p.id).bookmark)||(filters.status==='due'&&due(p))));
  const table=matches.length?`<div class="panel"><table class="library-table"><thead><tr><th class="bookmark-cell" aria-label="Bookmark"></th><th>QUESTION</th><th class="hide-mobile">FORMAT</th><th class="hide-small">LEVEL</th><th>STATUS</th><th class="hide-mobile">TIME</th></tr></thead><tbody>${matches.map(p=>`<tr><td><button class="star" data-star="${p.id}" aria-label="${entry(p.id).bookmark?'Remove bookmark':'Bookmark'} ${esc(p.title)}" aria-pressed="${!!entry(p.id).bookmark}">${entry(p.id).bookmark?'★':'☆'}</button></td><td><button class="title-button" data-open="${p.id}">${esc(p.title)}<small>${esc(p.topic)}</small></button></td><td class="hide-mobile"><span class="pill ${p.type==='coding'?'code':''}">${p.type==='coding'?(p.language==='sql'?'SQL':'Python'):p.answerFormat==='numeric'?'Number / fraction':'Written answer'}</span></td><td class="hide-small">${esc(p.difficulty)}</td><td>${statusPill(p)}</td><td class="hide-mobile">${p.minutes} min</td></tr>`).join('')}</tbody></table></div>`:
    `<div class="panel empty">${review?'No reviews due with these filters. New questions are waiting in the practice library.':'No questions match these filters.'}<br><button class="quiet" data-action="clear-filters">Clear filters</button>${review?'<br><button class="secondary" data-view="library">Browse the library →</button>':''}</div>`;
  return heading(review?'SPACED PRACTICE':'THE PRACTICE LIBRARY',review?'Keep it fresh.':'Build understanding, one question at a time.',review?'Revisit questions when they’re due. Your answers and notes stay with each question.':'Original exercises with concept notes, hints, and step-by-step solutions.',sessionOptions())+
    `<div class="filters"><input id="search" type="search" value="${esc(filters.search)}" placeholder="Search concepts, questions, or chapters…" aria-label="Search questions"><select id="filter-topic" aria-label="Filter topic">${options([['all','All topics'],...learningPaths.map(([name])=>[`path:${name}`,`${name} path`]),...topics.map(t=>[t,t])],filters.topic)}</select><select id="filter-type" aria-label="Filter format">${options([['all','All formats'],['theory','All theory'],['numeric','Numbers / fractions'],['written','Written explanations'],['coding','Coding: Python / SQL']],filters.type)}</select><select id="filter-level" aria-label="Filter difficulty">${options([['all','All levels'],['Easy','Easy'],['Medium','Medium'],['Foundation','Foundation']],filters.level)}</select><select id="filter-status" aria-label="Filter progress">${options([['all','All progress'],['new','Not yet reviewed'],['done','Completed'],['due','Due for review'],['saved','Bookmarked']],filters.status)}</select></div><div class="count-caption">${matches.length} questions · ${review?'Again: tomorrow · Good: 3+ days · Confident: 7+ days':'Numbers are checked automatically. Written explanations use self-assessment.'}</div>${table}`;
}
function renderNotes() {
  const notes=problems.filter(p=>entry(p.id).notes?.trim());
  return heading('YOUR PERSONAL REFERENCE','What you want to remember.','Notes you write while practicing live here, linked to the question that sparked them.')+
    (notes.length?`<div class="notebook-grid">${notes.map(p=>`<article class="panel resource"><div class="eyebrow">${esc(p.topic)}</div><h3>${esc(p.title)}</h3><p class="note-preview">${esc(entry(p.id).notes)}</p><button class="quiet" data-open="${p.id}">Open question & edit notes →</button></article>`).join('')}</div>`:'<div class="panel empty">Your notebook is ready for its first idea.<br>Open a question and add a takeaway, or copy its concept explanation into your notes.<br><button class="secondary" data-view="library">Find a question →</button></div>');
}
function renderResources() {
  return hostedNotice()+heading('THE READING ROOM','Go a little deeper.','Read book sections and review lessons before you practice.')+readingCards()+
    `<div class="resource-grid"><article class="panel resource"><div class="eyebrow">QUANTITATIVE FOUNDATIONS</div><h3>The Green Book</h3><p>A Practical Guide to Quantitative Finance Interviews, Xinfeng Zhou. This app focuses on the ML-relevant topics from chapters 3 onward:</p><ul><li>Ch. 3: calculus, gradients, matrices, eigenvectors</li><li>Ch. 4: probability, Bayes, distributions, expectation</li><li>Ch. 5: Markov chains, random walks, dynamic programming</li><li>Ch. 6: optional finance applications</li><li>Ch. 7: algorithms, Monte Carlo, finite differences</li></ul>${boot.books.green?`<a href="${window.PrepPlatform?.bookUrl('green')||'/api/book/green'}" target="_blank" rel="noopener">Open your local PDF ↗</a>`:'<p>Choose a PDF below to read on this device, or configure PREP_GREEN_BOOK when using the Python server.</p>'}<p>Prompts and explanations are newly written topic exercises, not a reproduction of the book’s question bank. Section references use printed book numbering.</p></article><article class="panel resource"><div class="eyebrow">INTRODUCTORY MACHINE LEARNING</div><h3>An Introduction to Statistical Learning</h3><p>James, Witten, Hastie, Tibshirani & Taylor. Use ISLP for approachable explanations and optional Python labs.</p><ul><li>Ch. 2–4: prediction, regression, classification</li><li>Ch. 5–6: resampling and regularization</li><li>Ch. 8: trees, forests, boosting</li><li>Ch. 10: neural networks and deep learning</li><li>Ch. 12: PCA and clustering</li></ul>${boot.books.islp?`<a href="${window.PrepPlatform?.bookUrl('islp')||'/api/book/islp'}" target="_blank" rel="noopener">Open your local PDF ↗</a>`:''}<a href="https://www.statlearning.com/" target="_blank" rel="noopener">Book & free official resources ↗</a></article><article class="panel resource"><div class="eyebrow">APPLIED ML & EVALUATION</div><h3>Build experiments you can trust</h3><p>Supplement the textbook with the scikit-learn authors’ guidance on preprocessing, leakage, and evaluation. Practice explaining the deployment scenario before choosing a metric.</p><a href="https://scikit-learn.org/stable/common_pitfalls.html" target="_blank" rel="noopener">Common pitfalls ↗</a><a href="https://scikit-learn.org/stable/modules/model_evaluation.html" target="_blank" rel="noopener">Metrics & scoring ↗</a><a href="https://numpy.org/doc/stable/user/absolute_beginners.html" target="_blank" rel="noopener">NumPy fundamentals ↗</a></article><article class="panel resource"><div class="eyebrow">HANDS-ON DEEP LEARNING</div><h3>Tensors, training, and attention</h3><p>Begin with tensor shapes and a training step. Then work through loss functions, normalization, and single-head attention. The attention paper is optional further reading, not a prerequisite.</p><a href="https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html" target="_blank" rel="noopener">PyTorch training tutorial ↗</a><a href="https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html" target="_blank" rel="noopener">Cross-entropy API ↗</a><a href="https://arxiv.org/abs/1706.03762" target="_blank" rel="noopener">Attention Is All You Need ↗</a></article><article class="panel resource"><div class="eyebrow">A SIMPLE WEEKLY RHYTHM</div><h3>Practice with intent</h3><p>Start each session with one math question, one probability question, and one ML explanation. Add a short Python problem and a tensor exercise. Try without help, reveal one hint at a time, then compare the worked solution with your attempt. Write the mistake or missing idea in your notebook.</p><p>Written explanations use self-assessment rubrics; numeric questions check the final values automatically. Coding completion means the included checks passed; tests are examples of correctness, not a proof of every possible input or complexity bound.</p></article><article class="panel resource"><div class="eyebrow">YOUR LOCAL SETUP</div><h3>Ready when you are</h3>${deviceBookControls()}<p>Python runner: ${window.PrepPlatform?.static?'on-demand local helper':'connected'}<br>NumPy: ${boot.dependencies.numpy?'available ✓':'not installed'}<br>PyTorch: ${boot.dependencies.torch?'available ✓':'not installed'}</p><p>Answers, code, notes, bookmarks, and review dates save to this computer. Export regularly to move between browsers or computers.</p><p>The runner executes your code as your local user. Run code you trust. It has a timeout and a fresh process, but it is not a security sandbox.</p><button class="secondary" data-action="export">Export progress ↓</button><button class="quiet" data-action="import" style="margin-left:15px">Import progress ↑</button></article></div>`;
}
function render() {
  const main=$('#main'); main.innerHTML=view==='home'?renderHome():view==='library'||view==='review'?renderLibrary():view==='notes'?renderNotes():view==='catalog'?renderCatalog():view==='sql'?renderSqlCourse():view==='probability'?renderProbabilityPractice():renderResources();
  const search=$('#search'); if(search) search.addEventListener('input',e=>{const pos=e.target.selectionStart;filters.search=e.target.value;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);});
  for(const name of ['topic','type','status','level']) $(`#filter-${name}`)?.addEventListener('change',e=>{filters[name]=e.target.value;render();});
}
function updateCounts() { $('#due-count').textContent=problems.filter(due).length; $('#problem-state').innerHTML=statusPill(current); }
function openProblem(id,session=false) {
  if(!byId.has(id)) return;
  if(current) snapshotDraft();
  current=byId.get(id); const e=entry(id); tab='prompt';hints=0;solutionRevealed=false;assessing=false;
  $('#problem-title').textContent=current.title;
  $('#problem-meta').textContent=`${current.topic} / ${current.difficulty} / ${current.minutes} MIN`;
  $('#session-status').textContent=session&&state.session?`SESSION ${state.session.index+1} OF ${state.session.ids.length}`:'FREE PRACTICE';
  $('#next-problem').textContent=session?'Next in session →':current.language==='sql'?'Next SQL lesson →':'Another question →';
  $('#next-problem').dataset.session=String(session);
  $('#written').value=e.answer||'';$('#personal-notes').value=e.notes||'';
  $('#results').innerHTML='';$('#assessment').innerHTML='';
  const code=current.type==='coding', numeric=current.answerFormat==='numeric';
  $('#numeric-wrap').hidden=!numeric;if(numeric){numericInputs();if(session&&current.probabilityArea)$$('#numeric-wrap input').forEach(input=>input.value='');}
  $('#written-wrap').style.display=code||numeric?'none':'block';$('#code-wrap').style.display=code?'block':'none';
  $('#run-code').style.display=code?'inline-flex':'none';$('#reset-code').style.display=code?'inline-block':'none';$('#review-answer').style.display=code?'none':'inline-flex';
  $('#answer-label').textContent=code?(current.language==='sql'?'Your SQL query':'Your implementation'):numeric?'Your final answer':'Your reasoning';
  $('#review-answer').textContent=numeric?'Check answer →':'Review my answer →';$('#editor-language').textContent=code?(current.language==='sql'?'SQLite · runs in your browser':`Python 3 · ${current.dependency||'standard library'}`):numeric?'Number or fraction':'Written answer';
  $('#draft-status').textContent=code?'Fresh attempt · code resets when you reopen':'Answers and notes autosave';
  clearDiagnostics();if(code){editor.setOption('mode',current.language==='sql'?'text/x-sql':'python');changingEditor=true;editor.setValue(current.starter);editor.clearHistory();changingEditor=false;}
  updateCounts();updateBookmark();renderReference();updateReviewInfo();
  const dialog=$('#workspace');if(!dialog.open) dialog.showModal();dialog.scrollTop=0;
  if(code) requestAnimationFrame(()=>editor.refresh());
}
function snapshotDraft() {
  if(!current) return; const e=entry(current.id);
  if(current.answerFormat==='numeric')e.numericAnswers=$$('#numeric-wrap input').map(input=>input.value);
  e.answer=$('#written').value;e.notes=$('#personal-notes').value;
  // Implementations stay in the current editor, so future attempts start fresh.
  e.updated=Date.now(); saveSoon();
}
function updateBookmark() { const marked=!!entry(current.id).bookmark; $('#bookmark').textContent=marked?'★ Saved for later':'☆ Save for later';$('#bookmark').setAttribute('aria-pressed',String(marked)); }
function readingLink() {
  const s=current.source;
  if(s.includes('Green Book')) return boot.books.green?`<a href="${window.PrepPlatform?.bookUrl('green')||'/api/book/green'}" target="_blank" rel="noopener">Open local Green Book ↗</a>`:'';
  if(s.includes('ISLP')) return boot.books.islp?`<a href="${window.PrepPlatform?.bookUrl('islp')||'/api/book/islp'}" target="_blank" rel="noopener">Open local ISLP ↗</a>`:'';
  return '';
}
function renderReference() {
  $$('.tabs button').forEach(b=>{b.classList.toggle('selected',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab));});
  let html='';
  if(tab==='prompt') html=`<h3>The question</h3><p>${esc(current.prompt)}</p>${renderGuide(current)}${sqlSchema(current)}${current.type==='coding'&&current.language==='sql'?'<p class="section-caption">Write one SELECT query. Each check uses a fresh disposable shop database. Column aliases and any requested ordering are checked.</p>':current.type==='coding'?`<p class="section-caption">Implement <strong>${esc(current.function)}(...)</strong> in the editor. ${current.testCount} checks include edge cases. Do not change the function name. Results show inputs, expected outputs, and actual outputs.</p>`:current.answerFormat==='numeric'?'<p class="section-caption">Enter only the final number or fraction, then check your answer. Explanations and worked steps are optional review.</p>':'<p class="section-caption">Write your answer before reviewing. There is no automatic semantic grade: compare your work with the explicit rubric and solution.</p>'}<div class="hint-area"><div class="eyebrow">A NUDGE, IF YOU NEED IT</div>${current.hints.slice(0,hints).map((h,i)=>`<div class="hint"><strong>Hint ${i+1}</strong><br>${esc(h)}</div>`).join('')}${hints<current.hints.length?`<button class="secondary" data-action="hint">Reveal hint ${hints+1} of ${current.hints.length} ↓</button>`:'<span class="section-caption">All hints revealed. You can still try before opening the solution.</span>'}</div>`;
  if(tab==='concepts') html=`<div class="eyebrow">BUILD THE INTUITION</div><h3>The ideas behind the question</h3><p class="concept-paragraph">${esc(current.concepts)}</p><button class="secondary" data-action="copy-notes">Add this explanation to my notes +</button>`;
  if(tab==='solution') html=!solutionRevealed?`<div class="eyebrow">TRY, THEN COMPARE</div><h3>Ready to see the worked solution?</h3><p>You’ll find each step, the reasoning behind it, and a checklist to compare with your attempt. Your answer stays in the editor.</p><button class="primary" data-action="reveal">Reveal worked solution →</button>`:
    `<div class="eyebrow">WALK THROUGH THE REASONING</div><h3>Step-by-step solution</h3><ol>${current.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${current.solution?`<h3>Reference implementation</h3><pre class="solution-code">${esc(current.solution)}</pre><button class="quiet" data-action="copy-solution">Copy reference code</button>`:''}<h3>Compare your answer</h3><ul>${current.rubric.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><p class="section-caption">Write down the step you missed before moving on.</p>`;
  html+=`<div class="source">Further reading: ${esc(current.source)}<br>${readingLink()}<br>${referenceLinks(current)}<br>Original practice material · not a copied textbook exercise</div>`;
  $('#reference-content').innerHTML=html;
}
function addConceptNotes() {
  const text=`${current.title}\n${current.concepts}\nReading: ${current.source}`;
  if($('#personal-notes').value.includes(current.concepts)) return toast('This explanation is already in your notes.');
  $('#personal-notes').value=[$('#personal-notes').value,text].filter(Boolean).join('\n\n');snapshotDraft();toast('Added to your notebook.');
}
function showAssessment() {
  if(current.answerFormat==='numeric')return checkNumbers();
  if(current.type==='theory'&&!$('#written').value.trim()) {$('#written').focus();toast('Write an attempt first, even if it’s what you’re unsure about.');return;}
  snapshotDraft(); assessing=true;tab='solution';solutionRevealed=true;renderReference();
  const e=entry(current.id);
  $('#assessment').innerHTML=`<div class="assessment-box"><div class="eyebrow">${current.type==='theory'?'HONEST SELF-ASSESSMENT':'REFLECT ON YOUR IMPLEMENTATION'}</div><p>Compare your work with the solution. This is your review, not an automatic theory grade.</p>${current.rubric.map((r,i)=>`<label><input type="checkbox" data-rubric="${i}" ${e.rubric?.includes(i)?'checked':''}>${esc(r)}</label>`).join('')}<p>How did it go? This sets your next review date.</p><div class="rating-buttons"><button data-rate="again">Need practice · 1 day</button><button data-rate="good">Got it · 3+ days</button><button data-rate="mastered">Confident · 7+ days</button></div></div>`;
}
function rate(rating) {
  const e=entry(current.id);e.rating=rating;e.lastReview=Date.now();
  e.interval=rating==='again'?1:rating==='good'?Math.max(3,Math.min(60,(e.interval||1)*2)):Math.max(7,Math.min(120,(e.interval||1)*3));
  e.due=Date.now()+e.interval*DAY;recordActivity(current.id);snapshotDraft();updateCounts();updateReviewInfo();
  toast(`Reviewed. Next review in ${e.interval} day${e.interval===1?'':'s'}.`);
}
function updateReviewInfo() {
  const e=entry(current.id);
  $('#review-info').textContent=e.due?`Next review: ${new Date(e.due).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · ${current.answerFormat==='numeric'?'numeric answer checked':current.type==='theory'?'self-assessed':'test-verified completion'}`:current.type==='coding'?'Notes and progress save. Code resets for each new attempt.':'Answers and notes save automatically on this computer.';
}
async function runCode() {
  if(runBusy||!current||current.type!=='coding') return;
  const p=current, code=editor.getValue();snapshotDraft();runBusy=true;
  $('#run-code').disabled=true;$('#run-code').textContent='Running checks…';$('#results').innerHTML=`<div class="result-summary">${p.language==='sql'?'Loading the small SQLite worker…':'Running in a fresh Python process…'}</div>`;
  try {
    const report=p.language==='sql'?await runSql(p,code):await api('/api/run',{id:p.id,code});
    if(report.diagnostics&&current?.id===p.id)showDiagnostics(report.diagnostics);
    if(!['disabled','setup','busy','cancelled'].includes(report.status)){
      const e=entry(p.id);e.attempts=(e.attempts||0)+1;e.lastResult=report.status;
      if(report.status==='passed') {e.passed=true;e.lastReview=Date.now();e.due=Date.now()+3*DAY;e.interval=3;recordActivity(p.id);}
      e.updated=Date.now();saveSoon();
    }
    if(current?.id!==p.id) return;
    $('#results').innerHTML=`<div class="result-summary ${report.status==='passed'?'passed':''}">${esc(report.message)}</div>${(report.tests||[]).map(t=>`<details class="test-row"><summary><span>${t.passed?'✓':'✕'} ${esc(t.name)}</span><span>${t.passed?'Passed':'Failed'} ▾</span></summary><pre>${t.error?esc(t.error):`Input: ${esc(JSON.stringify(t.input))}\nExpected: ${esc(JSON.stringify(t.expected))}\nActual: ${esc(t.actual)}`}</pre></details>`).join('')}${report.resourceInfo?`<div class="test-row">${esc(report.resourceInfo)}</div>`:''}${report.runUrl?`<div class="result-actions"><a href="${esc(report.runUrl)}" target="_blank" rel="noopener">Open private workflow details ?</a></div>`:''}${report.output?`<div class="test-row"><strong>Your output</strong><pre>${esc(report.output)}</pre></div>`:''}${report.status==='passed'?'<div class="result-actions"><button class="quiet" data-action="assess-code">Review concepts & schedule practice →</button></div>':''}`;
    updateCounts();updateReviewInfo();
  } catch(err) {if(current?.id===p.id) $('#results').innerHTML=`<div class="result-summary">Could not run checks: ${esc(err.message)}. Make sure the local server is running, then reload if needed.</div>`;}
  finally {runBusy=false;$('#run-code').disabled=false;$('#run-code').innerHTML='▶ Run checks <small>Ctrl + Enter</small>';}
}
function startSession() {
  const mode=$('#session-mode')?.value||'mixed';
  let ids;
  if(mode==='mixed')ids=mixedQueue().map(p=>p.id);
  else ids=recommended(mode).slice(0,5).map(p=>p.id);
  state.session={ids,index:0,started:Date.now()};saveSoon();openProblem(ids[0],true);
}
function nextProblem() {
  snapshotDraft();
  if($('#next-problem').dataset.session==='true'&&state.session){
    state.session.index++;
    if(state.session.index>=state.session.ids.length){
      const ids=state.session.ids,finished=ids.filter(id=>entry(id).lastReview>=state.session.started).length;
      state.session=null;saveSoon();closeWorkspace();navigate('home');
      const banner=document.createElement('div');banner.className='session-complete';banner.innerHTML=`<h2>Session complete.</h2><p>${finished} of ${ids.length} questions reviewed or passed. Your drafts and notes are saved. Come back to anything you skipped whenever you’re ready.</p>`;$('#main').prepend(banner);return;
    }
    saveSoon();openProblem(state.session.ids[state.session.index],true);return;
  }
  if(current.language==='sql'){const next=problems.find(p=>p.language==='sql'&&p.step===current.step+1);if(next)openProblem(next.id);else{closeWorkspace();navigate('sql');}return;}
  const choices=recommended(current.type).filter(p=>p.id!==current.id);if(choices[0]) openProblem(choices[0].id);
}
function closeWorkspace(){snapshotDraft();$('#workspace').close();current=null;navigate(view);flushSave();}
function exportProgress(){snapshotDraft();const blob=new Blob([JSON.stringify({format:'interview-studio',version:1,exported:new Date().toISOString(),state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`interview-studio-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('Progress and notes exported.');}
function validState(candidate) {
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)) throw Error('Invalid progress data');
  const clean={items:{},activity:{},readings:{},session:null,updated:Number(candidate.updated)||0};
  for(const p of problems){const raw=candidate.items?.[p.id];if(!raw||typeof raw!=='object')continue;const e={};
    for(const key of ['answer','notes']) if(typeof raw[key]==='string') e[key]=raw[key].slice(0,100000);
    for(const key of ['due','lastReview','interval','updated','attempts']) if(Number.isFinite(raw[key])&&raw[key]>=0)e[key]=raw[key];
    if(['again','good','mastered'].includes(raw.rating)) e.rating=raw.rating;
    e.bookmark=raw.bookmark===true;e.passed=raw.passed===true;
    e.numericPassed=raw.numericPassed===true;
    if(p.numericFields && Array.isArray(raw.numericAnswers)) e.numericAnswers=p.numericFields.map((_,i)=>typeof raw.numericAnswers[i]==='string'?raw.numericAnswers[i].slice(0,100):'');
    if(Array.isArray(raw.rubric)) e.rubric=raw.rubric.filter(n=>Number.isInteger(n)&&n>=0&&n<p.rubric.length);
    clean.items[p.id]=e;
  }
  for(const [key,ids] of Object.entries(candidate.activity||{}))if(/^\d{4}-\d{2}-\d{2}$/.test(key)&&Array.isArray(ids)) clean.activity[key]=[...new Set(ids.filter(id=>byId.has(id)))];
  for(const reading of boot.readings||[]) { const r=candidate.readings?.[reading.id];if(r&&Number.isFinite(r.reviewed)&&r.reviewed>=0)clean.readings[reading.id]={reviewed:r.reviewed}; }
  const s=candidate.session;
  if(s&&Array.isArray(s.ids)&&s.ids.length>0&&s.ids.length<=20&&s.ids.every(id=>byId.has(id))&&Number.isInteger(s.index)&&s.index>=0&&s.index<s.ids.length&&Number.isFinite(s.started))clean.session={ids:s.ids,index:s.index,started:s.started};
  return clean;
}
async function importProgress(file){
  if(!file)return;
  try{if(file.size>2000000)throw Error('File must be under 2 MB');const data=JSON.parse(await file.text());if(data.format!=='interview-studio'||data.version!==1)throw Error('Choose an Interview Studio v1 export');const incoming=validState(data.state);
    for(const [id,e] of Object.entries(incoming.items)) if(!state.items[id]||(e.updated||0)>=(state.items[id].updated||0)) state.items[id]=e;
    for(const [day,ids] of Object.entries(incoming.activity)) state.activity[day]=[...new Set([...(state.activity[day]||[]),...ids])];
    for(const [id,r] of Object.entries(incoming.readings))if(!state.readings[id]||r.reviewed>state.readings[id].reviewed)state.readings[id]=r;
    saveSoon();navigate(view);toast('Imported. Newer entries kept; activity histories merged.');
  }catch(err){toast(`Import failed: ${err.message}`);}finally{$('#import-file').value='';}
}
function handleClicks(event){
  const target=event.target.closest('button,[data-topics]');if(!target)return;
  if(target.dataset.view){navigate(target.dataset.view);return;}
  if(target.dataset.open){openProblem(target.dataset.open);return;}
  if(target.dataset.topics){filters.topic=target.dataset.topics;navigate('library');return;}
  if(target.dataset.star){const e=entry(target.dataset.star);e.bookmark=!e.bookmark;e.updated=Date.now();saveSoon();render();return;}
  if(target.dataset.tab){tab=target.dataset.tab;renderReference();return;}
  if(target.dataset.rate){rate(target.dataset.rate);return;}
  const action=target.dataset.action;
  if(action==='start')startSession();
  if(action==='resume'){const s=state.session;if(s)openProblem(s.ids[s.index],true);else startSession();}
  if(action==='hint'){hints++;renderReference();}
  if(action==='reveal'){solutionRevealed=true;renderReference();}
  if(action==='copy-notes')addConceptNotes();
  if(action==='copy-solution')navigator.clipboard.writeText(current.solution).then(()=>toast('Reference code copied.')).catch(()=>toast('Select the reference code and copy it manually.'));
  if(action==='assess-code')showAssessment();
  if(action==='clear-filters'){Object.assign(filters,{search:'',topic:'all',type:'all',status:'all',level:'all'});render();}
  if(action==='export')exportProgress();if(action==='import')$('#import-file').click();
}
async function init(){
  try{
    const response=await fetch(window.PrepPlatform?.static?'./bootstrap.json'+(window.PREP_BUILD?'?build='+window.PREP_BUILD:''):'/api/bootstrap');if(!response.ok)throw Error('Could not connect to the local server');boot=await response.json();
    problems=[...boot.theory,...boot.coding,...(boot.sql||[])];byId=new Map(problems.map(p=>[p.id,p]));state=validState(boot.state);
    try{const local=JSON.parse(localStorage.getItem(STORAGE));if(local?.updated>state.updated)state=validState(local);}catch{}
    editor=CodeMirror.fromTextArea($('#code'),{mode:'python',lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,viewportMargin:10,extraKeys:{Tab:cm=>{if(cm.somethingSelected())cm.indentSelection('add');else cm.replaceSelection('    ','end');},'Shift-Tab':cm=>cm.indentSelection('subtract'),'Ctrl-Enter':runCode,'Cmd-Enter':runCode},screenReaderLabel:'Python code editor'});
    configureEditorTools(editor);
    editor.on('change',()=>{if(!changingEditor&&current)snapshotDraft();});
    document.addEventListener('click',handleClicks);
    document.addEventListener('keydown',e=>{const t=e.target.closest('[data-topics]');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();filters.topic=t.dataset.topics;navigate('library');}});
    $('#written').addEventListener('input',snapshotDraft);$('#personal-notes').addEventListener('input',snapshotDraft);
    $('#bookmark').addEventListener('click',()=>{const e=entry(current.id);e.bookmark=!e.bookmark;snapshotDraft();updateBookmark();});
    $('#close-workspace').addEventListener('click',closeWorkspace);$('#workspace').addEventListener('cancel',e=>{e.preventDefault();closeWorkspace();});
    $('#run-code').addEventListener('click',runCode);$('#review-answer').addEventListener('click',showAssessment);
    $('#reset-code').addEventListener('click',()=>{editor.setValue(current.starter);toast('Starter restored. Use Ctrl+Z in the editor to undo.');});
    $('#copy-concepts').addEventListener('click',addConceptNotes);$('#next-problem').addEventListener('click',nextProblem);
    $('#assessment').addEventListener('change',e=>{if(e.target.dataset.rubric!==undefined){entry(current.id).rubric=$$('#assessment input:checked').map(n=>Number(n.dataset.rubric));snapshotDraft();}});
    $('#export').addEventListener('click',exportProgress);$('#import').addEventListener('click',()=>$('#import-file').click());$('#import-file').addEventListener('change',e=>importProgress(e.target.files[0]));
    $('.brand').addEventListener('click',e=>{e.preventDefault();navigate('home');});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){snapshotDraft();flushSave();}});
    $('#today').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    $('#save-status').textContent=window.PrepPlatform?.static?'Saved in this browser ✓':'Saved on this computer ✓';navigate('home');
    if(!window.PrepPlatform?.static&&(!boot.dependencies.numpy||!boot.dependencies.torch))toast('Some ML dependencies are missing. See the Reading room for setup.');
  }catch(err){$('#main').innerHTML=`<div class="error-banner"><h2>Couldn’t open the workspace</h2><p>${esc(err.message)}</p><p>${window.PrepPlatform?.static?'Check your connection and reload this page.':'Resume your private cloud workspace, then reload its app page.'}</p><button class="secondary" onclick="location.reload()">Try again</button></div>`;}
}
init();
