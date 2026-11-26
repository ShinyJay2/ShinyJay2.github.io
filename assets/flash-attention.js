import {demoScores, initialRow, normalize, outputRow, tileA, tileB} from './flash-attention-math.js';

// Diagrams share the page's theme. Coordinates are SVG user units; the compact
// layout changes the geometry, not just the scale, when the column narrows.
const txt = (x,y,s,cls='',anchor='middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${s}</text>`;
const box = (x,y,w,h,cls='fa-zone',rx=5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;
const line = (x1,y1,x2,y2,cls='fa-rule') => `<path d="M${x1} ${y1} L${x2} ${y2}" class="${cls}"/>`;
function arrow(x1,y1,x2,y2,cls='fa-arrow') {
  const a=Math.atan2(y2-y1,x2-x1), h=7, f=t=>`${x2-h*Math.cos(a+t)} ${y2-h*Math.sin(a+t)}`;
  return `<path d="M${x1} ${y1} L${x2} ${y2} M${f(-.48)} L${x2} ${y2} L${f(.48)}" class="${cls}"/>`;
}
const motion = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Render the destination copy travelling from its backing tile in HBM. The
// source tile stays in place. SVG animation uses user units even after resize.
function travel(from,to) {
  return from && motion() ? `<animateTransform attributeName="transform" type="translate" from="${from[0]-to[0]} ${from[1]-to[1]}" to="0 0" dur="0.54s" calcMode="spline" keyTimes="0;1" keySplines=".25 .7 .25 1"/>` : '';
}
function tile(x,y,label,tone='q',opt={}) {
  const cols=opt.cols||3, rows=opt.rows||2, cell=opt.cell||7, w=cols*cell, h=rows*cell;
  let cells='';
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
    cells+=`<rect x="${c*cell-w/2+.65}" y="${r*cell-h/2+.65}" width="${cell-1.3}" height="${cell-1.3}" opacity="${opt.highlight ? (r<2 && c<2 ? .95:.20) : .38+.14*((r+c)%4)}"/>`;
  }
  return `<g transform="translate(${x} ${y})" class="fa-tile fa-${tone}"><g>${travel(opt.from,[x,y])}${txt(0,-h/2-6,label,'fa-tile-label')}<g class="fa-cells">${cells}</g><path class="fa-brackets" d="M${-w/2+1} ${-h/2-2}h-4v${h+4}h4 M${w/2-1} ${-h/2-2}h4v${h+4}h-4"/></g></g>`;
}
const svg = (w,h,body,desc) => `<svg class="fa-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${desc}">${body}</svg>`;
const steps = `<div class="fa-steps"><button type="button" data-prev aria-label="Previous step">Back</button><label><span data-progress></span><input type="range" min="0" step="1" data-step aria-label="Diagram step"></label><button type="button" data-next aria-label="Next step">Next</button></div>`;
const options = (name,labels) => `<div class="fa-options" role="group" aria-label="${name}">${labels.map((s,i)=>`<button type="button" data-choice="${i}" aria-pressed="${i===0}">${s}</button>`).join('')}</div>`;
function widget(el,{title,lead,choices='',step=false,initialMode=0,playback=false,draw}) {
  if(el.dataset.mode!==undefined) choices='';
  el.classList.add('fa-widget');
  el.innerHTML=`<div class="viz-heading"><h3>${title}</h3></div><p>${lead}</p><div class="fa-tools">${choices}${step?steps:''}${playback?'<div class="fa-options" role="group" aria-label="Animation playback"><button type="button" data-play aria-pressed="false">Play</button><button type="button" data-restart>Restart</button></div>':''}</div><div class="fa-scene"></div><div class="viz-result fa-caption" aria-live="polite" aria-atomic="true"></div>`;
  const q=s=>el.querySelector(s), scene=q('.fa-scene'), caption=q('.fa-caption');
  let mode=Number(el.dataset.mode ?? initialMode),i=0,last,renderWidth,timer;
  function stopPlayback() {
    if(timer!==undefined) window.clearInterval(timer);
    timer=undefined;
    if(playback) { q('[data-play]').textContent='Play'; q('[data-play]').setAttribute('aria-pressed','false'); }
  }
  function update(action='init') {
    const w = scene.clientWidth < 470 ? 380 : 620;
    if(action==='resize' && w===renderWidth) return;
    renderWidth=w;
    const result=draw({mode,i,w,last:action==='step'?last:null});
    if(step) {
      const range=q('[data-step]'); range.max=result.count-1; range.value=i;
      range.setAttribute('aria-valuetext',`${i+1} of ${result.count}: ${result.heading}`);
      q('[data-progress]').textContent=`Step ${i+1} of ${result.count}`;
      q('[data-prev]').disabled=i===0; q('[data-next]').disabled=i===result.count-1;
      if(i===result.count-1) stopPlayback();
    }
    el.querySelectorAll('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.choice===mode)));
    scene.innerHTML=result.image; caption.innerHTML=`<strong>${result.heading}.</strong> ${result.copy}`;
    last={mode,i};
  }
  function setStep(value) { if(value===i)return; i=value; update('step'); }
  el.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{if(+b.dataset.choice===mode)return;stopPlayback();mode=+b.dataset.choice;i=0;update('mode')}));
  if(step) {
    q('[data-prev]').addEventListener('click',()=>{stopPlayback();setStep(i-1)});q('[data-next]').addEventListener('click',()=>{stopPlayback();setStep(i+1)});
    q('[data-step]').addEventListener('input',e=>{stopPlayback();setStep(+e.target.value)});
  }
  if(playback && step) {
    q('[data-restart]').addEventListener('click',()=>{stopPlayback();i=0;update('restart')});
    q('[data-play]').addEventListener('click',()=>{
      if(timer!==undefined) {stopPlayback();return;}
      if(i===Number(q('[data-step]').max)) {i=0;update('restart');}
      q('[data-play]').textContent='Pause';
      q('[data-play]').setAttribute('aria-pressed','true');
      timer=window.setInterval(()=>{
        if(!el.isConnected) {stopPlayback();return;}
        setStep(i+1);
      },2600);
    });
  }
  update(); if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>update('resize')).observe(scene);
}

