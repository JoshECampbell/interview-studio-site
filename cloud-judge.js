/* Private GitHub issue queue. Credentials never enter study progress or exports. */
window.CloudJudge=(()=>{
  const owner='JoshECampbell',repo='Interview-Prep',root=`/repos/${owner}/${repo}`;
  const key='interview-studio-private-token';
  let token='',waiting=false,stop=false;
  try{token=sessionStorage.getItem(key)||'';}catch{}
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function forget(){token='';stop=true;try{sessionStorage.removeItem(key);}catch{}status('Disconnected. Paste a repository-scoped token to reconnect.');}
  function status(message){document.getElementById('runner-connection-status').textContent=message;}
  function open(){
    const dialog=document.getElementById('runner-dialog');
    status(token?'Token available for this tab. Run checks validates private access before submitting.':'Budget setup confirmed. Connect your private runner below.');
    if(!dialog.open)dialog.showModal();
  }
  async function api(path,auth,body){
    if(path!=='/user'&&path!==root&&!path.startsWith(root+'/issues'))throw Error('Unexpected GitHub API path.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch('https://api.github.com'+path,{method:body===undefined?'GET':'POST',cache:'no-store',redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+auth,'X-GitHub-Api-Version':'2022-11-28',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
      const data=await response.json();
      if(!response.ok){
        if(response.status===401)throw Error('This token is invalid or expired. Reconnect with a new token.');
        if(response.status===403||response.status===404)throw Error('The token cannot access the private repo. Select only Interview-Prep and give Issues read/write permission. '+(data.message||''));
        throw Error(data.message||'GitHub request failed.');
      }
      return data;
    }finally{clearTimeout(timer);}
  }
  async function privateRepo(auth){
    const metadata=await api(root,auth);
    if(metadata.private!==true||metadata.full_name.toLowerCase()!==`${owner}/${repo}`.toLowerCase())throw Error('Refusing to submit: the grading repository must remain private.');
    if(!metadata.has_issues)throw Error('Issues must be enabled in the private source repository.');
    return metadata;
  }
  async function connect(value,remember=false){
    const auth=value.trim();if(!/^github_pat_[A-Za-z0-9_]+$/.test(auth))throw Error('Paste a fine-grained GitHub token beginning with github_pat_.');
    await privateRepo(auth);
    const user=await api('/user',auth);
    if(user.login.toLowerCase()!==owner.toLowerCase())throw Error('Use a token from the repository owner’s account.');
    await api(root+'/issues?per_page=1&state=all',auth);
    token=auth;
    try{if(remember)sessionStorage.setItem(key,auth);else sessionStorage.removeItem(key);}catch{}
    status('Connected to the private runner. Run checks sends code directly to GitHub and returns private feedback here.');
  }
  function encode(value){return btoa(Array.from(new TextEncoder().encode(JSON.stringify(value)),byte=>String.fromCharCode(byte)).join(''));}
  function decode(value){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value),char=>char.charCodeAt(0))));}
  async function run(id,code){
    if(!token){open();return {status:'setup',tests:[],message:'Your budget setup is confirmed. Connect the private runner once using an Issues read/write token. No code has been submitted yet.'};}
    if(waiting)return {status:'busy',tests:[],message:'A private check is already running.'};
    if(typeof code!=='string'||!code.length||code.length>50000)return {status:'error',tests:[],message:'Enter 1–50,000 characters of code.'};
    const nonce=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const encoded=encode({request_id:nonce,problem_id:id,code});
    const body='Private Interview Studio grading request.\n\nINTERVIEW_STUDIO_SUBMISSION\n```text\n'+encoded+'\n```';
    if(body.length>60000)return {status:'error',tests:[],message:'This submission is too large for a private check request. Shorten it and retry.'};
    const auth=token;waiting=true;stop=false;let issue;
    function progress(message){
      if(current?.id!==id)return;
      document.getElementById('results').innerHTML=`<div class="result-summary">${esc(message)}</div><p><a href="https://github.com/${owner}/${repo}/issues/${issue.number}" target="_blank" rel="noopener">Open private check request</a> · <button id="stop-private-check" class="quiet">Stop waiting</button></p>`;
    }
    try{
      // Recheck visibility for every submission, before sending any source code.
      await privateRepo(auth);
      issue=await api(root+'/issues',auth,{title:'Interview Studio check '+nonce,body});
      if(issue.user?.login.toLowerCase()!==owner.toLowerCase())throw Error('The check request must come from the repository owner.');
      progress('Private check queued on GitHub. Cold setup can take several minutes; no Python runs on your laptop.');
      for(let attempt=0;attempt<60;attempt++){
        if(stop||token!==auth)return {status:'cancelled',tests:[],message:'Stopped waiting. An already-submitted private job may still finish; its request contains the feedback.'};
        const comments=await api(root+'/issues/'+issue.number+'/comments?per_page=100',auth);
        for(const comment of [...comments].reverse()){
          if(comment.user?.login!=='github-actions[bot]')continue;
          const marker='INTERVIEW_STUDIO_RESULT\n',index=(comment.body||'').indexOf(marker);
          if(index<0)continue;
          const payload=comment.body.slice(index+marker.length).trim();if(payload.length>65000)throw Error('Remote result exceeds the feedback limit.');
          const report=decode(payload);
          if(report.request_id!==nonce||!Array.isArray(report.tests)||typeof report.message!=='string')throw Error('The private response did not match this check.');
          if(report.runUrl&&!report.runUrl.startsWith(`https://github.com/${owner}/${repo}/actions/runs/`))delete report.runUrl;
          return report;
        }
        await pause(8000);
      }
      return {status:'timeout',tests:[],message:'No result arrived within eight minutes. Open the private request to check the workflow; do not submit a duplicate while it is still running.',runUrl:`https://github.com/${owner}/${repo}/actions`};
    }catch(error){return {status:'error',tests:[],message:error.message+(issue?' Your code is in the private request; its Actions run has setup details.':' No code was submitted if access validation failed.')};}
    finally{waiting=false;}
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.id==='configure-runner'||button.hasAttribute('data-open-runner'))open();
    if(button.id==='close-runner')document.getElementById('runner-dialog').close();
    if(button.id==='forget-private-token')forget();
    if(button.id==='stop-private-check')stop=true;
    if(button.id==='connect-private-runner'){
      button.disabled=true;
      try{await connect(document.getElementById('private-runner-token').value,document.getElementById('remember-private-token').checked);document.getElementById('private-runner-token').value='';document.getElementById('runner-dialog').close();toast('Private runner connected. Press Run checks.');}
      catch(error){status(error.message);}
      finally{button.disabled=false;}
    }
  });
  return {run,open,connect,forget,get connected(){return !!token;}};
})();
