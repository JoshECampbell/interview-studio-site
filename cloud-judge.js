/* Private runner disabled pending actual zero-spend verification. */
window.CloudJudge=(()=>{
  function open(){
    const dialog=document.getElementById('runner-dialog');
    if(!dialog.open)dialog.showModal();
  }
  async function run(){
    open();
    return {status:'disabled',tests:[],message:'Private Python checks are disabled until a $0 GitHub Actions budget with a hard stop is verified. No code was submitted and no local Python was started. SQL practice remains available.'};
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.id==='configure-runner'||button.hasAttribute('data-open-runner'))open();
    if(button.id==='close-runner')document.getElementById('runner-dialog').close();
  });
  return {run,open,enabled:false};
})();