function memory(el) {
  const captions=[
    ['HBM holds the full tensors','HBM is the large DRAM store beside the GPU processor die. It holds full tensors. It plays the backing-store role in the analogy, but is not the host CPU’s RAM.'],
    ['Shared memory stages a tile','Threads explicitly load and reuse tiles here. Unlike an automatic CPU cache, shared memory is managed by the kernel. SRAM describes the storage technology, not the cache role.'],
    ['Registers hold live operands','Registers hold live operands and accumulators for each thread. The arithmetic units do the calculation; shared memory and registers only store its data.']
  ];
  widget(el,{title:'Where does a tile live?',lead:'Select a store to follow one tile from the full tensor to the arithmetic units.',choices:options('Memory location',['HBM','Shared memory','Registers']),draw:({mode,w})=>{
    const sm=w*.57, rx=w*.71, rw=w-rx-9, mid=sm/2+4, hcx=rx+rw/2;
    const active=n=>mode===n?'fa-active':'fa-zone';
    const body=box(7,13,sm,210)+txt(18,34,'GPU processor die','fa-small','start')+box(18,46,sm-22,165,'fa-inset')+txt(28,66,'One SM','fa-heading','start')+
      box(29,79,sm-44,44,active(1))+txt(mid,105,'Shared memory','fa-heading')+
      arrow(mid,125,mid,140)+box(29,143,sm-44,25,active(2))+txt(mid,161,'Registers','fa-label')+
      arrow(mid,170,mid,182)+txt(mid,199,'Arithmetic units','fa-label')+
      box(rx,46,rw,121,active(0))+txt(hcx,68,'HBM','fa-heading')+tile(hcx,114,'Q','q',{cols:5,rows:3,cell:6,highlight:true})+txt(hcx,151,'DRAM stack','fa-small')+
      arrow(rx-3,100,sm+9,100)+txt((rx+sm+7)/2,90,'read','fa-small');
    return {image:svg(w,232,body,`Memory layout, ${['HBM','shared memory','registers'][mode]} selected. HBM is outside the GPU processor die; each SM contains shared memory, registers and arithmetic units.`),heading:captions[mode][0],copy:captions[mode][1]};
  }});
}

