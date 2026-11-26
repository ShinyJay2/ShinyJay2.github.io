/* Original FlashAttention, Algorithm 1. Every frame is a complete snapshot,
   so scrubbing backward needs neither reverse animation nor mutable math. */
;(() => {
  'use strict';
  const sub = ['','₁','₂','₃'];
  const frames = [];
  const covered = [0,0,0];
  function add(phase,j=0,i=0) {
    if (phase==='write') covered[i-1]=j;
    frames.push({phase,j,i,coverage:[...covered]});
  }
  add('initial');
  for (let j=1;j<=3;j++) {
    add('load',j);
    for (let i=1;i<=3;i++) for (const p of ['read','score','merge','write']) add(p,j,i);
  }
  const last=frames.length-1;
  function explain({phase,j,i}) {
    const q=`Q${sub[i]}`, k=`K${sub[j]}`, v=`V${sub[j]}`, o=`O${sub[i]}`;
    switch(phase) {
      case 'initial': return ['Initialize the row summaries','HBM starts with O = 0, m = −∞ and ℓ = 0 for every row. No score or probability matrix is allocated.'];
      case 'load': return [`Stage ${k} and ${v}`,`Copy this pair into SRAM once. It stays here while the SM visits all three query blocks.`];
      case 'read': return [`Read ${q} and its summary`, j===1?`Load ${q} and its initial O, m and ℓ from HBM. ${k} and ${v} are already on chip.`:`Reload ${q} and the O, m and ℓ saved on the previous pass. ${k} and ${v} stay resident.`];
      case 'score': return [`Form S${sub[i]}${sub[j]} on chip`,`The SM cores multiply ${q} by ${k}ᵀ and scale by 1/√d. Only this score tile occupies scratch space.`];
      case 'merge': return [`Merge with ${v}`,`Use the new row maximum to rescale old and new weights. Merge their denominators and weighted values into normalized ${o}; release the score tile.`];
      default: return [j===3?`Complete ${o}`:`Save partial ${o}`,j===3?`Write ${o}, m and ℓ back to HBM. ${i===3?'All rows now cover all three K/V blocks. No full score or probability matrix was stored.':`This output block now covers all three K/V blocks; the next query still needs its last update.`}`:`Write updated ${o}, m and ℓ to HBM. ${o} now covers ${j} of 3 K/V blocks; its next visit resumes from here.`];
    }
  }
  const rect=(x,y,w,h,c,r=5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${c}"/>`;
  const text=(x,y,s,c='',a='middle')=>`<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${s}</text>`;
  const path=(d,c)=>`<path d="${d}" class="${c}"/>`;
  const pt=(x,y)=>({x,y});
  // A translating inner group leaves its outer anchor in SVG user coordinates.
  function tile(pos,label,tone,cell,opts={}) {
    const {x,y}=pos, cols=opts.score?4:3,rows=opts.score?3:2,w=cols*cell,h=rows*cell;
    const from=opts.from, flight=from?` data-fal-dx="${from.x-x}" data-fal-dy="${from.y-y}"`:'';
    let cells='';
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) cells+=`<rect x="${c*cell-w/2+0.75}" y="${r*cell-h/2+0.75}" width="${cell-1.5}" height="${cell-1.5}" opacity="${.4+.13*((2*r+c)%5)}"/>`;
    return `<g transform="translate(${x} ${y})" class="fal-${tone}"${opts.score?' data-fal-score=""':''}><g${flight}>${rect(-w/2-4,-h/2-2,w+8,h+4,'fal-tile-bg',1)}${cells}${path(`M${-w/2+1} ${-h/2-2}h-5v${h+4}h5 M${w/2-1} ${-h/2-2}h5v${h+4}h-5`,'fal-bracket')}${text(0,-h/2-6,label,'fal-matrix-label')}</g></g>`;
  }
  function scene(f,w,n,animate) {
    const {phase:p,j,i,coverage}=f, small=w<500,cell=small?6.5:9, sx=5,sw=small?w*.405:w*.42,hx=small?w*.49:w*.53,hw=w-hx-5,mid=sx+sw/2, hmid=hx+hw/2;
    const l1=sx+sw*.26,l2=sx+sw*.74;
    const a={K:pt(l1,105),V:pt(l2,105),Q:pt(l1,198),O:pt(l2,198)};
    const h=(t,index)=>small?pt(hx+hw*(index-.5)/3, [92,141,190,243]['QKVO'.indexOf(t)]):pt(hx+hw*([.13,.35,.57,.84]['QKVO'.indexOf(t)]),[99,171,243][index-1]);
    const info=explain(f), csmall='fal-small', head='fal-section';
    let body=rect(sx,9,sw,355,'fal-sm')+rect(hx,9,hw,355,'fal-hbm')+
      text(sx+10,35,'SRAM','fal-title','start')+text(hx+10,35,'HBM','fal-title','start')+
      text(hx+hw-9,34,'O with m, ℓ','fal-small','end')+text(sx+10,59,'Resident K/V',head,'start')+text(hx+10,59,'Backing tiles',head,'start')+
      path(`M${sx+9} 129h${sw-18} M${sx+9} 233h${sw-18}`,'fal-rule')+
      text(sx+10,153,'Active query',head,'start')+text(sx+10,257,'SM core scratch',head,'start')+
      text(mid,222,i?`O${sub[i]} with m, ℓ`:'Row summary: empty',csmall);
    const ghost=(pos,name)=>rect(pos.x-13,pos.y-7,26,14,'fal-ghost',2)+text(pos.x,pos.y-13,name,csmall);
    body+='<!-- transfer paths -->';
    const moving=[], routes=[];
    function show(dest,name,tone,source) {
      if(source) {
        // Arrows follow the same path as the copy. Originals never move.
        let dx=dest.x-source.x,dy=dest.y-source.y, len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
        const x=dest.x-ux*(cell*2.5),y=dest.y-uy*(cell*2.5);
        routes.push(path(`M${source.x+ux*cell*2.5} ${source.y+uy*cell*2.5}L${x} ${y}m${-ux*6-uy*3} ${-uy*6+ux*3}l${ux*6+uy*3} ${uy*6-ux*3}l${-ux*6+uy*3} ${-uy*6-ux*3}`,'fal-route fal-'+tone));
      }
      const t=tile(dest,name,tone,cell,{from:animate&&source});
      if(source) moving.push(t); else body+=t;
    }
    for(const t of ['Q','K','V','O']) for(let b=1;b<=3;b++) {
      const pos=h(t,b),tone=t==='O'?'o':t==='Q'?'q':'kv';
      body+=tile(pos,t+sub[b],tone,cell);
      if(t==='O') {
        const num=coverage[b-1],bw=small?10:13, landing=animate&&p==='write'&&i===b;
        const coverageMark=count=>[0,1,2].map(z=>rect(pos.x+(z-1.5)*bw,pos.y+cell+6,bw-1,4,z<count?'fal-filled':'fal-unfilled',.8)).join('')+text(pos.x,pos.y+cell+23,count===3?'COMPLETE':`${count}/3`,'fal-coverage');
        body+=`<g data-fal-output="${b}" data-fal-covered="${num}">${landing?`<g data-fal-before-arrival="" opacity="0">${coverageMark(num-1)}</g>`:''}<g${landing?' data-fal-after-arrival=""':''}>${coverageMark(num)}</g></g>`;
      }
    }
    for(const t of ['K','V','Q','O']) {
      const kv=t==='K'||t==='V', token=kv?j:i, tone=kv?'kv':t==='Q'?'q':'o';
      if(!token) body+=ghost(a[t],t); else show(a[t],t+sub[token],tone,((kv&&p==='load')||(!kv&&p==='read'))&&h(t,token));
    }
    if(p==='write') show(h('O',i),'O'+sub[i],'o',a.O);
    body+=rect(sx+10,272,sw-20,77,p==='score'?'fal-score-live':'fal-scratch')+
      (p==='score'?tile(pt(mid,320),'S'+sub[i]+sub[j],'s',small?7:9,{score:true}):
       p==='merge'?text(mid,304,'Merge with V'+sub[j],'fal-action')+text(mid,329,'S tile released',csmall):text(mid,315,'No score tile',csmall));
    body+=rect(hx+10,287,hw-20,62,'fal-never')+text(hmid,311,'N × N','fal-no-matrix')+text(hmid,335,'EMPTY: no S or P',csmall);
    return `<svg viewBox="0 0 ${w} 374" role="img" aria-label="Frame ${n+1}. ${info[0]}. ${info[1]} HBM output coverage: ${coverage.join(', ')} of three K/V blocks.">${body.replace('<!-- transfer paths -->',routes.join(''))}${moving.join('')}</svg>`;
  }
  const segments=(v,kind)=>`<span class="fal-segments fal-${kind}" aria-hidden="true">${[1,2,3].map(b=>`<i class="${b<v?'fal-past':b===v?'fal-current':''}"></i>`).join('')}</span>`;
  function mount(el) {
    if(el.classList.contains('fal-widget')) return;
    el.classList.add('fal-widget');
    el.innerHTML=`<div class="viz-heading"><h3>One K/V block, three query visits</h3></div><p>Follow Algorithm 1 from HBM to SRAM and back. Each green output bar counts K/V blocks processed, not the size of the output.</p>
      <div class="fal-timeline" data-fal-timeline></div><div class="fal-scene" data-fal-scene tabindex="0" role="group" aria-label="Loop animation. Left and right arrows step. Space plays or pauses. Home restarts. End shows the result."></div>
      <div class="fal-controls" role="group" aria-label="Animation controls"><div class="fal-buttons"><button type="button" data-fal-play>Play</button><button type="button" data-fal-back>Back</button><button type="button" data-fal-next>Next</button><button type="button" data-fal-restart>Restart</button><label>Speed <select data-fal-speed aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label></div>
      <label class="fal-seek"><span data-fal-counter></span><input type="range" data-fal-range min="0" max="${last}" step="1" value="0" aria-label="Animation frame"></label><small data-fal-notice hidden>Reduced motion is on. Use Back, Next or the slider to explore.</small></div>
      <div class="viz-result fal-caption" data-fal-caption aria-live="polite" aria-atomic="true"></div>`;
    const q=s=>el.querySelector(`[data-fal-${s}]`), stage=q('scene'), range=q('range'), play=q('play'), speed=q('speed');
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
    let n=0,timer=0,playing=false,inView=true,width=0,flights=[];
    function controls(){
      play.textContent=playing?'Pause':'Play'; play.disabled=reduce.matches||n===last;
      q('back').disabled=n===0; q('next').disabled=n===last; q('restart').disabled=n===0&&!playing;
      q('notice').hidden=!reduce.matches; el.dataset.falPlaying=String(playing);
      q('caption').setAttribute('aria-live',playing?'off':'polite');
    }
    function stop(){clearTimeout(timer);playing=false;for(const a of flights)a.cancel();flights=[];controls();}
    function draw(move=false){
      width=stage.clientWidth<490?350:650;
      const f=frames[n], [title,copy]=explain(f), anim=move&&!reduce.matches&&!document.hidden&&inView;
      el.dataset.step=String(n);el.dataset.falPhase=f.phase;el.dataset.falOuter=String(f.j);el.dataset.falInner=String(f.i);
      stage.innerHTML=scene(f,width,n,anim);flights=[];
      if(anim)stage.querySelectorAll('[data-fal-dx]').forEach(g=>{
        if(g.animate) flights.push(g.animate([{transform:`translate(${g.dataset.falDx}px, ${g.dataset.falDy}px)`},{transform:'translate(0px, 0px)'}],{duration:820/Number(speed.value),easing:'cubic-bezier(.38,.04,.24,1)'}));
      });
      if(anim && f.phase==='write') for (const suffix of ['before','after']) {
        const g=stage.querySelector(`[data-fal-${suffix}-arrival]`),opacity=suffix==='before'?1:0;
        if(g?.animate) flights.push(g.animate([{opacity},{opacity}],{duration:820/Number(speed.value)}));
      }
      q('timeline').innerHTML=`<span>Outer K/V <b>j = ${f.j||'–'}/3</b>${segments(f.j,'kv')}</span><span>Inner Q <b>i = ${f.i||'–'}/3</b>${segments(f.i,'q')}</span>`;
      range.value=n;range.setAttribute('aria-valuetext',`Frame ${n+1} of ${frames.length}: ${title}`);
      q('counter').textContent=`Frame ${n+1} / ${frames.length}`;q('caption').innerHTML=`<strong>${title}.</strong> ${copy}`; controls();
    }
    function set(v){stop();const old=n;n=Math.min(last,Math.max(0,v));draw(n===old+1);}
    function schedule(){clearTimeout(timer);timer=setTimeout(()=>{
      if(!playing||document.hidden||!inView||reduce.matches){stop();return;}
      n++; if(n===last)playing=false;draw(true); if(playing)schedule();
    },2150/Number(speed.value));}
    function toggle(){if(playing){stop();return;} if(reduce.matches||document.hidden||!inView||n===last)return;
      playing=true;n++;if(n===last)playing=false;draw(true);if(playing)schedule();}
    play.addEventListener('click',toggle);q('back').addEventListener('click',()=>set(n-1));q('next').addEventListener('click',()=>set(n+1));q('restart').addEventListener('click',()=>set(0));
    range.addEventListener('input',()=>set(Number(range.value)));speed.addEventListener('change',()=>{if(playing)schedule();});
    stage.addEventListener('keydown',e=>{if(e.altKey||e.metaKey||e.ctrlKey)return;const fn={ArrowLeft:()=>set(n-1),ArrowRight:()=>set(n+1),Home:()=>set(0),End:()=>set(last),' ':toggle}[e.key];if(fn){e.preventDefault();fn();}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
    if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(!inView)stop();}).observe(el);
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if((stage.clientWidth<490?350:650)!==width)draw();}).observe(stage);
    const motionChange=()=>{stop();draw();}; if(reduce.addEventListener)reduce.addEventListener('change',motionChange);else reduce.addListener(motionChange);
    draw();
  }
  const init=()=>document.querySelectorAll('.explainer[data-explainer="fa-original-loop"]').forEach(mount);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
