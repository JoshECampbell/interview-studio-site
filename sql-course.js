const sqlStages=new Map();
function renderSqlCourse(){
  const lessons=problems.filter(p=>p.language==='sql').sort((a,b)=>a.step-b.step);
  const next=lessons.find(p=>!completed(p)),done=lessons.filter(completed).length;
  return heading('GUIDED BEGINNER PATH · SQLITE','SQL from zero.','Learn one idea, watch a query grow, inspect the result, then write your own query. Start with the first unfinished lesson.')+
    `<div class="note-card"><h3>${done} / ${lessons.length} practice problems completed</h3><p>A row is one record; a column is one field. Each lesson puts the explanation, syntax skeleton, and an example with output tables directly in the Question tab. The example needs no running database. Your own query is checked in a small disposable SQLite worker.</p>${next?`<button class="primary" data-open="${next.id}">Continue with ${esc(next.title)} →</button>`:'<p>All lessons complete. Revisit a topic or try a fresh attempt without the skeleton.</p>'}<p class="section-caption">SQLite dialect. NeetCode’s public learn-and-practise structure inspired this original course; its paid lessons and exercises are not copied.</p></div>`+
    [...new Set(lessons.map(p=>p.module))].map(module=>`<h2>${esc(module)}</h2><div class="panel">${lessons.filter(p=>p.module===module).map(p=>`<button class="problem-row" data-open="${p.id}"><span class="num">${p.step}</span><span class="row-text"><strong>${esc(p.title)}</strong><span class="sub">Learn · Follow example · Write query · Check · ${p.minutes} min</span></span>${statusPill(p)}<span class="arrow">→</span></button>`).join('')}</div>`).join('');
}
function sqlResultTable(columns,rows){
  return `<div class="sql-table-scroll"><table class="library-table"><thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${value===null?'<em>NULL</em>':esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length?'':'<p class="section-caption">0 rows. An empty result is still a valid result table.</p>'}</div>`;
}
function renderSqlTeaching(problem){
  const teaching=problem.teaching;if(!teaching)return '';
  const index=sqlStages.get(problem.id)||0,stage=teaching.stages[index];
  return `<section class="sql-teaching"><div class="eyebrow">1 · LEARN THE IDEA</div><p>${esc(problem.concepts)}</p><h3>Read SQL in this order</h3><p><strong>FROM / JOIN</strong> chooses rows → <strong>WHERE</strong> filters rows → <strong>GROUP BY</strong> forms groups → <strong>HAVING</strong> filters groups → <strong>SELECT</strong> chooses outputs → <strong>ORDER BY / LIMIT</strong> sorts and trims. Write SELECT first even though you reason about the source first. Only include clauses you need.</p><div class="eyebrow">2 · FOLLOW A WORKED TEACHING EXAMPLE</div><p class="section-caption">Use the visible shop tables below. These example outputs are precomputed with SQLite; stepping through adds no runtime to your laptop.</p><div class="sql-stage"><p>Step ${index+1} of ${teaching.stages.length}: <strong>${esc(stage.title)}</strong></p><pre class="solution-code">${esc(stage.code)}</pre><p>${esc(stage.explanation)}</p><strong>Result table</strong>${sqlResultTable(stage.columns,stage.rows)}<div class="sql-stage-controls"><button class="secondary" data-sql-stage="${index-1}" ${index===0?'disabled':''}>← Previous step</button><button class="secondary" data-sql-stage="${index+1}" ${index===teaching.stages.length-1?'disabled':''}>Next example step →</button></div></div><div class="eyebrow">3 · BUILD YOUR PRACTICE QUERY</div>${problem.guide.map(section=>`<h3>${esc(section.title)}</h3><p>${esc(section.body)}</p>`).join('')}<details class="sql-scaffold"><summary>Show the syntax skeleton</summary><p>Replace each comment with your choice of columns, conditions, or keys. Type the completed query into the editor.</p><pre class="solution-code">${esc(teaching.scaffold)}</pre></details><p>Use <strong>Run checks</strong> to compare columns and rows across five data sets. Open a failed check to see its input tables, expected output, and your output. If stuck, reveal one hint; after your attempt, compare with the worked solution.</p></section>`;
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-sql-stage]');if(!button||!current?.teaching)return;
  const index=Number(button.dataset.sqlStage);
  if(index<0||index>=current.teaching.stages.length)return;
  const panel=document.getElementById('reference-content'),scroll=panel.scrollTop;
  sqlStages.set(current.id,index);renderReference();panel.scrollTop=scroll;
  panel.querySelector(`[data-sql-stage="${index+1}"]`)?.focus({preventScroll:true});
});
function sqlSchema(problem){
  if(problem.language!=='sql')return '';
  return `<h3>The visible practice database</h3><p class="section-caption">Other checks change these rows, including empty tables, NULLs, duplicates, and boundary values.</p>${problem.schema.map((table,i)=>`<h3>${esc(table.name)}</h3><div style="overflow:auto"><table class="library-table"><thead><tr>${table.columns.map((c,j)=>`<th>${esc(c)}<br><small>${esc(table.types[j])}</small></th>`).join('')}</tr></thead><tbody>${problem.tests[0].rows[i].map(row=>`<tr>${row.map(v=>`<td>${v===null?'<em>NULL</em>':esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}`;
}
function runSql(problem,code){
  if(typeof code!=='string'||code.length>20000)return Promise.resolve({status:'error',message:'Keep practice queries under 20,000 characters.',tests:[]});
  return new Promise(resolve=>{
    let worker,finished=false,timer;
    const finish=report=>{if(finished)return;finished=true;clearTimeout(timer);worker?.terminate();resolve(report);};
    try{
      worker=new Worker(new URL('./sql-worker.js',document.baseURI));
      timer=setTimeout(()=>finish({status:'timeout',message:'SQLite did not finish loading. Check your connection and try again.',tests:[]}),30000);
      worker.onmessage=event=>{
        if(event.data.type==='ready'){clearTimeout(timer);timer=setTimeout(()=>finish({status:'timeout',message:'Query stopped after 3 seconds. Check for a runaway recursive query or a missing join condition.',tests:[]}),3000);}
        if(event.data.type==='result')finish(event.data.report);
      };
      worker.onerror=()=>finish({status:'error',message:'The SQL worker could not run. Refresh and try again; WebAssembly must be available.',tests:[]});
      worker.postMessage({problem,code});
    }catch(error){finish({status:'error',message:error.message,tests:[]});}
  });
}