const format = x => x===-Infinity?'−∞':String(+x.toFixed(4));
const indexed=['₁','₂'];
function tiling(el) {
  const captions=[
    ['Begin with the backing arrays','Brackets enclose matrix tiles. The numeric strip tracks one query row with scalar V; each other query row has its own summary.'],
    ['Copy Q₁ once','Hold the query tile on chip. Give each query row its own maximum m, denominator ℓ and weighted-value numerator u. Initially m = −∞, ℓ = 0 and u = 0.'],
    ['Bring in K₁ and V₁','The tiles on the left are copies. The originals remain in HBM, and Q₁ stays in the local working set.'],
    ['Compute the first score tile','The SM’s arithmetic units multiply Q₁ by K₁ᵀ and scale by 1/√d. Only scores for this pair of tiles are needed.'],
    ['Consume S₁₁, then release it','Update each query row using the matching V₁ values. For the tracked row the state is now (ln 2, 1.5, 25). No score tile is written to HBM.'],
    ['Reuse the same local slots','Load K₂ and V₂ in place of K₁ and V₁. Q₁ and all its running row states stay on chip.'],
    ['Compute the next score tile','Q₁ with K₂ makes S₁₂ in the freed scratch space. For the tracked row its scores are ln 4 and ln 8.'],
    ['Rescale, accumulate and release','For this row, the maximum rises from ln 2 to ln 8. Multiply the old ℓ and u by 1/4 before adding tile 2. Release S₁₂; keep the combined state.'],
    ['Write the output tile','Divide u by ℓ for each query row and write O₁ to HBM. The tracked output is 61.25/1.875 ≈ 32.6667. Training can also save one log-sum-exp per row for backward.']
  ];
  widget(el,{title:'Follow a query tile across HBM and the SM',lead:'Hold Q locally; stream K/V through the same working space.',step:true,draw:({i,w,last})=>{
    const left=7, lw=w*.51, right=w*.64, rw=w-right-7, hx=right+rw*.28, hx2=right+rw*.73;
    const qx=left+lw*.19,kx=left+lw*.5,vx=left+lw*.81, mid=left+lw*.5, cross=(left+lw+right)/2;
    const j=i>=5?1:0, sub=indexed[j], score=i===3||i===6, copy=i===1||i===2||i===5, write=i===8;
    const move=last && last.i<i, rx=j?hx2:hx;
    let body=box(left,10,lw,222)+box(right,10,rw,222,'fa-inset')+
      txt(left+10,32,'SM working set','fa-heading','start')+txt(left+10,51,'SRAM / registers','fa-small','start')+
      txt(right+10,32,'HBM','fa-heading','start')+txt(right+10,51,'backing tiles','fa-small','start')+
      line(left+9,109,left+lw-9,109)+txt(left+lw-9,129,'Score scratch','fa-small','end')+
      line(left+9,179,left+lw-9,179)+txt(left+10,198,'Persistent row state','fa-small','start')+
      txt(mid,219,i===0?'not initialized':'m, ℓ, u per query row','fa-label');
    body+=tile(hx,89,'Q₁','q');
    for(let t=0;t<2;t++) {const x=t?hx2:hx;body+=tile(x,133,'K'+indexed[t],'k')+tile(x,176,'V'+indexed[t],'v');}
    if(copy||write) body+=arrow(write?left+lw+2:right-2,write?208:94,write?right-2:left+lw+2,write?208:94)+txt(cross,write?197:83,write?'write':'read','fa-small');
    const slots=[[qx,'Q'],[kx,'K'],[vx,'V']];
    slots.forEach(([x,name],n)=>{if(i<(n?2:1))body+=box(x-14,80,28,16,'fa-empty',1)+txt(x,73,name,'fa-ghost');});
    if(i>=1) body+=tile(qx,89,'Q₁','q',{from:move&&i===1?[hx,89]:null});
    if(i>=2) body+=tile(kx,89,'K'+sub,'k',{from:move&&copy?[rx,133]:null})+tile(vx,89,'V'+sub,'v',{from:move&&copy?[rx,176]:null});
    if(score) {
      // The two operands converge on the same short-lived score tile.
      body+=arrow(qx,100,mid-18,151)+arrow(kx,100,mid+7,136)+tile(mid,159,'S₁'+sub,'s',{cols:2,rows:2,cell:7});
    } else if(i===4||i===7) {
      body+=txt(mid,156,'released','fa-ghost')+arrow(mid,162,mid,178);
    } else body+=txt(mid,158,'empty','fa-ghost');
    if(write)body+=tile(hx2,216,'O₁','v',{from:move?[mid,217]:null});
    const state=i>=7?tileB.row:i>=4?tileA.row:initialRow(1);
    const values=i===0?'no state yet':`m = ${i>=7?'ln 8':i>=4?'ln 2':'−∞'}     ℓ = ${format(state.l)}     u = ${format(state.u[0])}`;
    body+=txt(left+4,255,'One row of Q₁','fa-small','start')+txt(w<400?left+4:w-11,w<400?278:255,values,'fa-number',w<400?'start':'end');
    return {count:captions.length,image:svg(w,w<400?292:267,body,`Step ${i+1}. ${captions[i][0]}. One row of Q₁: ${values}.`),heading:captions[i][0],copy:captions[i][1]};
  }});
}

