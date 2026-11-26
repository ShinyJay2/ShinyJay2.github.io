/* Numeric, seekable calculations for Figures 6 and 7. No stored score matrix. */
;(() => {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const term = s => `<span class="calc-operand">${esc(s)}</span>`;
  const op = s => `<span class="calc-operator">${esc(s)}</span>`;
  const expression = parts => parts.map((s,i) => i%2 ? op(s) : term(s)).join('');
  const eq = (label, parts, result, target='') => `<div class="calc-equation"><span class="calc-equation-label">${esc(label)}</span><div class="calc-expression">${expression(parts)}</div><span class="calc-equals" aria-hidden="true">↓</span><span class="calc-answer"${target?` data-calc-target="${target}"`:''}><span class="calc-sr">equals </span>${esc(result)}</span></div>`;
  const note = text => `<div class="calc-context">${esc(text)}</div>`;
  const state = (m,l,u) => ({m,l,u});
  const normalize = [
    {title:'Turn scores into weights',phase:'Original weights, not probabilities',body:note('Scores: 0, ln 2, ln 4, ln 8')+`<div class="calc-four">${['0','ln 2','ln 4','ln 8'].map((s,i)=>eq(`Weight ${i+1}`,[`exp(${s})`],[1,2,4,8][i])).join('')}</div>`,caption:'Exponentiating gives 1, 2, 4, 8. Their sum is 15, not 1.'},
    {title:'Choose a common scale',phase:'Maximum-based rescaling',body:note('Maximum score m = ln 8')+eq('Common divisor',['exp(ln 8)'],'8'),caption:'Subtracting the largest score means dividing every exponential by 8. This changes the scale, not the ratios.'},
    {title:'Divide every weight by 8',phase:'Rescaled weights, still not probabilities',body:`<div class="calc-four">${[1,2,4,8].map((v,i)=>eq(`Weight ${i+1}`,[v,'÷',8],['0.125','0.25','0.5','1'][i])).join('')}</div>`,caption:'Each weight moves onto the same smaller scale. The ratio remains 1 : 2 : 4 : 8; this is not probability normalization.'},
    {title:'Add the rescaled weights',phase:'Find the denominator',body:eq('Sum of weights',['0.125','+','0.25','+','0.5','+','1'],'1.875'),caption:'The rescaled weights sum to 1.875, not 1. We still need one division by this sum.'},
    {title:'Now normalize by the sum',phase:'Probabilities, sum = 1',body:`<div class="calc-four">${['0.125','0.25','0.5','1'].map((v,i)=>eq(`Probability ${i+1}`,[v,'÷','1.875'],`${[1,2,4,8][i]}/15`)).join('')}</div>`+note('1/15 + 2/15 + 4/15 + 8/15 = 1'),caption:'Only this division makes probabilities. Dividing the original weights by 15 gives exactly the same answer.'}
  ];
  const online = [
    {title:'Summarize tile A',phase:'A complete, B pending',state:state('ln 2','1.5','25'),body:note('A: scores [0, ln 2], V [10, 20], weights [0.5, 1]')+eq('Denominator ℓ',['0.5','+','1'],'1.5','l')+eq('Weighted sum u',['0.5 × 10','+','1 × 20'],'25','u'),caption:'Keep only the maximum m, denominator ℓ and unnormalized weighted sum u. B has not contributed yet.'},
    {title:'A larger maximum arrives',phase:'Old A state, B pending',state:state('ln 2','1.5','25'),body:note('B: scores [ln 4, ln 8], V [30, 40]')+eq('Candidate maximum',['max(ln 2, ln 4, ln 8)'],'ln 8')+note('Stored A is still on the ln 2 scale.'),caption:'The next scale is ln 8. Do not add B to A while the two use different scales.'},
    {title:'Find the old-state multiplier',phase:'Old A state, rescaling pending',state:state('ln 2','1.5','25'),body:note('exp(old m − new m) = exp(ln 2 − ln 8)')+eq('Old-scale → new-scale',['2','÷','8'],'1/4'),caption:'Every old weight shrinks by 1/4, so both old totals must shrink by 1/4 too. We update the totals, not an array of past weights.'},
    {title:'Rescale the old denominator',phase:'A rescaling, ℓ done, u pending',state:state('ln 2','0.375','25'),body:eq('Old ℓ × multiplier',['1.5','×','1/4'],'0.375','l')+note('ℓ is on the new scale; u is still on the old scale.'),caption:'1.5 × 1/4 becomes 0.375. This intermediate state is not ready to merge; the old numerator must follow.'},
    {title:'Rescale the old numerator',phase:'A rescaled, B not yet added',state:state('ln 8','0.375','6.25'),body:eq('Old u × multiplier',['25','×','1/4'],'6.25','u')+note('Both old totals now use m = ln 8.'),caption:'25 × 1/4 becomes 6.25. Commit m = ln 8 now that both A totals have been rescaled.'},
    {title:'Calculate tile B’s contribution',phase:'A rescaled, B contribution pending',state:state('ln 8','0.375','6.25'),body:note('B weights: exp(ln 4 − ln 8) = 0.5; exp(ln 8 − ln 8) = 1')+eq('B denominator',['0.5','+','1'],'1.5')+eq('B weighted sum',['0.5 × 30','+','1 × 40'],'55'),caption:'B contributes 1.5 to the denominator and 55 to the weighted sum. The state strip still contains only rescaled A.'},
    {title:'Merge the denominators',phase:'A + B, ℓ added, u pending',state:state('ln 8','1.875','6.25'),body:note('Rescaled A + new B')+eq('Update ℓ',['0.375','+','1.5'],'1.875','l'),caption:'Add B’s 1.5 to the rescaled old 0.375. The numerator is still waiting for its addition.'},
    {title:'Merge the weighted sums',phase:'A + B, both totals added',state:state('ln 8','1.875','61.25'),body:note('Rescaled A + new B')+eq('Update u',['6.25','+','55'],'61.25','u'),caption:'Add B’s 55 to the rescaled old 6.25. Now m, ℓ and u summarize all four values.'},
    {title:'Divide once for the output',phase:'A + B complete, normalized output',state:state('ln 8','1.875','61.25'),body:eq('Output O = u / ℓ',['61.25','÷','1.875'],'≈ 32.6667'),caption:'O ≈ 32.6667 (exactly 98/3). The numerator u stays unnormalized until this final division.'}
  ];
  function mount(el,frames,isOnline) {
    if(el.dataset.calcMounted) return;
    el.dataset.calcMounted='true'; el.classList.add('calc-widget');
    el.innerHTML=`<div class="viz-heading"><h3>${isOnline?'Rescale the past, then add the present':'Rescaling is not normalization'}</h3></div><p>${isOnline?'Follow the numbers into a persistent row summary.':'Two divisions, two different jobs. Watch each operand become a result.'}</p><div class="calc-workspace"><div class="calc-step-title"></div><div class="calc-phase"></div><div class="calc-scene" tabindex="0" role="group" aria-label="Calculation animation. Left and right arrows step; Space plays or pauses; Home restarts."></div>${isOnline?'<div class="calc-state-label">Persistent row state <span>m: maximum, ℓ: denominator, u: weighted sum</span></div><div class="calc-state" role="group" aria-label="Persistent row state">'+['m','l','u'].map((k,i)=>`<div><span>${['m','ℓ','u'][i]}</span><b data-calc-state="${k}">pending</b></div>`).join('')+'</div>':''}</div><div class="calc-controls" role="group" aria-label="Calculation playback controls"><div class="calc-buttons"><button type="button" data-calc-action="play" aria-label="Play calculation">Play</button><button type="button" data-calc-action="back" aria-label="Previous calculation step">Back</button><button type="button" data-calc-action="next" aria-label="Next calculation step">Next</button><button type="button" data-calc-action="restart" aria-label="Restart calculation">Restart</button></div><label class="calc-seek"><span class="calc-counter"></span><input type="range" min="0" max="${frames.length-1}" value="0" step="1" aria-label="Calculation step"></label><small class="calc-motion-note" hidden>Reduced motion: steps change without movement.</small></div><div class="viz-result calc-caption" aria-live="polite" aria-atomic="true"></div>`;
    const q = s => el.querySelector(s), scene=q('.calc-scene'), slider=q('input'), play=q('[data-calc-action="play"]');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let renderedState=null;
    let index=0, playing=false, visible=!('IntersectionObserver' in window), timer=0, animations=[], ghosts=[], epoch=0;
    function clean(){ epoch++; animations.forEach(a=>a.cancel()); animations=[]; ghosts.forEach(g=>g.remove()); ghosts=[]; }
    function animate(node,keyframes,options){ if(!node.animate) return null; const a=node.animate(keyframes,options); animations.push(a); return a; }
    function flight(source,dest,delay=0){
      const a=source.getBoundingClientRect(), b=dest.getBoundingClientRect(), root=el.getBoundingClientRect();
      const clone=document.createElement('span'); clone.className='calc-flying'; clone.textContent=source.textContent;
      Object.assign(clone.style,{left:`${a.left-root.left}px`,top:`${a.top-root.top}px`,width:`${a.width}px`,fontSize:getComputedStyle(source).fontSize});
      clone.setAttribute('aria-hidden','true'); el.appendChild(clone); ghosts.push(clone);
      animate(clone,[{transform:'translate(0,0) scale(1)',opacity:0},{transform:'translate(0,0) scale(1)',opacity:1,offset:.12},{transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(.72)`,opacity:1,offset:.84},{transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(.55)`,opacity:0}],{duration:760,delay,fill:'both',easing:'cubic-bezier(.4,0,.2,1)'});
    }
    function buttons(){
      play.textContent=playing?'Pause':'Play'; play.setAttribute('aria-label',playing?'Pause calculation':'Play calculation'); play.setAttribute('aria-pressed',String(playing));
      q('[data-calc-action="back"]').disabled=index===0; q('[data-calc-action="next"]').disabled=index===frames.length-1;
    }
    function schedule(){ clearTimeout(timer); if(playing&&visible&&!document.hidden) timer=setTimeout(()=>{ if(!el.isConnected){stop();clean();observer?.disconnect();resizeObserver?.disconnect();return;} if(index===frames.length-1){stop();return;} index++; render(true); schedule(); },2800); }
    function stop(){playing=false;clearTimeout(timer);buttons();}
    function render(motion){
      clean(); const f=frames[index], token=epoch; const move=motion&&!reduced.matches&&!!el.animate;
      q('.calc-step-title').textContent=f.title; q('.calc-phase').textContent=f.phase; scene.innerHTML=f.body;
      q('.calc-caption').textContent=f.caption; q('.calc-counter').textContent=`${index+1} / ${frames.length}`; slider.value=String(index); slider.setAttribute('aria-valuetext',`Step ${index+1}: ${f.title}`);
      const old={}; if(isOnline) for(const k of ['m','l','u']){const n=q(`[data-calc-state="${k}"]`);old[k]=renderedState?.[k] ?? 'pending';n.textContent=f.state[k];n.classList.toggle('calc-changed',old[k]!==f.state[k]);}
      if(isOnline) renderedState={...f.state};
      if(move){
        scene.querySelectorAll('.calc-equation').forEach((row,i)=>{const result=row.querySelector('.calc-answer');row.querySelectorAll('.calc-operand').forEach(s=>flight(s,result,i*95));animate(result,[{opacity:.15,transform:'translateY(10px) scale(.85)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:380,delay:650+i*95,fill:'both'});});
        if(isOnline) for(const k of ['m','l','u']) if(old[k]!==f.state[k]){
          const target=q(`[data-calc-state="${k}"]`), source=scene.querySelector(`[data-calc-target="${k}"]`);
          if(source) flight(source,target,1100);
          // The state value remains at its previous number until the result arrives.
          target.textContent=old[k];
          const a=animate(target,[{transform:'translateY(0)',opacity:1},{transform:'translateY(-8px)',opacity:.2},{transform:'translateY(0)',opacity:1}],{duration:420,delay:source?1650:1000});
          if(a) a.finished.then(()=>{if(epoch===token)target.textContent=f.state[k];}).catch(()=>{}); else target.textContent=f.state[k];
        }
      }
      buttons(); if(index===frames.length-1) stop();
    }
    function jump(n){stop();index=Math.max(0,Math.min(frames.length-1,n));render(true);}
    el.querySelectorAll('[data-calc-action]').forEach(button=>button.addEventListener('click',()=>{switch(button.dataset.calcAction){case 'play':if(playing){stop();}else{if(index===frames.length-1)index=0;playing=true;render(true);schedule();}break;case 'back':jump(index-1);break;case 'next':jump(index+1);break;case 'restart':jump(0);break;}}));
    slider.addEventListener('input',()=>jump(Number(slider.value)));
    scene.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End',' '].includes(e.key)){e.preventDefault();if(e.key===' ')play.click();else jump(e.key==='Home'?0:e.key==='End'?frames.length-1:index+(e.key==='ArrowLeft'?-1:1));}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clean();render(false);}schedule();});
    reduced.addEventListener('change',()=>{stop();render(false);q('.calc-motion-note').hidden=!reduced.matches;});
    const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)render(false);schedule();},{threshold:.12}):null;
    observer?.observe(el);
    let lastWidth=el.clientWidth;
    const resizeObserver='ResizeObserver' in window?new ResizeObserver(()=>{const width=el.clientWidth;if(width!==lastWidth){lastWidth=width;render(false);}}):null;
    resizeObserver?.observe(el);
    q('.calc-motion-note').hidden=!reduced.matches;render(false);
    // Explicit Play starts the 2.8-second sequence; no unsolicited motion.
  }
  function init(){for(const name of ['fa-normalize','fa-online'])document.querySelectorAll(`[data-explainer="${name}"]`).forEach(el=>mount(el,name==='fa-online'?online:normalize,name==='fa-online'));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
