const probabilityAreas=['Bayes rule','Conditional probability','Expectation','Combinatorics'];
const probabilityDescriptions={
  'Bayes rule':'Base rates, false alarms, repeated evidence, hidden coins, posterior prediction, and odds.',
  'Conditional probability':'Restricted sample spaces, dice and cards, independence, changing information, and geometric probability.',
  'Expectation':'Indicators, waiting times, coupon collection, random sums, covariance, and total variance.',
  'Combinatorics':'Combinations, permutations, repeated objects, stars and bars, paths, and inclusion-exclusion.'
};
function renderProbabilityPractice(){
  const bank=problems.filter(p=>p.probabilityArea),done=bank.filter(completed).length;
  return heading('PROBABILITY INTERVIEW DRILLS','Get fluent with probability.',`${bank.length} new Easy and Medium questions, grouped by technique. Enter a final number or fraction, then use hints, concept notes, and worked steps to review.`)+
    `<div class="note-card"><strong>${done} / ${bank.length} completed</strong><p>Before calculating: name the event, state what is known, and decide whether order, replacement, or independence matters. Topic drills choose up to five questions, prioritizing due reviews and new material. Their answer boxes start empty; your completion history and notes stay saved.</p><p class="section-caption">Original problems researched against <a href="https://stat110.hsites.harvard.edu/strategic-practice-problems" target="_blank" rel="noopener">Harvard Stat 110 practice topics</a> and <a href="https://ocw.mit.edu/courses/6-041sc-probabilistic-systems-analysis-and-applied-probability-fall-2013/pages/resource-index/" target="_blank" rel="noopener">MIT 6.041 resources</a>. Per-question links provide further study.</p></div>`+
    probabilityAreas.map(area=>{
      const items=bank.filter(p=>p.probabilityArea===area);
      return `<section style="margin-top:28px"><div class="section-title"><h2>${esc(area==='Bayes rule'?'Bayes’ rule':area)}</h2><button class="secondary" data-probability-drill="${esc(area)}">Start a 5-question drill →</button></div><p class="section-caption">${esc(probabilityDescriptions[area])} · ${items.filter(completed).length}/${items.length} completed</p><div class="panel">${items.map((p,i)=>`<button class="problem-row" data-open="${p.id}"><span class="num">${i+1}</span><span class="row-text"><strong>${esc(p.title)}</strong><span class="sub">${p.difficulty} · ${p.minutes} min · Number or fraction</span></span>${statusPill(p)}<span class="arrow">→</span></button>`).join('')}</div></section>`;
    }).join('');
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-probability-drill]');if(!button)return;
  const choices=recommended('theory').filter(p=>p.probabilityArea===button.dataset.probabilityDrill).slice(0,5);
  if(!choices.length)return;
  state.session={ids:choices.map(p=>p.id),index:0,started:Date.now()};saveSoon();openProblem(choices[0].id,true);
});
