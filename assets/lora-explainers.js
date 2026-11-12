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
  q('.lora-terms').innerHTML=`<span class="s">(BA)<sub>${i+1}${j+1}</sub></span> = ${terms} = <span class="s">${sg(P[i][j]).replace(/(\.\d\d)$/,m=>m)}${''}</span> &nbsp;(${fmt(P[i][j],4)})<br><span style="color:var(--muted)">${r} ${r===1?'term':'terms'}. The shape of BA stays ${D} \u00d7 ${D} for every r.</span>`;};
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


// Block diagram: y = W0 x + B A x (or full fine-tuning y = W0 x + dW x)
function diagramWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>Full fine-tuning versus LoRA</h3></div><p>A toy layer with a 6 \u00d7 6 weight matrix. Each circle is one number. The snowflake marks a frozen matrix; the flame marks a trainable one. Switch the method and change the rank to see which numbers are trained.</p>
 <div class="viz-controls"><label>Method<select data-m aria-label="Method"><option value="lora">LoRA</option><option value="full">Full fine-tuning</option></select></label><label>Rank r <output></output><input type="range" min="1" max="4" value="2" data-r aria-label="Rank r"></label></div>
 <div class="viz-plot lora-diagram"></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s),D=6,c=22,pad=4;
 const block=(x,y,cols,rows,col)=>{let g=`<rect x="${x}" y="${y}" width="${cols*c+pad*2}" height="${rows*c+pad*2}" fill="${col}" fill-opacity=".72" stroke="var(--text)" stroke-width="2"/>`;for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)g+=`<circle cx="${x+pad+c*j+c/2}" cy="${y+pad+c*i+c/2}" r="${c*0.32}" fill="none" stroke="#fff" stroke-width="1.8"/>`;return g;};
 const label=(x,y,t,col,size=26)=>`<text x="${x}" y="${y}" text-anchor="middle" style="fill:${col};font-family:KaTeX_Math,serif;font-style:italic;font-weight:700;font-size:${size}px">${t}</text>`;
 const icon=(x,y,kind)=>kind==='ice'?`<g transform="translate(${x},${y})" stroke="#58c4dd" stroke-width="2.4" stroke-linecap="round">${[0,60,120].map(a=>`<g transform="rotate(${a})"><line x1="0" y1="-13" x2="0" y2="13"/><line x1="0" y1="-8" x2="-4" y2="-12"/><line x1="0" y1="-8" x2="4" y2="-12"/><line x1="0" y1="8" x2="-4" y2="12"/><line x1="0" y1="8" x2="4" y2="12"/></g>`).join('')}</g>`:`<g transform="translate(${x},${y})"><path d="M0,-15 C7,-6 11,0 9,7 C7,13 -7,13 -9,7 C-11,0 -4,-4 -2,-10 C0,-5 3,-3 3,-3 C3,-8 1,-12 0,-15Z" fill="#ff862f"/><path d="M0,-2 C4,3 5,6 3,9 C1,12 -3,12 -4,9 C-5,6 -2,3 0,-2Z" fill="#f4d345"/></g>`;
 const draw=()=>{const full=q('[data-m]').value==='full',r=+q('[data-r]').value;q('[data-r]').disabled=full;q('[data-r]').closest('label').style.opacity=full?.4:1;
  el.querySelector('.viz-controls output').textContent=r;
  const H=D*c+pad*2,top=48;let x=10,g='';
  const put=(cols,rows,col,lab,labcol,ic,yOff=0)=>{const w=cols*c+pad*2;g+=block(x,top+yOff,cols,rows,col);if(lab)g+=label(x+w/2,top+H+34,lab,labcol);if(ic)g+=icon(x+w/2,top-22,ic);const cx=x+w/2;x+=w+12;return {cx,w};};
  const op=(t)=>{g+=`<text x="${x+10}" y="${top+H/2+9}" text-anchor="middle" style="fill:var(--text);font-family:KaTeX_Main,serif;font-size:30px">${t}</text>`;x+=32;};
  put(1,D,'#7a5a8c','y','var(--m-purple)');op('=');
  put(D,D,'#2a7a6a','W<tspan font-size="17" dy="6" style="font-family:KaTeX_Main,serif;font-style:normal;font-weight:400">0</tspan>','var(--m-teal)','ice');x-=6;
  put(1,D,'#2a6f8a','x','var(--accent)');op('+');
  let dwx0=x;
  if(full){put(D,D,'#4f8a3a','\u0394W','var(--m-green)','fire');x-=6;}
  else{const b=put(r,D,'#b4561f','B','var(--m-orange)','fire');x-=4;const a=put(D,r,'#8f7a2a','A','var(--viz-secondary)','fire');x-=6;
   g+=label((dwx0+x)/2,top+H+70,'<tspan style="fill:var(--m-green)">\u0394W</tspan><tspan style="fill:var(--text);font-style:normal;font-weight:400"> = </tspan><tspan style="fill:var(--m-orange)">B</tspan><tspan style="fill:var(--viz-secondary)">A</tspan>','var(--text)',26);}
  put(1,D,'#2a6f8a','x','var(--accent)');
  q('.viz-plot').innerHTML=`<svg viewBox="0 0 ${x} ${top+H+82}" role="img" aria-label="${full?'Full fine-tuning: y equals W0 x plus a full-size delta W times x':'LoRA: y equals W0 x plus B times A times x'}">${g}</svg>`;
  const toy=full?D*D:2*D*r,big=full?4096*4096:2*4096*r,fmt=n=>n.toLocaleString('en-US');
  q('.viz-result').innerHTML=full?`Trainable numbers in this toy layer: <strong>${toy}</strong> of 36. The update \u0394W has the same 6 \u00d7 6 shape as W<sub>0</sub>, and every entry is trained.<br>For a 4096 \u00d7 4096 layer: <strong>${fmt(big)}</strong> trainable numbers.`:`Trainable numbers in this toy layer: <strong>${toy}</strong> (B: 6 \u00d7 ${r}, A: ${r} \u00d7 6) instead of 36. W<sub>0</sub> stays frozen.<br>For a 4096 \u00d7 4096 layer with r = ${r}: <strong>${fmt(big)}</strong> trainable numbers, ${(big/(4096*4096)*100).toFixed(2)}% of ${fmt(4096*4096)}.`;};
 el.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',draw));draw();
}