const raw=demoScores.map(Math.exp), shifted=raw.map(x=>x/8), probabilities=normalize(shifted);
const normalizeFrames=[
  {heading:'Exponentiate the scores',copy:'The scores are 0, ln 2, ln 4 and ln 8. Their exponentials are weights 1, 2, 4 and 8. The weights sum to 15, so they are not probabilities yet.',bars:raw,note:'Sum of weights = 15'},
  {heading:'Rescale every weight by 1/8',copy:'Subtracting ln 8 from every score divides every exponential by 8. Their ratio stays 1:2:4:8. The sum is now 1.875, not 1: rescaling is not sum-normalization.',bars:shifted,note:'Sum of weights = 1.875'},
  {heading:'Divide by the sum',copy:'Divide the rescaled weights by 1.875 to get 1/15, 2/15, 4/15 and 8/15. Dividing the original weights by 15 gives exactly the same probabilities.',bars:probabilities,labels:['1/15','2/15','4/15','8/15'],note:'Sum of probabilities = 1'}
];
const oldWeights=tileA.weights.map(x=>x*tileB.alpha);
const onlineFrames=[
  {heading:'Process tile A',copy:'A gives weights [0.5, 1]. Sum them for ℓ = 1.5; multiply by V = [10, 20] for u = 25.',bars:[...tileA.weights,0,0],note:'m = ln 2     ℓ = 1.5     u = 25'},
  {heading:'Find the new maximum',copy:'Tile B arrives with scores [ln 4, ln 8] and values [30, 40]. The new maximum is ln 8. The two old bars are still in units set by ln 2; do not add the new tile yet.',bars:[...tileA.weights,0,0],note:'Old m = ln 2     New m = ln 8'},
  {heading:'Put the old state on the new scale',copy:'Multiply the old totals by 1/4: ℓ = 0.375, u = 6.25. The bars explain the rescaling; the kernel updates the totals, not a stored array of old weights.',bars:[...oldWeights,0,0],note:'m = ln 8     old ℓ = 0.375     old u = 6.25'},
  {heading:'Add tile B on the same scale',copy:'B contributes weights 0.5 and 1: ℓ increases by 1.5 and u by 0.5 × 30 + 1 × 40 = 55. The combined state is ℓ = 1.875 and u = 61.25.',bars:[...oldWeights,...tileB.weights],note:'m = ln 8     ℓ = 1.875     u = 61.25'},
  {heading:'Divide once for the output',copy:'For this query row, O = u/ℓ = 61.25/1.875 ≈ 32.6667. The normalized bars give the same result if each is multiplied by its value and the four products are summed.',bars:probabilities,labels:['1/15','2/15','4/15','8/15'],note:`O = u/ℓ ≈ ${format(outputRow(tileB.row)[0])}`}
];
const averageFrames=[
  {heading:'Give the second value three times the weight',copy:'With weights [1, 3] and values [10, 20], the weighted sum is 1 × 10 + 3 × 20 = 70. Its scale still depends on the sum of weights.',bars:[1,3],note:'Numerator = 70     Denominator = 4'},
  {heading:'Turn the sum into an average',copy:'Divide by the total weight, 4: 70/4 = 17.5. Equivalently, apply the normalized weights to the original values: 0.25 × 10 + 0.75 × 20 = 17.5.',bars:normalize([1,3]),note:'Output = 70/4 = 17.5'}
];
function softmax(el) {
  widget(el,{title:el.dataset.mode==='1'?'Keep the summary, rescale the past':'Rescaling is not normalization',lead:el.dataset.mode==='1'?'Follow two tiles. The old bars shrink together; their summaries change by the same factor.':'Start with weights, change their scale, then divide by their sum. The axis stays fixed.',choices:options('Weight experiment',['Normalize','Online tiles','Weighted average']),step:true,draw:({mode,i,w,last})=>{
    const frames=[normalizeFrames,onlineFrames,averageFrames][mode], f=frames[i], prev=last&&last.mode===mode?frames[last.i].bars:null;
    const x=w<400?79:106, right=w-77, span=right-x, max=[8,1,3][mode], n=f.bars.length;
    const names=mode===0?['0','ln 2','ln 4','ln 8']:mode===1?['A: 10','A: 20','B: 30','B: 40']:['10','20'];
    const measure=(mode===0&&i===2)||(mode===1&&i===4)||(mode===2&&i===1)?'Probability':'Weight';
    let body=txt(8,24,['Score','Tile: value','Value'][mode],'fa-small','start')+txt(x,24,measure+' (fixed axis)','fa-small','start');
    const bottom=40+n*32;
    for(let t=0;t<=2;t++) {
      const pos=x+span*t/2; body+=line(pos,36,pos,bottom-2,'fa-grid')+txt(pos,bottom+14,format(max*t/2),'fa-small');
    }
    f.bars.forEach((v,j)=>{
      const y=48+j*32, width=span*v/max, from=prev?span*prev[j]/max:width, tone=mode===1&&j>=2?'v':'q', absent=mode===1&&j>=2&&i<3;
      const anim=from!==width&&motion()?`<animate attributeName="width" from="${from}" to="${width}" dur="0.48s"/>`:'';
      body+=txt(8,y+8,names[j],'fa-label','start')+`<rect x="${x}" y="${y-5}" width="${width}" height="15" rx="2" class="fa-bar fa-${tone}">${anim}</rect>`+txt(w-8,y+8,absent?'pending':f.labels?.[j]??format(v),absent?'fa-small':'fa-number','end');
    });
    body+=line(7,bottom+28,w-7,bottom+28)+txt(w/2,bottom+53,f.note,'fa-number');
    return {count:frames.length,image:svg(w,bottom+68,body,`${f.heading}. ${f.note}.`),heading:f.heading,copy:f.copy};
  }});
}

