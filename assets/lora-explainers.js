// Interactive LoRA widgets. Values are fixed illustrative numbers, not a trained adapter.
const D=5, RMAX=8;
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const r1=rng(7),B=[...Array(D)].map(()=>[...Array(RMAX)].map(()=>+(r1()*0.8-0.4).toFixed(2)));
const r2=rng(11),A=[...Array(RMAX)].map(()=>[...Array(D)].map(()=>+(r2()*0.8-0.4).toFixed(2)));
const fmt=(x,d=2)=>(Math.abs(x)<5e-9?0:x).toFixed(d);
export function product(r,equal){const b=equal?B.map(row=>row.map(()=>Math.sqrt(0.1))):B,a=equal?A.map(row=>row.map(()=>Math.sqrt(0.1))):A;
 const P=[...Array(D)].map((_,i)=>[...Array(D)].map((_,j)=>{let s=0;for(let k=0;k<r;k++)s+=b[i][k]*a[k][j];return s}));return {b,a,P};}
export function rms(M){let s=0,n=0;for(const row of M)for(const v of row){s+=v*v;n++}return Math.sqrt(s/n)}
const tbl=(M,rows,cols,cls)=>`<table><tbody>${[...Array(rows)].map((_,i)=>`<tr>${[...Array(cols)].map((_,j)=>`<td class="${cls(i,j)}">${fmt(M[i][j])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const sg=x=>(x>=0?'+':'\u2212')+Math.abs(x).toFixed(2);
const mx=(M,rows,cols,color,name,cls)=>`<div class="mx"><div class="mx-body" style="grid-template-columns:repeat(${cols},auto);color:${color}">${[...Array(rows)].map((_,i)=>[...Array(cols)].map((_,j)=>`<span class="${cls(i,j)}">${sg(M[i][j])}</span>`).join('')).join('')}</div><div class="mx-name" style="color:${color}">${name}</div></div>`;
function sumWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>One entry of BA is a sum of r products</h3></div><p>Choose a rank and a cell of \u0394W = BA. The highlighted row of B and column of A are multiplied pairwise; the number of pairs equals r.</p>
 <div class="viz-controls"><label>Rank r <output></output><input type="range" min="1" max="${RMAX}" value="2" data-r aria-label="Rank r"></label><label>Row i <output></output><input type="range" min="1" max="${D}" value="1" data-i aria-label="Row i"></label><label>Column j <output></output><input type="range" min="1" max="${D}" value="1" data-j aria-label="Column j"></label></div>
 <div class="mx-row" aria-live="polite"></div><div class="lora-terms"></div>`;
 const q=s=>el.querySelector(s);
 const draw=()=>{const r=+q('[data-r]').value,i=+q('[data-i]').value-1,j=+q('[data-j]').value-1;
  el.querySelectorAll('.viz-controls output').forEach((o,n)=>o.textContent=[r,i+1,j+1][n]);
  const {P}=product(r,false);
  q('.mx-row').innerHTML=mx(B,D,r,'var(--m-orange)','B',(a)=>a===i?'on':'dim')+'<span class="mx-op">\u00b7</span>'+mx(A,r,D,'var(--viz-secondary)','A',(a,c)=>c===j?'on':'dim')+'<span class="mx-op">=</span>'+mx(P,D,D,'var(--m-green)','BA',(a,c)=>a===i&&c===j?'out':'dim');
  const terms=[...Array(r)].map((_,k)=>`<span class="t"><span class="b">(${sg(B[i][k])})</span>(<span class="a">${sg(A[k][j])}</span>)</span>`).join(' + ');
  q('.lora-terms').innerHTML=`<span class="s">(BA)<sub>${i+1}${j+1}</sub></span> = ${terms} = <span class="s">${sg(P[i][j]).replace(/(\.\d\d)$/,m=>m)}${''}</span> &nbsp;(${fmt(P[i][j],4)})<br><span style="color:#8d8d8d">${r} ${r===1?'term':'terms'}. The shape of BA stays ${D} \u00d7 ${D} for every r.</span>`;};
 el.querySelectorAll('input').forEach(x=>x.addEventListener('input',draw));draw();
}
function scaleWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>What happens to the size of the update as r grows</h3></div><p>The plot shows the root-mean-square entry of the update for r = 1 to ${RMAX}. In the equal-terms case every product is 0.1. In the mixed-sign case the entries of B and A are fixed illustrative values between \u22120.4 and 0.4.</p>
 <div class="viz-controls"><label>Entries<select data-mode aria-label="Entries"><option value="eq">Every product equals 0.1</option><option value="mix">Mixed signs (fixed values)</option></select></label><label>Rank r <output></output><input type="range" min="1" max="${RMAX}" value="2" data-r aria-label="Rank r"></label><label>\u03b1 <output></output><input type="range" min="1" max="32" value="16" data-a aria-label="alpha"></label></div>
 <div class="viz-plot"></div><div class="viz-legend"><span><i class="secondary"></i>Unscaled BA</span><span><i class="primary"></i>(\u03b1 / r) BA</span></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s);
 const draw=()=>{const eq=q('[data-mode]').value==='eq',r=+q('[data-r]').value,al=+q('[data-a]').value;
  el.querySelectorAll('.viz-controls output').forEach((o,n)=>o.textContent=[r,al][n]);
  const raw=[],sc=[];for(let k=1;k<=RMAX;k++){const m=rms(product(k,eq).P);raw.push(m);sc.push(m*al/k)}
  const W=440,H=250,L=48,R=16,T=16,Bt=36,ymax=Math.max(...raw,...sc)*1.1,x=k=>L+(k-1)*(W-L-R)/(RMAX-1),y=v=>H-Bt-v/ymax*(H-T-Bt);
  const path=a=>a.map((v,n)=>`${n?'L':'M'}${x(n+1).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const ticks=[0,.25,.5,.75,1].map(f=>f*ymax);
  q('.viz-plot').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="RMS entry of the update against rank">${ticks.map(t=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L-6}" y="${y(t)+4}" text-anchor="end">${t.toFixed(2)}</text>`).join('')}<line class="axis" x1="${L}" x2="${W-R}" y1="${H-Bt}" y2="${H-Bt}"/>${[...Array(RMAX)].map((_,n)=>`<text x="${x(n+1)}" y="${H-Bt+16}" text-anchor="middle">${n+1}</text>`).join('')}<text x="${(L+W-R)/2}" y="${H-3}" text-anchor="middle">rank r</text><path class="secondary" d="${path(raw)}"/><path class="primary" d="${path(sc)}"/><circle class="secondary-dot" cx="${x(r)}" cy="${y(raw[r-1])}" r="5"/><circle class="primary-dot" cx="${x(r)}" cy="${y(sc[r-1])}" r="5"/></svg>`;
  q('.viz-result').innerHTML=`r = ${r}, \u03b1 = ${al}, scaling factor \u03b1 / r = ${fmt(al/r,3)}<br>RMS entry of BA: ${fmt(raw[r-1],4)}. After scaling: ${fmt(sc[r-1],4)}.<br>${eq?'Every entry of BA equals 0.1 \u00d7 r, so dividing by r returns 0.1 and the scaled update stays at 0.1 \u00d7 \u03b1 for every rank.':'With mixed signs, terms partly cancel. The unscaled size no longer grows in proportion to r, so dividing by r does not hold the scaled size exactly constant.'}`;};
 el.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',draw));draw();
}
const widgets={'lora-sum':sumWidget,'lora-scale':scaleWidget};
document.querySelectorAll('.explainer[data-explainer]').forEach(el=>widgets[el.dataset.explainer]?.(el));
