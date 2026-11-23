/* Self-contained quantization illustrations. Load with <script type="module">. */
export const NF4 = Object.freeze([-1,-.6961928,-.52507305,-.39491749,-.28444138,-.18477343,-.09105004,0,.0795803,.1609302,.2461123,.33791524,.44070983,.562617,.72295684,1]);
export const UNIFORM = Object.freeze(Array.from({length:15},(_,i)=>(i-7)/7));
export function nearestIndex(value, levels=NF4) {
  return levels.reduce((best,v,i)=>Math.abs(value-v)<Math.abs(value-levels[best])?i:best,0);
}
export function quantize(weight, scale=1, mode='nf4') {
  if (!Number.isFinite(weight)||!Number.isFinite(scale)||scale<0) throw new RangeError('Expected a finite weight and a nonnegative scale');
  const normalized=scale===0?0:Math.max(-1,Math.min(1,weight/scale));
  const levels=mode==='uniform'?UNIFORM:NF4, index=nearestIndex(normalized,levels);
  const code=mode==='uniform'?index-7:index, representative=levels[index], reconstructed=representative*scale;
  return {normalized,index,code,bits:(code&15).toString(2).padStart(4,'0'),representative,reconstructed,error:reconstructed-weight};
}
export const SMALL_WEIGHTS=Object.freeze([.12,-.80,-.31,.49,-.14,.26,-.08,.17,.31,-.22,.06,-.11,.19,-.27,.15,4.17]);
export function blockQuantize(weights, blockSize) {
  if(!Number.isInteger(blockSize)||blockSize<1) throw new RangeError('Positive integer block size required');
  return weights.map((w,i)=>{const start=Math.floor(i/blockSize)*blockSize,scale=Math.max(...weights.slice(start,start+blockSize).map(Math.abs));return {...quantize(w,scale),scale};});
}
export function memoryBits(billions=7,blockSize=64) {
  const n=billions*1e9, codes=4, fp32=32/blockSize, double=8/blockSize+32/(blockSize*256);
  return {n,codes,fp32,double,baseGB:n*16/8/1e9,singleGB:n*(codes+fp32)/8/1e9,doubleGB:n*(codes+double)/8/1e9};
}
const f=(v,d=4)=>(Math.abs(v)<.5*10**-d?0:v).toFixed(d);
const sign=v=>(v>0?'+':'')+f(v);
const line=(x1,y1,x2,y2,cls='q-axis')=>`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const text=(x,y,t,anchor='start',cls='')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${t}</text>`;
const svg=(w,h,body,label)=>`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
let serial=0;
function setup(el,title,intro,controls) {
  const id=`quant-${++serial}`;el.classList.add('quantization');
  el.innerHTML=`<div class="q-heading"><span>Interactive explanation</span><h3>${title}</h3></div><p class="q-intro">${intro}</p><div class="q-controls">${controls(id)}</div><div class="q-body"></div><p class="q-summary" role="status" aria-live="polite" aria-atomic="true"></p>`;
  return s=>el.querySelector(s);
}
const range=(id,key,label,min,max,step,value)=>`<label for="${id}-${key}">${label}<output for="${id}-${key}" data-output="${key}"></output><input id="${id}-${key}" data-key="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
const select=(id,key,label,options)=>`<label for="${id}-${key}">${label}<select id="${id}-${key}" data-key="${key}">${options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label>`;
function bind(el,draw) {
  el.addEventListener('input',draw);draw();
  if(typeof ResizeObserver!=='undefined'){let previous=0;new ResizeObserver(entries=>{const w=Math.round(entries[0].contentRect.width);if(w!==previous){previous=w;draw();}}).observe(el);}
}
const width=el=>Math.max(260,Math.round(el.getBoundingClientRect().width||600));
const metric=(label,value,note='')=>`<div><dt>${label}</dt><dd>${value}</dd>${note?`<small>${note}</small>`:''}</div>`;
const legend=`<div class="q-legend"><span class="q-raw-key">○ Input</span><span class="q-code-key">◆ Reconstruction</span></div>`;
function numberLine(w,levels,raw,selected,{density=false}={}) {
  const x=v=>22+(v+1)/2*(w-44),y=70;
  let body='';
  if(density){let p=`M ${x(-1)} ${y}`;for(let i=0;i<=100;i++){const v=-1+i/50;p+=` L ${x(v)} ${y-48*Math.exp(-.5*(v/.34)**2)}`;}body+=`<path class="q-density" d="${p} L ${x(1)} ${y} Z"/>`;}
  body+=line(x(-1),y,x(1),y);
  levels.forEach((v,i)=>body+=line(x(v),y-7,x(v),y+7,i===selected?'q-selected-tick':'q-tick'));
  body+=line(x(raw),20,x(raw),y,'q-raw-line')+`<circle class="q-raw-dot" cx="${x(raw)}" cy="24" r="5"/>`;
  const sx=x(levels[selected]);body+=line(sx,y,sx,106,'q-code-line')+`<path class="q-code-dot" d="M ${sx} 96 l 5 5 -5 5 -5 -5 Z"/>`;
  [-1,-.5,0,.5,1].forEach(v=>body+=text(x(v),129,v===0?'0':String(v),'middle'));
  return svg(w,140,body,'Normalized number line from negative one to one. Open circle is the input; diamond is the chosen representative.');
}
function steps(el) {
  const q=setup(el,'Follow one weight into four bits','A fixed absolute scale c = 0.8 separates the scale from the code. Move the weight to see each arithmetic step.',id=>range(id,'weight','Original weight w',-.8,.8,.001,.12)+select(id,'mode','Codebook',[['uniform','Uniform signed: −7 to +7'],['nf4','NF4: 16 lookup entries']]));
  bind(el,()=>{const w=+q('[data-key="weight"]').value,mode=q('[data-key="mode"]').value,r=quantize(w,.8,mode);q('[data-output="weight"]').textContent=f(w,3);
    q('.q-body').innerHTML=`${legend}<div class="q-numberline">${numberLine(width(el),mode==='uniform'?UNIFORM:NF4,r.normalized,r.index)}</div><dl class="q-stages">${metric('01 · Normalize',f(r.normalized),'w ÷ 0.8')}${metric('02 · Choose code',`${r.code} <span class="q-bits">${r.bits}</span>`,mode==='uniform'?"Signed integer · 4-bit two’s complement":"Unsigned NF4 lookup index")}${metric('03 · Look up',f(r.representative,7),mode==='uniform'?'code ÷ 7':'NF4[index]')}${metric('04 · Reconstruct',f(r.reconstructed),'representative × 0.8')}</dl><p class="q-footnote">${mode==='uniform'?'This symmetric toy quantizer has 15 levels. Bit pattern 1000 (−8) is unused.':'All 16 bit patterns are used as indices, not signed numeric values.'} Nearest-neighbor ties choose the lower entry.</p>`;
    q('.q-summary').textContent=`Reconstruction error ŵ − w = ${sign(r.error)}. Absolute error: ${f(Math.abs(r.error))}. Four bits store a code, not the original real number.`;
  });
}
function nf4(el) {
  const q=setup(el,'Same range. Different places to spend the codes.','The axes are aligned. NF4 places more representatives near zero. The faint bell curve is only an illustrative density, not a measured weight distribution.',id=>range(id,'weight','Normalized weight',-1,1,.001,.15));
  bind(el,()=>{const w=+q('[data-key="weight"]').value,u=quantize(w,1,'uniform'),n=quantize(w);q('[data-output="weight"]').textContent=f(w,3);
    q('.q-body').innerHTML=legend+[ ['Uniform · 15 levels',UNIFORM,u],['NF4 · 16 levels',NF4,n] ].map(([name,levels,r])=>`<div class="q-compare-row"><div class="q-row-title"><strong>${name}</strong><span>Nearest ${f(r.representative)} · |error| ${f(Math.abs(r.error))}</span></div>${numberLine(width(el),levels,w,r.index,{density:true})}</div>`).join('');
    const eu=Math.abs(u.error),en=Math.abs(n.error);q('.q-summary').textContent=`At ${f(w,3)}, ${Math.abs(eu-en)<1e-9?'both have the same absolute error':en<eu?'NF4 is closer':'uniform is closer'}. Neither codebook wins at every weight. The benefit depends on the distribution after block normalization.`;
  });
}
function blocks(el) {
  const q=setup(el,'An outlier changes the scale, not just itself','Sixteen weights stay in their original order. The outlier is always weight 16; the tracked 0.12 is weight 1. Compare the other 15 weights using one global scale or local block scales.',id=>range(id,'outlier','Weight 16: positive outlier',.8,4.8,.01,4.17)+select(id,'block','Weights per local block',[[4,'4 weights'],[8,'8 weights'],[16,'16 weights (global)']]));
  bind(el,()=>{const outlier=+q('[data-key="outlier"]').value,b=+q('[data-key="block"]').value,weights=SMALL_WEIGHTS.map((v,i)=>i===15?outlier:v),global=blockQuantize(weights,16),local=blockQuantize(weights,b);q('[data-output="outlier"]').textContent=f(outlier,2);
    const W=width(el),L=38,R=10,H=188,T=25,B=37,errG=global.slice(0,15).map(r=>Math.abs(r.error)),errL=local.slice(0,15).map(r=>Math.abs(r.error)),max=Math.max(.025,...errG,...errL)*1.15,x=i=>L+(i+.5)*(W-L-R)/15,y=v=>H-B-v/max*(H-T-B),bw=Math.min(9,(W-L-R)/15*.32);
    let plot='';[0,.5,1].forEach(t=>{const v=t*max;plot+=line(L,y(v),W-R,y(v),'q-grid')+text(L-5,y(v)+4,f(v,2),'end');});
    errG.forEach((v,i)=>{plot+=`<rect class="q-global-fill" x="${x(i)-bw}" y="${y(v)}" width="${bw}" height="${H-B-y(v)}"/><rect class="q-local-fill" x="${x(i)}" y="${y(errL[i])}" width="${bw}" height="${H-B-y(errL[i])}"/>`;if(W>420||i%2===0)plot+=text(x(i),H-B+19,i+1,'middle');});plot+=text(L,14,'Absolute reconstruction error')+text((L+W-R)/2,H-2,'Weight index (outlier excluded)','middle');
    const mae=a=>a.reduce((s,v)=>s+v,0)/a.length;
    q('.q-body').innerHTML=`<div class="q-weight-strip">${weights.map((v,i)=>`<div class="${i===0?'q-tracked ':''}${i===15?'q-outlier':''}"><small>${i+1}</small><strong>${f(v,2)}</strong><span>block ${Math.floor(i/b)+1}</span></div>`).join('')}</div><p class="q-scales">Local scales: ${Array.from({length:16/b},(_,i)=>`<span>c${i+1} = ${f(local[i*b].scale,2)}</span>`).join(' · ')}<br>Global scale: ${f(outlier,2)}</p><div class="q-legend"><span class="q-global-key">▰ Global scale</span><span class="q-local-key">▰ Local scales</span></div>${svg(W,H,plot,'Paired bars of absolute reconstruction error for weights one through fifteen, with the same vertical axis.')}<dl class="q-metrics">${metric('Weight 1 · original','0.1200')}${metric('Global reconstruction',f(global[0].reconstructed))}${metric('Local reconstruction',f(local[0].reconstructed))}${metric('Mean absolute error',`${f(mae(errG))} → ${f(mae(errL))}`,'global → local, other 15 weights')}</dl>`;
    q('.q-summary').textContent=b===16?'With 16 weights in one block, local and global quantization are identical.':`Weight 1 uses local scale ${f(local[0].scale,2)} instead of ${f(outlier,2)}. Its absolute error changes from ${f(errG[0])} to ${f(errL[0])}. Only the last block shares the outlier’s scale; local scaling is not a guarantee of lower error for every individual weight.`;
  });
}
function memory(el) {
  const q=setup(el,'Four-bit weights still need scales','An idealized base-weight storage budget. Each first-level block has one scale. Double quantization stores those scales in 8 bits and shares one FP32 second-level scale across 256 first-level scales.',id=>select(id,'model','Model size',[[7,'7 billion weights'],[13,'13 billion weights'],[65,'65 billion weights'],[70,'70 billion weights']])+select(id,'block','Weights per first-level block',[[64,'64 weights'],[32,'32 weights'],[128,'128 weights']]));
  bind(el,()=>{const m=+q('[data-key="model"]').value,b=+q('[data-key="block"]').value,r=memoryBits(m,b);
    const bar=(label,parts,total,gb,max=16)=>`<div class="q-memory-row"><div class="q-row-title"><strong>${label}</strong><span>${f(total,3)} bits / weight${gb!==undefined?` · ${f(gb,2)} GB`:''}</span></div><div class="q-storage-track" aria-hidden="true">${parts.map(([v,cls])=>`<span class="${cls}" style="width:${100*v/max}%"></span>`).join('')}</div></div>`;
    q('.q-body').innerHTML=`<div class="q-memory-main">${bar('16-bit base',[[16,'q-base-fill']],16,r.baseGB)}${bar('4-bit + FP32 scales',[[4,'q-code-fill'],[r.fp32,'q-scale-fill']],4+r.fp32,r.singleGB)}${bar('4-bit + double quantization',[[4,'q-code-fill'],[8/b,'q-scale-fill'],[32/(b*256),'q-second-fill']],4+r.double,r.doubleGB)}</div><div class="q-legend"><span class="q-base-key">▰ 16-bit weights</span><span class="q-code-key">▰ 4-bit codes</span><span class="q-local-key">▰ First-level scales</span><span>▰ Second-level scales</span></div><div class="q-metadata"><div class="q-row-title"><strong>Scale metadata, magnified</strong><span>Separate axis: 0 to ${f(r.fp32,2)} bits / weight</span></div>${bar('FP32 scales',[[r.fp32,'q-scale-fill']],r.fp32,undefined,r.fp32)}${bar('Quantized scales + FP32 second-level',[[8/b,'q-scale-fill'],[32/(b*256),'q-second-fill']],r.double,undefined,r.fp32)}</div><div class="q-formula">Scale overhead = 8 / ${b} + 32 / (${b} × 256)<br><strong>= ${f(8/b,6)} + ${f(32/(b*256),6)} = ${f(r.double,6)} bits / weight</strong></div><p class="q-footnote">Decimal GB (10⁹ bytes). Idealized counts ignore partial blocks, alignment, codebooks, and the scale-mean offset. This is not total training or inference memory: adapters, gradients, optimizer state, activations, and temporary dequantization buffers are excluded. Four-bit storage does not imply four-bit arithmetic.</p>`;
    q('.q-summary').textContent=`For ${m} billion weights and block size ${b}, double quantization saves approximately ${f(r.singleGB-r.doubleGB,2)} GB versus FP32 scales. Total base-weight storage is ${f(r.doubleGB,2)} GB, compared with ${f(r.baseGB,2)} GB at 16 bits. The scale-mean overhead is excluded.`;
  });
}
export function mountQuantization(root=document) {
  const widgets={steps,nf4,blocks,memory};
  root.querySelectorAll('[data-quantization]').forEach(el=>{if(el.dataset.quantizationMounted||!widgets[el.dataset.quantization])return;el.dataset.quantizationMounted='true';widgets[el.dataset.quantization](el);});
}
if(typeof document!=='undefined') {
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mountQuantization(),{once:true});else mountQuantization();
}
