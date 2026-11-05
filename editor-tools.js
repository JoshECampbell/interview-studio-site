const PYTHON_WORDS=['def','return','for','while','if','elif','else','in','is','not','and','or','True','False','None','import','from','as','class','try','except','with','yield','range','len','enumerate','zip','sum','min','max','sorted','list','dict','set','float','int','print','np.array','np.zeros','np.ones','np.arange','np.mean','np.sum','np.exp','np.log','np.sqrt','np.where','np.argmax','np.argsort','np.linalg.norm','torch.tensor','torch.zeros','torch.ones','torch.softmax','torch.sqrt','torch.erf','torch.nn.functional.cross_entropy'];
const SQL_WORDS=['SELECT','FROM','WHERE','AND','OR','NOT','NULL','IS NULL','IS NOT NULL','ORDER BY','GROUP BY','HAVING','LIMIT','AS','ASC','DESC','INNER JOIN','LEFT JOIN','ON','DISTINCT','COUNT','SUM','AVG','MIN','MAX','customers','orders','customer_id','amount','status','name','city','id'];
let diagnosticMarks=[];
function editorHints(cm){
  const cursor=cm.getCursor(),line=cm.getLine(cursor.line),match=line.slice(0,cursor.ch).match(/[\w.]*$/),prefix=match?.[0]||'';
  const words=[...(current?.language==='sql'?SQL_WORDS:PYTHON_WORDS),...(cm.getValue().match(/[A-Za-z_]\w*/g)||[])];
  return {list:[...new Set(words)].filter(word=>word.toLowerCase().startsWith(prefix.toLowerCase())&&word!==prefix).sort(),from:CodeMirror.Pos(cursor.line,cursor.ch-prefix.length),to:cursor};
}
function clearDiagnostics(){
  diagnosticMarks.forEach(mark=>mark.clear());diagnosticMarks=[];
  editor?.clearGutter('diagnostics');const box=document.getElementById('editor-diagnostics');if(box)box.textContent='';
}
function showDiagnostics(diagnostics){
  clearDiagnostics();
  for(const d of diagnostics||[]){
    const line=Math.max(0,Math.min(editor.lineCount()-1,d.line-1));
    const marker=document.createElement('span');marker.textContent='●';marker.title=d.message;marker.style.color='#b44a35';editor.setGutterMarker(line,'diagnostics',marker);
    diagnosticMarks.push(editor.markText({line,ch:0},{line,ch:Math.max(1,editor.getLine(line).length)},{className:'editor-error-line',title:d.message}));
  }
  const box=document.getElementById('editor-diagnostics');if(box)box.textContent=(diagnostics||[]).map(d=>`Line ${d.line}: ${d.kind||'Syntax'} — ${d.message}`).join('\n');
}
function configureEditorTools(cm){
  cm.setOption('gutters',['CodeMirror-linenumbers','diagnostics']);
  cm.addKeyMap({'Ctrl-Space':()=>cm.showHint({hint:editorHints,completeSingle:false}),'Cmd-Space':()=>cm.showHint({hint:editorHints,completeSingle:false})});
  cm.on('renderLine',(_,line,element)=>{
    const indentation=(line.text.match(/^\s*/)?.[0]||'').replaceAll('\t','    ').length;
    if(indentation>=4){const width=cm.defaultCharWidth()*4;element.style.backgroundImage='repeating-linear-gradient(to right, transparent 0, transparent '+(width-1)+'px, #dce4d2 '+(width-1)+'px, #dce4d2 '+width+'px)';element.style.backgroundSize=(indentation*cm.defaultCharWidth())+'px 100%';element.style.backgroundRepeat='no-repeat';}
  });
  cm.on('change',()=>{
    // Editing makes no requests and starts no Python process.
    clearDiagnostics();
  });
}
