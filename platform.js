/* Study loads no Python/ML runtime; SQLite WebAssembly loads only for SQL checks. */
window.PrepPlatform = {
  static: window.PREP_STATIC === true,
  cloudUrl: 'https://codespaces.new/JoshECampbell/Interview-Prep/tree/feat/interview-studio?quickstart=1',
  books: {},
  async api(path, body) {
    if(path==='/api/state') {
      localStorage.setItem('interview-studio-v1', JSON.stringify(body));
      return {saved:true};
    }
    if(path==='/api/run')return window.CloudJudge.run(body.id,body.code);
    throw Error('This operation needs the private cloud workspace.');
  },
  bookUrl(key) { return this.books[key] || `/api/book/${key}`; }
};

function deviceBookControls() {
  return '<p class="section-caption">Choose your own PDFs to read locally in this tab. They are not uploaded or published. Choose again after reloading.</p><button class="secondary" data-select-book="green">Choose Green Book PDF</button> <button class="secondary" data-select-book="islp">Choose ISLP PDF</button>';
}
function hostedNotice() {
  if(!window.PrepPlatform.static)return '';
  return `<div class="error-banner"><strong>Private Python checks run on GitHub.</strong><p>Your budget setup is confirmed. Connect the private runner with a repository-scoped Issues token, then use Run checks for feedback here. No local Python is started. SQL needs no setup.</p><button data-open-runner class="secondary">Connect private runner</button></div>`;
}

document.addEventListener('click', event=>{
  const button=event.target.closest('[data-select-book]');if(!button)return;
  let input=document.getElementById('device-book');
  if(!input){
    input=document.createElement('input');input.id='device-book';input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;document.body.append(input);
    input.addEventListener('change',()=>{
      const file=input.files[0];if(!file)return;
      if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return toast('Choose a PDF file.');
      const key=input.dataset.book;
      if(window.PrepPlatform.books[key]) URL.revokeObjectURL(window.PrepPlatform.books[key]);
      window.PrepPlatform.books[key]=URL.createObjectURL(file);boot.books[key]=true;
      if(activeReading?.book===key && document.getElementById('reading-dialog').open)openReading(activeReading.id);
      else if(view==='resources')render();
      toast('PDF opened on this device only. It was not uploaded.');
      input.value='';
    });
  }
  input.dataset.book=button.dataset.selectBook;input.click();
});
