(() => {
  'use strict';

  // All strings are figure data, never user input. SVGs are redrawn, but
  // controls stay mounted so keyboard focus survives state and layout changes.
  const text = (x,y,s,cls='',anchor='middle') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${s}</text>`;
  const rect = (x,y,w,h,cls,r=5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${cls}"/>`;
  const path = (d,c) => `<path d="${d}" class="${c}"/>`;
  const line = (x,y,X,Y,c) => path(`M${x} ${y} L${X} ${Y}`,c);
  function arrow(x,y,X,Y) {
    const a = Math.atan2(Y-y,X-x), p = t => `${X-6*Math.cos(a+t)} ${Y-6*Math.sin(a+t)}`;
    return path(`M${x} ${y} L${X} ${Y} M${p(-.5)} L${X} ${Y} L${p(.5)}`,'fax-arrow');
  }
  function matrix(x,y,n=3,result=false) {
    const d=4,b=n*d/2;
    let body='';
    for(let r=0;r<n;r++) for(let c=0;c<n;c++) body+=`<rect x="${c*d-b}" y="${r*d-b}" width="3.1" height="3.1" opacity="${.45+.17*((r+c)%4)}"/>`;
    return `<g transform="translate(${x} ${y})" class="fax-tile${result?' fax-result-tile':''}">${body}${path(`M${-b} ${-b-1}h-3v${2*b+2}h3 M${b} ${-b-1}h3v${2*b+2}h-3`,'fax-outline')}</g>`;
  }
  const frac = (x,y,n,d,width) => text(x,y-8,n,'fax-math')+line(x-width/2,y,x+width/2,y,'fax-vinculum')+text(x,y+22,d,'fax-math');
  const standard = [
    ['Score the keys','QKᵀ / √d','read Q, K','write S','Full S','Read Q and K, compute scaled dot products, then write the N × N score matrix S to HBM.'],
    ['Normalize rows','softmax(S)','read S','write P','Full P','Read S back, normalize each row, then write the N × N probability matrix P to HBM.'],
    ['Weight values','P × V','read P, V','','P and V','Read the probabilities back with V. Multiply and sum to get the output rows.'],
    ['Store output','O','','write O','Output O','Write O to HBM. S and P each made a write-and-read round trip along the way.']
  ];
  const flash = [
    ['Score tiles','QᵢKⱼᵀ / √d','read tiles','','Q, K, V','Read input tiles from HBM. Compute a score tile in on-chip scratch space.'],
    ['Update weights','online softmax','','','No full S','Use the scores where they were computed. Track the row maximum and weight sum without writing S to HBM.'],
    ['Weight values','update u with Vⱼ','','','No full P','Use the same tile’s weights with V to update the numerator. Discard those weights; repeat with the next tile.'],
    ['Store output','Oᵢ = u / ℓ','','write Oᵢ','Output O','After the last tile, divide by the row weight sum and write the output tile. Fusion skips full S and P, not input reads or output writes.']
  ];
  function traffic(mode,i,w) {
    const rows=mode?flash:standard, left=8, end=Math.round(w*.43), right=Math.round(w*.67), hx=(right+w-7)/2, mid=(left+end)/2, cross=(end+right)/2;
    let g=text(mid,24,'On the SM','fax-title')+text(mid,42,mode?'fused local work':'arithmetic units','fax-small')+text(hx,24,'HBM','fax-title')+text(hx,42,'off-chip memory','fax-small');
    rows.forEach(([label,op,read,write,store],r)=>{
      const top=54+r*68,y=top+28, active=r===i,local=!read&&!write;
      const panel=active?'fax-active':'fax-panel';
      g+=`<g class="${active?'fax-flow fax-enter':''}">`+rect(left,top,end-left,58,panel)+text(mid,top+23,label,'fax-title')+text(mid,top+44,op)+rect(right,top,w-right-7,58,active&&!local?panel:'fax-panel');
      if(local) g+=text(hx,y+5,store,'fax-small');
      else g+=matrix(hx,top+17,(!mode&&r<2)?5:3,r===3)+text(hx,top+46,store);
      if(read&&write) {
        g+=text(cross,top+12,read,'fax-small')+arrow(right-4,top+18,end+4,top+18)+text(cross,top+39,write,'fax-small')+arrow(end+4,top+45,right-4,top+45);
      } else if(!local) {
        g+=text(cross,y-2,read||write,'fax-small')+arrow(read?right-4:end+4,y+5,read?end+4:right-4,y+5);
      }
      if(r<3) g+=arrow(mid,top+59,mid,top+67);
      g+='</g>';
    });
    return [g,323,rows[i][0],rows[i][5]];
  }

  const averageNotes = [
    ['Normalize first','Each value gets its share of the same total weight, 1 + 3 = 4. The two shares add to one.'],
    ['Multiply into the numerators','Multiplying a fraction by a value changes only its numerator. Both denominators still represent the same total weight, so do not add them.'],
    ['Accumulate first','Sum the weighted values into u and the weights into ℓ. Divide once: u/ℓ gives exactly the same weighted average without storing individual probabilities.']
  ];
  function average(_,i,w) {
    const cx=w/2, left=w*.26,right=w*.74, card=w*.42;
    let g='';
    for(const [x,j] of [[left,0],[right,1]]) {
      g+=rect(x-card/2,12,card,46,'fax-panel')+text(x,30,'Value '+(j+1),'fax-small')+text(x,49,j?'weight 3, V = 20':'weight 1, V = 10');
    }
    if(i<2) {
      g+=arrow(left,62,left,82)+arrow(right,62,right,82)+text(cx,126,'+','fax-math');
      if(i===0) {
        g+=frac(left-23,119,'1','4',23)+text(left+21,126,'× 10','fax-math')+frac(right-23,119,'3','4',23)+text(right+21,126,'× 20','fax-math');
      } else {
        g+=frac(left,119,'1 × 10','4',72)+frac(right,119,'3 × 20','4',72);
      }
      g+=arrow(left,151,cx-38,183)+arrow(right,151,cx+38,183)+rect(cx-82,188,164,65,'fax-active');
      if(i===0) g+=text(cx,214,'One weight sum','fax-small')+text(cx,240,'ℓ = 1 + 3 = 4','fax-math');
      else g+=frac(cx,220,'10 + 60','4',82);
    } else {
      // Both input pairs feed both reductions. Labels name their distinct jobs.
      g+=arrow(left-8,62,left-8,93)+arrow(right-8,62,left+20,93)+arrow(left+8,62,right-20,93)+arrow(right+8,62,right+8,93);
      g+=rect(left-card/2,98,card,63,'fax-panel')+rect(right-card/2,98,card,63,'fax-panel')+text(left,120,'Weighted values: u','fax-small')+text(left,148,'10 + 60 = 70','fax-math')+text(right,120,'Weights: ℓ','fax-small')+text(right,148,'1 + 3 = 4','fax-math');
      g+=arrow(left,165,cx-38,186)+arrow(right,165,cx+38,186)+rect(cx-95,191,190,65,'fax-active')+text(cx-62,229,'O =','fax-math')+frac(cx-17,223,'70','4',40)+text(cx+50,230,'= 17.5','fax-math');
    }
    return [g,269,...averageNotes[i]];
  }

  const metrics=[
    ['Arithmetic','GFLOPs',80,[66.6,75.2],'FlashAttention does more arithmetic here, not less.'],
    ['HBM traffic','GB',50,[40.3,4.4],'This counts bytes transferred to and from HBM, not peak memory allocated.'],
    ['Attention time','ms',50,[41.7,7.3],'Less HBM traffic more than offsets the extra arithmetic in this attention run.'],
    ['Whole training','days',10,[9.5,4.7,2.7],'These are end-to-end training times, not attention kernel speedups. All three runs report validation perplexity 18.2.']
  ];
  function benchmark(mode,_,w) {
    const [title,unit,max,data,note]=metrics[mode], training=mode===3;
    const names=training?['Hugging Face','Megatron-LM','FlashAttention']:['Standard attention','FlashAttention'];
    const x=10,end=w-15,span=end-x,bottom=34+data.length*50;
    let g=text(x,22,title+' ('+unit+')','fax-title','start');
    data.forEach((v,j)=>{
      const y=44+j*50, cls=(j===data.length-1?'fax-bar-fa':j===1?'fax-bar-alt':'fax-bar');
      g+=text(x,y+5,names[j],'','start')+text(end,y+5,`${v} ${unit}`,'fax-numeric','end')+rect(x,y+13,span,12,'fax-panel',2)+rect(x,y+13,span*v/max,12,cls,2);
    });
    g+=line(x,bottom,end,bottom,'fax-axis');
    [0,.5,1].forEach((f,j)=>{const X=x+span*f;g+=line(X,bottom,X,bottom+4,'fax-axis')+text(X,bottom+18,max*f,'fax-small',['start','middle','end'][j]);});
    const setup=training?['Table 2: GPT-2 small on eight A100s.']:['Figure 2: GPT-2 medium on A100, forward + backward.','Sequence 1024, head dimension 64, 16 heads, batch 64.'];
    setup.forEach((s,j)=>g+=text(x,bottom+44+j*17,s,'fax-small','start'));
    return [g,bottom+53+(setup.length-1)*17,title,note];
  }
  const figures = {
    'fa-traffic':{title:'Which matrices cross the HBM boundary?',lead:'Follow one forward pass. Arrows across the gap are HBM transfers.',modes:['Standard','FlashAttention'],steps:4,draw:traffic},
    'fa-average':{title:'Why can we divide just once?',lead:'Two values, 10 and 20, have weights 1 and 3.',steps:3,draw:average},
    'fa-benchmark':{title:'What did the paper measure?',lead:'Reported measurements from the FlashAttention paper, not benchmarks run by this page.',modes:metrics.map(m=>m[0]),draw:benchmark}
  };
  function mount(el,spec) {
    if(el.classList.contains('fax-widget')) return;
    el.classList.add('fax-widget');
    const {title,lead,modes,steps,draw}=spec;
    let mode=0,i=0,width=0;
    const button=(s,attrs)=>`<button class="fax-control" type="button" ${attrs}>${s}</button>`;
    const choices=modes?`<div class="fax-choices" role="group" aria-label="${title}">${modes.map((s,j)=>button(s,`data-fax-mode="${j}" aria-pressed="${j===0}"`)).join('')}</div>`:'';
    const nav=steps?`<div class="fax-steps">${button('Back','data-fax-back aria-label="Previous step"')}<span class="fax-progress"></span><input type="range" class="fax-range" aria-label="Diagram step" min="1" max="${steps}" step="1" value="1">${button('Next','data-fax-next aria-label="Next step"')}</div>`:'';
    el.innerHTML=`<div class="viz-heading"><h3>${title}</h3></div><p>${lead}</p><div class="fax-controls">${choices}${nav}</div><div class="fax-scene"></div><div class="viz-result fax-caption" aria-live="polite" aria-atomic="true"></div>`;
    const q=s=>el.querySelector(s), scene=q('.fax-scene'), range=q('.fax-range'), back=q('[data-fax-back]'), next=q('[data-fax-next]');
    const opts=el.querySelectorAll('[data-fax-mode]');
    function render(resize=false) {
      const w=scene.clientWidth<470?354:620;
      if(resize&&width===w) return;
      width=w;
      const [body,h,heading,copy]=draw(mode,i,w);
      const alt=draw===benchmark?metrics[mode][3].map((v,j)=>`${mode===3?['Hugging Face','Megatron-LM','FlashAttention'][j]:['Standard attention','FlashAttention'][j]} ${v} ${metrics[mode][1]}`).join(', '):copy;
      scene.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${heading}. ${alt}"><g class="fax-enter">${body}</g></svg>`;
      q('.fax-caption').innerHTML=`<strong>${heading}.</strong> ${copy}`;
      opts.forEach((b,j)=>b.setAttribute('aria-pressed',String(j===mode)));
      if(steps) {
        back.disabled=i===0; next.disabled=i===steps-1; range.value=i+1;
        range.setAttribute('aria-valuetext',`Step ${i+1} of ${steps}: ${heading}`);
        q('.fax-progress').textContent=`Step ${i+1} of ${steps}`;
      }
    }
    opts.forEach((b,j)=>b.addEventListener('click',()=>{ if(mode!==j){mode=j; i=0; render();} }));
    if(steps) {
      const set=n=>{if(n>=0&&n<steps&&n!==i){i=n;render();}};
      back.addEventListener('click',()=>set(i-1)); next.addEventListener('click',()=>set(i+1));
      range.addEventListener('input',()=>set(Number(range.value)-1));
    }
    render(); if(typeof ResizeObserver!=='undefined') new ResizeObserver(()=>render(true)).observe(scene);
  }
  function init() {
    for(const [key,spec] of Object.entries(figures)) document.querySelectorAll(`.explainer[data-explainer="${key}"]`).forEach(el=>mount(el,spec));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
