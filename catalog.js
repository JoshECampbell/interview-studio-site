/* External source metadata is deliberately distinct from locally checked exercises. */
let catalogQuery='',catalogDifficulty='all';
function renderGuide(problem) {
  if(problem.language==='sql')return renderSqlTeaching(problem);
  if(!problem.guide)return '';
  return `<div class="implementation-guide"><div class="eyebrow">IMPLEMENTATION WALKTHROUGH · CODE STILL HIDDEN</div>${problem.guide.map(section=>`<section><h3>${esc(section.title)}</h3><p>${esc(section.body)}</p></section>`).join('')}</div>`;
}
function referenceLinks(problem) {
  return (problem.references||[]).map(ref=>`<a href="${esc(ref.url)}" target="_blank" rel="noopener">${esc(ref.title)} ↗</a>`).join('<br>');
}
function renderCatalog() {
  const rows=(boot.catalog||[]).filter(p=>(catalogDifficulty==='all'||p.difficulty===catalogDifficulty)&&`${p.title} ${p.category} ${p.tags.join(' ')}`.toLowerCase().includes(catalogQuery.toLowerCase()));
  return heading('LINKED PUBLIC PRACTICE INDEX','More easy & medium practice.','Source titles and links across the areas covered here. These open on LeetML; they are separate from our original, locally checked exercises.')+
    `<div class="filters"><input id="catalog-search" type="search" aria-label="Search source catalog" placeholder="Search topic, title, or tag…" value="${esc(catalogQuery)}"><select id="catalog-difficulty" aria-label="Source difficulty"><option value="all">Easy & medium</option><option ${catalogDifficulty==='Easy'?'selected':''}>Easy</option><option ${catalogDifficulty==='Medium'?'selected':''}>Medium</option></select></div><p class="section-caption">${rows.length} external coding links · Marked free in the public catalog snapshot; availability may change. No external problem statements or solutions are copied into this app.</p><div class="panel"><table class="library-table"><thead><tr><th>SOURCE PROBLEM</th><th>LEVEL</th><th class="hide-mobile">TOPICS</th></tr></thead><tbody>${rows.map(p=>`<tr><td><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)} ↗</a><div class="count-caption">${esc(p.category)} · External exercise</div></td><td>${esc(p.difficulty)}</td><td class="hide-mobile">${esc(p.tags.join(', '))}</td></tr>`).join('')}</tbody></table>${rows.length?'':'<div class="empty">No matching source links.</div>'}</div>`;
}
document.addEventListener('input',event=>{
  if(event.target.id!=='catalog-search')return;
  const position=event.target.selectionStart;catalogQuery=event.target.value;render();
  const input=document.getElementById('catalog-search');input.focus();input.setSelectionRange(position,position);
});
document.addEventListener('change',event=>{if(event.target.id==='catalog-difficulty'){catalogDifficulty=event.target.value;render();}});
