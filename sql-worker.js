/* A fresh, bounded, disposable SQLite worker is used for each check. */
importScripts('./vendor/sql-wasm.js');

function oneReadQuery(sql) {
  let stripped='',quote=null,lineComment=false,blockComment=false;
  for(let i=0;i<sql.length;i++){
    const c=sql[i],next=sql[i+1];
    if(lineComment){if(c==='\n'){lineComment=false;stripped+=' ';}continue;}
    if(blockComment){if(c==='*'&&next==='/'){blockComment=false;i++;stripped+=' ';}continue;}
    if(quote){
      if(c===quote){if(next===quote){i++;continue;}quote=null;}
      continue;
    }
    if(c==='-'&&next==='-'){lineComment=true;i++;continue;}
    if(c==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(c==="'"||c==='"'||c==='`'){quote=c;stripped+=' value ';continue;}
    if(c==='['){quote=']';stripped+=' identifier ';continue;}
    stripped+=c;
  }
  const statements=stripped.split(';').map(s=>s.trim()).filter(Boolean);
  if(statements.length!==1||!/^(SELECT|WITH)\b/i.test(statements[0]))throw Error('Write one read-only SELECT query (a WITH query is also allowed).');
}
function sameValue(a,b){return typeof a==='number'&&typeof b==='number'?Number.isFinite(a)&&Math.abs(a-b)<=1e-6:a===b;}
function sameRows(actual,expected,ordered){
  if(actual.length!==expected.length)return false;
  const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>sameValue(v,b[i]));
  if(ordered)return actual.every((row,i)=>equal(row,expected[i]));
  const remaining=[...expected];
  for(const row of actual){const i=remaining.findIndex(other=>equal(row,other));if(i<0)return false;remaining.splice(i,1);}
  return true;
}
self.onmessage=async event=>{
  const {problem,code}=event.data;
  try{
    oneReadQuery(code);
    const SQL=await initSqlJs({locateFile:file=>new URL('./vendor/'+file,self.location.href).href});
    self.postMessage({type:'ready'});
    const tests=[];
    for(const test of problem.tests){
      const db=new SQL.Database();
      try{
        db.run('PRAGMA hard_heap_limit=16777216');
        for(let i=0;i<problem.schema.length;i++){
          const table=problem.schema[i];
          db.run(`CREATE TABLE ${table.name} (${table.columns.map((c,j)=>c+' '+table.types[j]).join(',')})`);
          const insert=db.prepare(`INSERT INTO ${table.name} VALUES (${table.columns.map(()=>'?').join(',')})`);
          for(const row of test.rows[i])insert.run(row);insert.free();
        }
        db.run('PRAGMA query_only=ON');
        const statement=db.prepare(code);const columns=statement.getColumnNames(),actual=[];
        try{while(statement.step()){actual.push(statement.get());if(actual.length>500)throw Error('Result exceeds the 500-row practice limit. Check the join condition.');}}finally{statement.free();}
        const columnsMatch=columns.length===test.columns.length&&columns.every((c,i)=>c.toLowerCase()===test.columns[i].toLowerCase());
        tests.push({name:test.name,passed:columnsMatch&&sameRows(actual,test.expected,problem.ordered),input:Object.fromEntries(problem.schema.map((table,i)=>[table.name,{columns:table.columns,rows:test.rows[i]}])),expected:{columns:test.columns,rows:test.expected},actual:JSON.stringify({columns,rows:actual})});
      }catch(error){tests.push({name:test.name,passed:false,error:error.message});}
      finally{db.close();}
    }
    const passed=tests.filter(t=>t.passed).length;
    self.postMessage({type:'result',report:{status:passed===tests.length?'passed':'failed',message:`${passed}/${tests.length} SQL data sets passed`,tests}});
  }catch(error){self.postMessage({type:'result',report:{status:'error',message:error.message,tests:[]}});}
};