// Key-value reading: correction = s1*b1 + s2*b2 with s_k = a_k . x
const KEYS=[15,105];
const VALS=[[0.8,0.5,-0.2,0.1],[-0.1,0.3,0.7,0.6]];
export function kvScores(theta,rel){return KEYS.map(k=>rel*Math.cos((theta-k)*Math.PI/180));}
const ts=(base,sub,sup)=>`<tspan font-style="italic">${base}</tspan>${sub?`<tspan baseline-shift="sub" font-size="10">${sub}</tspan>`:''}${sup?`<tspan baseline-shift="super" font-size="10">${sup}</tspan>`:''}`;
const hs=(base,sub,sup)=>`<em>${base}</em>${sub?`<sub>${sub}</sub>`:''}${sup?`<sup>${sup}</sup>`:''}`;
function kvWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>Keys detect, values correct</h3></div><p>The left panel is the plane spanned by the two unit-length keys ${hs('a',1)} and ${hs('a',2)}. The input ${hs('x')} has length 1; relevance is how much of it lies in this plane, and the rest points in directions both keys ignore. Each similarity score ${hs('a','k','T')}${hs('x')} scales its value ${hs('b','k')}, and the bars on the right show the resulting correction to four output coordinates. All numbers are illustrative.</p>
 <div class="viz-controls"><label>Input direction in the key plane <output></output><input type="range" min="0" max="359" value="25" data-t aria-label="Input direction in degrees"></label><label>Relevance to the keys <output></output><input type="range" min="0" max="1" step="0.01" value="1" data-rel aria-label="Relevance"></label></div>
 <div class="viz-plot"></div><div class="viz-legend"><span><i style="background:var(--m-orange)"></i><span class="lg">${hs('a',1)}, ${hs('b',1)} contribution</span></span><span><i style="background:var(--viz-secondary)"></i><span class="lg">${hs('a',2)}, ${hs('b',2)} contribution</span></span><span><i style="background:var(--accent)"></i><span class="lg">input ${hs('x')} (projection)</span></span><span><i style="background:var(--m-green)"></i><span class="lg">total correction</span></span></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s);
 const draw=()=>{const th=+q('[data-t]').value,rel=+q('[data-rel]').value;
  el.querySelectorAll('.viz-controls output').forEach((o,n)=>o.textContent=n?rel.toFixed(2):th+'\u00b0');
  const sc=kvScores(th,rel),dy=VALS[0].map((v,j)=>sc[0]*v+sc[1]*VALS[1][j]);
  const cx=115,cy=140,R=90,pt=(a,l)=>[cx+R*l*Math.cos(a*Math.PI/180),cy-R*l*Math.sin(a*Math.PI/180)];
  const arrow=(a,l,col,w,lab)=>{const [x,y]=pt(a,l),[lx,ly]=pt(a,Math.max(l,.25)+.22);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="${w+1.2}" fill="${col}"/><text x="${lx}" y="${ly+5}" text-anchor="middle" style="fill:${col};font-size:15px">${lab}</text>`};
  let svg=`<circle class="unit-circle" cx="${cx}" cy="${cy}" r="${R}"/><line class="axis" x1="${cx-R-12}" y1="${cy}" x2="${cx+R+12}" y2="${cy}" style="opacity:.25"/><line class="axis" x1="${cx}" y1="${cy-R-12}" x2="${cx}" y2="${cy+R+12}" style="opacity:.25"/>`;
  svg+=arrow(KEYS[0],1,'var(--m-orange)',2,ts('a',1))+arrow(KEYS[1],1,'var(--viz-secondary)',2,ts('a',2))+arrow(th,Math.max(rel,0.001),'var(--accent)',3,ts('x'));
  svg+=`<text x="${cx}" y="${cy+R+36}" text-anchor="middle">key plane</text>`;
  const L=300,Rr=540,mid=(L+Rr)/2,half=(Rr-L)/2;
  const sx=v=>mid+v*(half-44);
  svg+=`<text x="${L-40}" y="24">similarity scores</text>`;
  sc.forEach((v,k)=>{const y=40+k*30,col=k?'var(--viz-secondary)':'var(--m-orange)';svg+=`<rect x="${Math.min(mid,sx(v))}" y="${y}" width="${Math.abs(sx(v)-mid)}" height="16" fill="${col}" rx="2"/><text x="${L-10}" y="${y+13}" text-anchor="end">${ts('a',k+1,'T')}${ts('x')}</text><text x="${v>=0?sx(v)+6:sx(v)-6}" y="${y+13}" text-anchor="${v>=0?'start':'end'}">${(v>=0?'+':'\u2212')+Math.abs(v).toFixed(2)}</text>`;});
  svg+=`<line class="axis" x1="${mid}" y1="34" x2="${mid}" y2="102"/>`;
  svg+=`<text x="${L-40}" y="138">correction ${ts('\u0394y')} = ${ts('s',1)}${ts('b',1)} + ${ts('s',2)}${ts('b',2)}</text>`;
  const top=152,rowH=30,sy=v=>mid+v*(half-8)/1.1;
  dy.forEach((v,j)=>{const y=top+j*rowH,c1=sc[0]*VALS[0][j],c2=sc[1]*VALS[1][j];
   svg+=`<rect x="${Math.min(mid,sy(c1))}" y="${y}" width="${Math.abs(sy(c1)-mid)}" height="7" fill="var(--m-orange)" opacity=".8" rx="1"/><rect x="${Math.min(mid,sy(c2))}" y="${y+8}" width="${Math.abs(sy(c2)-mid)}" height="7" fill="var(--viz-secondary)" opacity=".8" rx="1"/><rect x="${Math.min(mid,sy(v))}" y="${y+16}" width="${Math.abs(sy(v)-mid)}" height="6" fill="var(--m-green)" rx="1"/><text x="${L-10}" y="${y+16}" text-anchor="end">${ts('y',j+1)}</text>`;});
  svg+=`<line class="axis" x1="${mid}" y1="${top-4}" x2="${mid}" y2="${top+4*rowH-4}"/>`;
  q('.viz-plot').innerHTML=`<svg viewBox="0 0 560 290" role="img" aria-label="Key plane with input direction, similarity scores, and resulting correction">${svg}</svg>`;
  const norm=Math.hypot(...dy);
  const f=v=>(v>=0?'':'\u2212')+Math.abs(v).toFixed(2);
  q('.viz-result').innerHTML=`Scores: ${hs('a',1,'T')}${hs('x')} = ${f(sc[0])}, ${hs('a',2,'T')}${hs('x')} = ${f(sc[1])}. Size of the correction \u2016\u0394${hs('y')}\u2016 = <strong>${norm.toFixed(2)}</strong>.<br>${rel<0.15?'The input is almost unrelated to both keys, so the adapter adds almost nothing and the layer behaves like the base model.':(()=>{const k=Math.abs(sc[0])>=Math.abs(sc[1])?0:1,o=1-k;if(Math.abs(sc[k])>0.85&&Math.abs(sc[o])<0.3)return sc[k]>0?`${hs('x')} is aligned with ${hs('a',k+1)}, so the correction is mostly ${hs('b',k+1)}.`:`${hs('x')} points opposite ${hs('a',k+1)}, so the score is negative and the correction mostly subtracts ${hs('b',k+1)}.`;return `Both keys respond, so the correction mixes ${hs('b',1)} and ${hs('b',2)}. A negative score subtracts its value.`})()}`;};
 el.querySelectorAll('input').forEach(x=>x.addEventListener('input',draw));draw();
}
const widgets={'lora-diagram':diagramWidget,'lora-sum':sumWidget,'lora-scale':scaleWidget,'lora-kv':kvWidget};
document.querySelectorAll('.explainer[data-explainer]').forEach(el=>widgets[el.dataset.explainer]?.(el));