function recompute(el) {
  // Compute with exact log values, never the rounded display labels. These
  // statistics describe ALL four keys, even though this tile has only two.
  const q=1, keys=[0,Math.log(2)], d=1, m=Math.log(8);
  const fullWeights=[1,2,4,8], l=fullWeights.reduce((sum,x)=>sum+x/8,0);
  const scores=keys.map(k=>q*k/Math.sqrt(d));
  const weights=scores.map(s=>Math.exp(s-m));
  const p=weights.map(x=>x/l), g=15, contributions=p.map(x=>x*g);
  const numericP='['+p.map(format).join(', ')+']';
  const numericGradient='['+contributions.map(format).join(', ')+']';
  const standard=[
    ['Read the saved P tile','This standard implementation saved the full N × N P matrix in HBM during forward. Read its first two entries for this example row: 1/15 and 2/15. The full saved matrix stays in HBM.'],
    ['Use the tile for V gradients','For this one query row, take an illustrative scalar upstream output gradient g = 15. Multiply each probability by 15: the contributions to the first two V gradients are 1 and 2. This is only one part of backward, not the full Q/K/V gradient calculation.'],
    ['Release only the local tile','The local P tile can now be reused as scratch space. Keep the gradient contributions [1, 2]. The full saved P matrix remains in HBM; releasing a local copy does not remove it.']
  ];
  const flash=[
    ['Load Q/K and the saved row statistics','Load Q = 1 and the first two keys [0, ln 2], with d = 1. Saved m = ln 8 and ℓ = 1.875 summarize the full row, whose original exponential weights were [1, 2, 4, 8]. No full P matrix is saved in HBM.'],
    ['Recompute two scores','Multiply 1 by each key and divide by √1: the scores are [0, ln 2]. Only these two entries are recomputed. Calculations use exact logarithms; decimal labels marked ≈ are rounded.'],
    ['Recover two stable weights','Use the saved full-row maximum ln 8, not the maximum of this tile. Exponentiating 0 − ln 8 gives 1/8 = 0.125; exponentiating ln 2 − ln 8 gives 2/8 = 0.25.'],
    ['Recover the same two probabilities','Divide both weights by the saved FULL-row denominator 1.875, not their tile sum 0.375. This gives [1/15, 2/15], exactly the two entries the standard implementation reads. This partial tile is not expected to sum to 1.'],
    ['Use the recomputed tile immediately','With the same illustrative scalar upstream output gradient g = 15, the contributions to the first two V gradients are [1, 2]. These are contributions from one query row only; other rows and Q/K gradients are not shown.'],
    ['Discard P; retain the gradient result','Release the local probability tile after use. Keep its V-gradient contributions [1, 2] for accumulation. No full P matrix was written to or read from HBM; another tile can reuse this scratch space.']
  ];
  widget(el,{title:'Standard Attention vs. FlashAttention: Backward',lead:'Compare two implementations, not FlashAttention settings. Step through one row’s first two entries. Decimal labels marked ≈ are rounded; calculations use exact logarithms.',choices:options('Backward implementation',['Standard Attention','FlashAttention']),initialMode:1,step:true,playback:true,draw:({mode,i,w,last})=>{
    const isFlash=mode===1, frames=isFlash?flash:standard, f=frames[i];
    const used=i>=(isFlash?4:1), discarded=i===(isFlash?5:2);
    const cx=w/2, x=10, bw=w-20;
    const workY=158, workH=264, resultY=458;
    let body=box(x,10,bw,112,'fa-inset')+
      txt(x+12,32,isFlash?'HBM: no full P saved':'HBM: full N × N P saved','fa-heading','start');
    if(isFlash) {
      body+=txt(cx,55,'Q = 1; K tile = [0, ln 2]; d = 1','fa-number')+
        txt(cx,77,'Saved m = ln 8 ≈ '+format(m)+'; ℓ = '+format(l),'fa-number')+
        txt(cx,99,'Full-row weights: [1, 2, 4, 8]','fa-small')+
        txt(cx,114,'ℓ = 0.125 + 0.25 + 0.5 + 1 = 1.875','fa-small');
    } else {
      body+=txt(cx,57,'Example row: [1/15, 2/15, 4/15, 8/15]','fa-number')+
        txt(cx,81,'Read only the first two entries','fa-label')+
        txt(cx,104,'Full saved P remains here at every step','fa-small');
    }
    body+=arrow(cx,125,cx,workY-5)+txt(cx+12,144,isFlash?'Q/K + row stats':'read P tile','fa-small','start');
    const flashLines=[
      ['Q = 1; K = [0, ln 2]', 'ln 2 ≈ '+format(keys[1])+'; d = 1', 'Recover only entries 1 and 2'],
      ['1 × 0 / √1 = 0', '1 × ln 2 / √1 = ln 2 ≈ '+format(scores[1]), 'Score tile: [0, ln 2]'],
      ['exp(0 − ln 8) = 1/8 = '+format(weights[0]), 'exp(ln 2 − ln 8) = 2/8 = '+format(weights[1]), 'Stable weights: [0.125, 0.25]'],
      ['0.125 / 1.875 = 1/15 ≈ '+format(p[0]), '0.25 / 1.875 = 2/15 ≈ '+format(p[1]), 'P tile ≈ '+numericP],
      ['g = 15 (upstream output gradient)', '15 × (1/15) = 1; 15 × (2/15) = 2', 'V-gradient contributions = '+numericGradient],
      ['P tile discarded', 'Scratch space is ready for the next tile', 'No full P in HBM']
    ];
    const standardLines=[
      ['Local P tile = [1/15, 2/15]', 'P tile ≈ '+numericP, 'Copied from the saved full P'],
      ['g = 15 (upstream output gradient)', '15 × (1/15) = 1; 15 × (2/15) = 2', 'V-gradient contributions = '+numericGradient],
      ['Local P tile released', 'Scratch space is ready for the next tile', 'Full saved P still remains in HBM']
    ];
    const labels=isFlash?['Loaded operands','Score tile','Stable-weight tile','Recomputed P tile','Use P for gradients','Local scratch: empty']:['Read P tile','Use P for gradients','Local scratch: empty'];
    // Keep the backing store and calculation frame still. Only numeric
    // operands/results travel, so motion explains which data is reused.
    const animate=last && last.mode===mode && last.i!==i && motion();
    const row=(isFlash?flashLines:standardLines)[i];
    const operandY=workY+64, tileY=workY+207;
    const positions=[cx-83,cx+83];
    const operandSets=isFlash?[
      ['Q = 1','K = [0, ln 2]'],
      ['Q = 1','K = [0, ln 2]'],
      ['[0, ln 2]','m = ln 8'],
      ['[0.125, 0.25]','ℓ = 1.875'],
      ['[1/15, 2/15]','g = 15']
    ]:[['1/15','2/15'],['[1/15, 2/15]','g = 15']];
    let working=box(x,workY,bw,workH,discarded?'fa-empty':'fa-active')+
      txt(x+12,workY+26,'On chip: '+labels[i],'fa-heading','start');
    if(!discarded) {
      operandSets[i].forEach((value,j)=>{
        const ox=positions[j];
        // Q/K originate in HBM. Later left operands are the previous
        // local result; the right m/denominator is saved row metadata.
        const sourceY=isFlash?(i<=1?55:j===1&&i<=3?77:tileY):i===0?57:tileY;
        working+='<g transform="translate('+ox+' '+operandY+')"><g>'+
          travel(animate && !(j===1 && used)?[cx,sourceY]:null,[ox,operandY])+
          box(-77,-18,154,30,'fa-inset')+txt(0,2,value,'fa-number')+'</g></g>'+
          arrow(ox,operandY+16,ox,workY+94);
      });
      working+=txt(cx,workY+120,row[0],'fa-number')+
        txt(cx,workY+151,row[1],'fa-number')+
        arrow(cx,workY+162,cx,tileY-22)+box(x+12,tileY-18,bw-24,36,'fa-inset');
      working+='<g transform="translate('+cx+' '+tileY+')"><g>'+
        travel(animate?[cx,workY+151]:null,[cx,tileY])+
        txt(0,4,row[2],'fa-number')+'</g></g>';
    } else {
      // The old P tile visibly shrinks and disappears, while the gradient
      // result below remains. Reduced motion renders only the final state.
      if(animate) working+='<g transform="translate('+cx+' '+operandY+')"><g opacity="0">'+
        '<animate attributeName="opacity" from="1" to="0" dur="0.65s" fill="freeze"/>'+
        '<animateTransform attributeName="transform" type="scale" from="1" to="0.05" dur="0.65s" fill="freeze"/>'+
        box(-110,-20,220,36,'fa-active')+txt(0,3,'P = [1/15, 2/15]','fa-number')+'</g></g>';
      working+=txt(cx,workY+120,row[0],'fa-heading')+
        txt(cx,workY+153,row[1],'fa-small')+txt(cx,workY+190,row[2],'fa-small');
    }
    working+=txt(cx,workY+247,'One query row: two of four keys','fa-small');
    body+=working+arrow(cx,workY+workH+4,cx,resultY-5)+
      box(x,resultY,bw,78,used?'fa-active':'fa-zone')+
      txt(cx,resultY+25,used?'Retained V-gradient contributions':'V-gradient contributions pending','fa-heading');
    body+='<g transform="translate('+cx+' '+(resultY+51)+')"><g>'+
      travel(animate&&used&&!discarded?[cx,tileY]:null,[cx,resultY+51])+
      txt(0,0,used?numericGradient+': from this query row only':'Not the full backward calculation','fa-number')+'</g></g>'+
      txt(cx,559,isFlash?'Recompute → use → discard; never save full P':'Read → use → release local copy; full P stays','fa-small');
    return {count:frames.length,image:svg(w,574,body,f[0]+'. '+f[1]),heading:f[0],copy:f[1]};
  }});
}

const mount={'fa-memory':memory,'fa-tiling':tiling,'fa-softmax':softmax,'fa-recompute':recompute};
for(const el of document.querySelectorAll('.explainer[data-explainer^="fa-"]')) mount[el.dataset.explainer]?.(el);
