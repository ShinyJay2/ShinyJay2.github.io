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
 el.innerHTML=`<div class="viz-heading"><h3>Full fine-tuning versus LoRA</h3></div><p>A toy layer with a 6 \u00d7 6 weight matrix. Each square is one number, shaded by its value. Frozen matrices are drawn in muted tones; trainable ones are drawn solid. Switch the method and change the rank to see which numbers are trained.</p>
 <div class="viz-controls"><label>Method<select data-m aria-label="Method"><option value="lora">LoRA</option><option value="full">Full fine-tuning</option></select></label><label>Rank r <output></output><input type="range" min="1" max="4" value="2" data-r aria-label="Rank r"></label></div>
 <div class="viz-plot lora-diagram"></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s),D=6,c=20,gap=3,pad=7;
 const rnd=rng(23),VAL=[...Array(12)].map(()=>[...Array(12)].map(()=>0.25+0.75*rnd()));
 const block=(x,y,cols,rows,col,frozen,seed)=>{const w=cols*c+(cols-1)*gap+pad*2,h=rows*c+(rows-1)*gap+pad*2;
  let g=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${col}" fill-opacity="${frozen?.06:.1}" stroke="${col}" stroke-width="1.6" ${frozen?'stroke-dasharray="5 4" stroke-opacity=".7"':''}/>`;
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const v=VAL[(i+seed)%12][(j+seed*3)%12];g+=`<rect x="${x+pad+j*(c+gap)}" y="${y+pad+i*(c+gap)}" width="${c}" height="${c}" rx="3.5" fill="${col}" fill-opacity="${frozen?0.12+0.3*v:0.3+0.65*v}"/>`;}
  return {g,w,h};};
 const name=(x,y,t,col)=>`<text x="${x}" y="${y}" text-anchor="middle" style="fill:${col};font-family:KaTeX_Math,serif;font-style:italic;font-size:24px">${t}</text>`;
 const tag=(x,y,t,on)=>`<text x="${x}" y="${y}" text-anchor="middle" style="fill:${on?'var(--accent)':'var(--muted)'};font-family:var(--ui);font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">${t}</text>`;
 const dim=(x,y,t)=>`<text x="${x}" y="${y}" text-anchor="middle" style="fill:var(--muted);font-family:KaTeX_Main,serif;font-size:13px">${t}</text>`;
 const draw=()=>{const full=q('[data-m]').value==='full',r=+q('[data-r]').value;q('[data-r]').disabled=full;q('[data-r]').closest('label').style.opacity=full?.4:1;
  el.querySelector('.viz-controls output').textContent=r;
  const top=36,Hm=D*c+(D-1)*gap+pad*2;let x=8,g='';
  const put=(cols,rows,col,lab,labcol,state,dm,seed,sp=14)=>{const bl=block(x,top,cols,rows,col,state==='frozen',seed);g+=bl.g;const cx=x+bl.w/2;
   g+=name(cx,top+Hm+30,lab,labcol);if(dm)g+=dim(cx,top+Hm+48,dm);if(state){const on=state==='trainable';g+=`<path d="M${x} ${top-18} h${bl.w}" stroke="${on?'var(--accent)':'var(--muted)'}" stroke-width="1" ${on?'':'stroke-dasharray="4 3"'}/>`+tag(cx,top-24,state,on);}x+=bl.w+sp;return cx;};
  const op=t=>{g+=`<text x="${x+9}" y="${top+Hm/2+8}" text-anchor="middle" style="fill:var(--muted);font-family:KaTeX_Main,serif;font-size:26px">${t}</text>`;x+=30;};
  put(1,D,'var(--m-purple)','y','var(--m-purple)','','',1);op('=');
  put(D,D,'var(--m-teal)','W<tspan font-size="15" dy="5" style="font-family:KaTeX_Main,serif;font-style:normal">0</tspan>','var(--m-teal)','frozen','6 \u00d7 6',2,8);
  put(1,D,'var(--accent)','x','var(--accent)','','',4);op('+');
  const x0=x;
  if(full){put(D,D,'var(--m-green)','\u0394W','var(--m-green)','trainable','6 \u00d7 6',5,8);}
  else{const bx=put(r,D,'var(--m-orange)','B','var(--m-orange)','','6 \u00d7 '+r,6,6);const ax=put(D,r,'var(--viz-secondary)','A','var(--viz-secondary)','',r+' \u00d7 6',7,8);
   const x1=x-8;g+=`<path d="M${x0} ${top-18} h${x1-x0}" stroke="var(--accent)" stroke-width="1"/>`+tag((x0+x1)/2,top-24,'trainable',true);
   g+=`<text x="${(x0+x1)/2}" y="${top+Hm+76}" text-anchor="middle" style="font-family:KaTeX_Math,serif;font-style:italic;font-size:22px"><tspan style="fill:var(--m-green)">\u0394W</tspan><tspan style="fill:var(--muted);font-family:KaTeX_Main,serif;font-style:normal"> = </tspan><tspan style="fill:var(--m-orange)">B</tspan><tspan style="fill:var(--viz-secondary)">A</tspan></text>`;}
  put(1,D,'var(--accent)','x','var(--accent)','','',4,0);
  q('.viz-plot').innerHTML=`<svg viewBox="0 0 ${x+8} ${top+Hm+88}" role="img" aria-label="${full?'Full fine-tuning: y equals W0 x plus a full-size delta W times x':'LoRA: y equals W0 x plus B times A times x'}">${g}</svg>`;
  const toy=full?D*D:2*D*r,big=full?4096*4096:2*4096*r,fmt=n=>n.toLocaleString('en-US');
  q('.viz-result').innerHTML=full?`Trainable numbers in this toy layer: <strong>${toy}</strong> of 36. The update \u0394W has the same 6 \u00d7 6 shape as W<sub>0</sub>, and every entry is trained.<br>For a 4096 \u00d7 4096 layer: <strong>${fmt(big)}</strong> trainable numbers.`:`Trainable numbers in this toy layer: <strong>${toy}</strong> (B: 6 \u00d7 ${r}, A: ${r} \u00d7 6) instead of 36. W<sub>0</sub> stays frozen.<br>For a 4096 \u00d7 4096 layer with r = ${r}: <strong>${fmt(big)}</strong> trainable numbers, ${(big/(4096*4096)*100).toFixed(2)}% of ${fmt(4096*4096)}.`;};
 el.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',draw));draw();
}


// Pair diagram: y = W0 x + sum_k b_k (a_k^T x)
function pairsWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>The correction as key-value pairs</h3></div><p>Splitting <em>A</em> into rows and <em>B</em> into columns turns <em>BAx</em> into one term per pair. In each term, the key row and the input form a similarity score, a single number, which scales the value column.</p>
 <div class="viz-controls"><label>Rank r (number of pairs) <output></output><input type="range" min="1" max="3" value="2" data-r aria-label="Rank r"></label></div>
 <div class="viz-plot lora-diagram"></div>`;
 const q=s=>el.querySelector(s),D=5,c=17,gap=3,pad=6;
 const rnd=rng(41),VAL=[...Array(12)].map(()=>[...Array(12)].map(()=>0.25+0.75*rnd()));
 const sub=n=>`<tspan font-size="13" baseline-shift="-5" style="font-family:KaTeX_Main,serif;font-style:normal">${n}</tspan>`;
 const draw=()=>{const r=+q('[data-r]').value;q('.viz-controls output').textContent=r;
  const top=74,Hm=D*c+(D-1)*gap+pad*2;let x=6,g='';
  const block=(cols,rows,col,frozen,seed)=>{const w=cols*c+(cols-1)*gap+pad*2,h=rows*c+(rows-1)*gap+pad*2,x0=x;
   g+=`<rect x="${x0}" y="${top}" width="${w}" height="${h}" rx="6" fill="${col}" fill-opacity="${frozen?.06:.1}" stroke="${col}" stroke-width="1.5" ${frozen?'stroke-dasharray="5 4" stroke-opacity=".7"':''}/>`;
   for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const v=VAL[(i+seed)%12][(j+seed*3)%12];g+=`<rect x="${x0+pad+j*(c+gap)}" y="${top+pad+i*(c+gap)}" width="${c}" height="${c}" rx="3" fill="${col}" fill-opacity="${frozen?0.12+0.3*v:0.3+0.65*v}"/>`;}
   return {x0,w,cx:x0+w/2};};
  const name=(cx,t,col,role)=>{g+=`<text x="${cx}" y="${top+Hm+28}" text-anchor="middle" style="fill:${col};font-family:KaTeX_Math,serif;font-style:italic;font-size:22px">${t}</text>`;if(role)g+=`<text x="${cx}" y="${top+Hm+48}" text-anchor="middle" style="fill:var(--muted);font-family:var(--ui);font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">${role}</text>`;};
  const op=t=>{g+=`<text x="${x+9}" y="${top+Hm/2+8}" text-anchor="middle" style="fill:var(--muted);font-family:KaTeX_Main,serif;font-size:24px">${t}</text>`;x+=28;};
  let b=block(1,D,'var(--m-purple)',false,1);name(b.cx,'y','var(--m-purple)');x+=b.w+8;op('=');
  b=block(D,D,'var(--m-teal)',true,2);name(b.cx,'W'+sub(0),'var(--m-teal)','frozen');x+=b.w+6;
  b=block(1,D,'var(--accent)',false,4);name(b.cx,'x','var(--accent)');x+=b.w+8;
  for(let k=1;k<=r;k++){op('+');
   const bv=block(1,D,'var(--m-orange)',false,5+k);name(bv.cx,'b'+sub(k),'var(--m-orange)','value');x+=bv.w+6;
   const ak=block(D,1,'var(--viz-secondary)',false,8+k);g+=`<text x="${ak.cx}" y="${top+c+pad*2+30}" text-anchor="middle" style="fill:var(--viz-secondary);font-family:KaTeX_Math,serif;font-style:italic;font-size:22px">a${sub(k)}<tspan font-size="13" baseline-shift="10" style="font-family:KaTeX_Main,serif;font-style:normal">\u22a4</tspan></text><text x="${ak.cx}" y="${top+c+pad*2+50}" text-anchor="middle" style="fill:var(--muted);font-family:var(--ui);font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase">key</text>`;x+=ak.w+6;
   const xv=block(1,D,'var(--accent)',false,4);name(xv.cx,'x','var(--accent)');x+=xv.w+8;
   const L=ak.x0,R=xv.x0+xv.w,mid=(L+R)/2,yb=top-10;
   g+=`<path d="M${L} ${yb} q0 -8 8 -8 H${mid-8} q8 0 8 -8 q0 8 8 8 H${R-8} q8 0 8 8" fill="none" stroke="var(--text)" stroke-width="1.4" opacity=".7"/>`;
   g+=`<text x="${mid}" y="${yb-28}" text-anchor="middle" style="fill:var(--text);font-family:KaTeX_Main,serif;font-size:16px">similarity score <tspan style="fill:var(--viz-secondary);font-family:KaTeX_Math,serif;font-style:italic">a${sub(k)}<tspan font-size="11" baseline-shift="8" style="font-family:KaTeX_Main,serif;font-style:normal">\u22a4</tspan></tspan><tspan style="fill:var(--accent);font-family:KaTeX_Math,serif;font-style:italic">x</tspan></text>`;}
  q('.viz-plot').innerHTML=`<svg viewBox="0 0 ${x} ${top+Hm+60}" role="img" aria-label="y equals W0 x plus ${r} terms, each a value column b_k times the similarity score a_k transpose x">${g}</svg>`;};
 el.querySelectorAll('input').forEach(x=>x.addEventListener('input',draw));draw();
}


// Initialization: which choices give dy = 0 and nonzero gradients at step 1
function initWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>Four ways to start</h3></div><p>Pick how <em>B</em> and <em>A</em> start. The figure shows the two matrices (an empty outline means all zeros), the correction <em>BAx</em> for a sample input before any training, and the size of each matrix's gradient at the first step. Numbers come from fixed illustrative matrices.</p>
 <div class="viz-controls"><label>Initialization<select data-i aria-label="Initialization"><option value="rz">Random A, zero B</option><option value="zr">Zero A, random B</option><option value="rr">Random A, random B</option><option value="zz">Zero A, zero B</option></select></label></div>
 <div class="viz-plot lora-diagram"></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s),D=6,R=2,c=17,gap=3,pad=6;
 const r1=rng(91),r2=rng(57),r3=rng(13),r4=rng(29);
 const Ar=[...Array(R)].map(()=>[...Array(D)].map(()=>r1()*2-1)),Br=[...Array(D)].map(()=>[...Array(R)].map(()=>r2()*2-1));
 const x=[...Array(D)].map(()=>r3()*2-1),gv=[...Array(D)].map(()=>r4()*2-1);
 const nrm=M=>Math.sqrt(M.flat().reduce((a,v)=>a+v*v,0));
 const draw=()=>{const m=q('[data-i]').value,aR=m[0]==='r',bR=m[1]==='r';
  const A=aR?Ar:Ar.map(r=>r.map(()=>0)),B=bR?Br:Br.map(r=>r.map(()=>0));
  const z=A.map(row=>row.reduce((a,v,j)=>a+v*x[j],0)),dy=B.map(row=>row.reduce((a,v,k)=>a+v*z[k],0));
  const gB=gv.map(gi=>z.map(zk=>gi*zk)),Btg=[...Array(R)].map((_,k)=>B.reduce((a,row,i)=>a+row[k]*gv[i],0)),gA=Btg.map(t=>x.map(xj=>t*xj));
  const nDy=Math.hypot(...dy),nA=nrm(gA),nB=nrm(gB);
  let g='',X=10;const top=30;
  const block=(cols,rows,col,filled,lab,seed)=>{const w=cols*c+(cols-1)*gap+pad*2,h=rows*c+(rows-1)*gap+pad*2,x0=X;
   g+=`<rect x="${x0}" y="${top}" width="${w}" height="${h}" rx="6" fill="${col}" fill-opacity="${filled?.1:0}" stroke="${col}" stroke-width="1.5" ${filled?'':'stroke-dasharray="4 4"'}/>`;
   for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const v=Math.abs(Math.sin((i+1)*(j+3)*seed));g+=filled?`<rect x="${x0+pad+j*(c+gap)}" y="${top+pad+i*(c+gap)}" width="${c}" height="${c}" rx="3" fill="${col}" fill-opacity="${0.3+0.6*v}"/>`:`<text x="${x0+pad+j*(c+gap)+c/2}" y="${top+pad+i*(c+gap)+c/2+4}" text-anchor="middle" style="fill:${col};font-family:KaTeX_Main,serif;font-size:11px;opacity:.7">0</text>`;}
   g+=`<text x="${x0+w/2}" y="${top+h+26}" text-anchor="middle" style="fill:${col};font-family:KaTeX_Math,serif;font-style:italic;font-size:22px">${lab}</text><text x="${x0+w/2}" y="${top+h+44}" text-anchor="middle" style="fill:var(--muted);font-family:var(--ui);font-size:10.5px;font-weight:600;letter-spacing:.12em">${filled?'RANDOM':'ZERO'}</text>`;
   X+=w+8;return h;};
  const h=block(R,D,'var(--m-orange)',bR,'B',1.3);block(D,R,'var(--viz-secondary)',aR,'A',2.1);
  const L=X+40,W=230,mx=Math.max(nDy,nA,nB,1e-9),sc=v=>v/Math.max(mx,1.2)*W;
  const row=(i,label,v,col,note)=>{const y=top+12+i*46;g+=`<text x="${L}" y="${y}" style="fill:var(--text);font-family:KaTeX_Main,serif;font-size:14px">${label}</text><rect x="${L}" y="${y+8}" width="${W}" height="10" rx="3" fill="var(--line)"/><rect x="${L}" y="${y+8}" width="${sc(v)}" height="10" rx="3" fill="${col}"/><text x="${L+W+8}" y="${y+17}" style="fill:${v<1e-9?'var(--m-red)':'var(--muted)'};font-family:KaTeX_Main,serif;font-size:13px">${v<1e-9?'0':v.toFixed(2)}</text>`;};
  row(0,'correction BAx before training',nDy,'var(--m-purple)');row(1,'gradient reaching B at step 1',nB,'var(--m-orange)');row(2,'gradient reaching A at step 1',nA,'var(--viz-secondary)');
  q('.viz-plot').innerHTML=`<svg viewBox="0 0 ${L+W+50} ${top+h+56}" role="img" aria-label="Initialization comparison">${g}</svg>`;
  const verdict={rz:'Works, and is the LoRA default. The correction starts at zero. Only B learns at the first step; once B is nonzero, A learns too.',zr:'Also works. The correction starts at zero. Only A learns at the first step; B waits until A produces nonzero features.',rr:'Does not start from the pretrained model. The adapter already changes the output before any training.',zz:'Dead on arrival. The correction is zero, but so are both gradients, so nothing ever moves.'}[m];
  q('.viz-result').innerHTML=`<strong>${({rz:'Random A, zero B',zr:'Zero A, random B',rr:'Random A, random B',zz:'Zero A, zero B'})[m]}.</strong> ${verdict}`;};
 q('[data-i]').addEventListener('input',draw);draw();
}


// Lookup: input -> score against each key -> scale each value -> sum = correction
function lookupWidget(el){
 const KEYS=[[1,0,0],[0,1,0]],VALS=[[0.3,-0.1,0.2],[-0.1,0.3,0.4]];
 const PRESETS={chest:[0.9,0.1,0.3],sugar:[0.6,0.7,0.2],cook:[0,0,1]};
 el.innerHTML=`<div class="viz-heading"><h3>One lookup, step by step</h3></div><p>The layer never sees text. Before a question reaches this layer, the model has already turned it into a list of numbers, the vector <em>x</em>. Real vectors have thousands of numbers with no simple meaning; here we pretend <em>x</em> has only three, read as how heart-related, how diabetes-related, and how much about something else the question is. Pick a question, then follow the figure left to right.</p>
 <div class="viz-controls"><label>Input<select data-p aria-label="Input"><option value="chest">A chest-pain question</option><option value="sugar">Blood sugar after heart surgery</option><option value="cook">A cooking question</option><option value="custom">Custom (sliders)</option></select></label><label>how heart-related <output></output><input type="range" min="0" max="1" step="0.05" data-x="0" aria-label="heart-related"></label><label>how diabetes-related <output></output><input type="range" min="0" max="1" step="0.05" data-x="1" aria-label="diabetes-related"></label><label>how much about something else <output></output><input type="range" min="0" max="1" step="0.05" data-x="2" aria-label="something else"></label></div>
 <div class="lookup-q"></div><div class="viz-plot lora-diagram"></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s),cs=34,f=v=>(v<0?'\u2212':'')+Math.abs(v).toFixed(2);
 const T=(x,y,t,st='')=>`<text x="${x}" y="${y}" text-anchor="middle" style="font-family:KaTeX_Main,serif;font-size:13px;fill:var(--text);${st}">${t}</text>`;
 const cell=(x,y,v,col,max=1,w=cs,h=26)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${col}" fill-opacity="${0.08+0.8*Math.min(1,Math.abs(v)/max)}" stroke="${col}" stroke-opacity=".5"/>`+T(x+w/2,y+h/2+5,f(v).replace('.00',''),Math.abs(v)/max>.55?'fill:#fff':'');
 const head=(x,y,t)=>`<text x="${x}" y="${y}" text-anchor="middle" style="font-family:var(--ui);font-size:10.5px;font-weight:600;letter-spacing:.1em;fill:var(--muted)">${t}</text>`;
 const mt=(x,y,t,col,sz=18)=>`<text x="${x}" y="${y}" text-anchor="middle" style="font-family:KaTeX_Math,serif;font-style:italic;font-size:${sz}px;fill:${col}">${t}</text>`;
 const setX=v=>{el.querySelectorAll('[data-x]').forEach((r,i)=>{r.value=v[i]});};
 const QTXT={chest:['“What causes','chest pain?”'],sugar:['“Why is my blood sugar','high after heart surgery?”'],cook:['“How long should I','boil an egg?”']};
 const draw=()=>{const pk=q('[data-p]').value;const qq=QTXT[pk]||['(your own input)',''];const qtext='';const xv=[...el.querySelectorAll('[data-x]')].map(r=>+r.value);el.querySelectorAll('.viz-controls output').forEach((o,i)=>o.textContent=xv[i].toFixed(2));
  q('.lookup-q').innerHTML=`<span class="lq-label">Question</span><span class="lq-text">${pk==='custom'?'(set by the sliders)':qq.join(' ').replace('” “',' ')}</span><span class="lq-arrow">→ model turns it into numbers →</span><span class="lq-x"><em>x</em> = (${xv.map(v=>v.toFixed(2)).join(', ')})</span>`;
  const sc=KEYS.map(k=>k.reduce((a,v,j)=>a+v*xv[j],0)),con=VALS.map((b,k)=>b.map(v=>v*sc[k])),cor=[0,1,2].map(i=>con[0][i]+con[1][i]);
  let g='';const top=40,rowY=[top+20,top+150];
  // column x
  g+=head(40,top-12,'x');['heart','diabetes','other'].forEach((l,i)=>{g+=cell(23,top+20+i*40,xv[i],'var(--accent)');g+=`<text x="16" y="${top+38+i*40}" text-anchor="end" style="font-family:var(--ui);font-size:10px;fill:var(--muted)">${l}</text>`;});
  // per key rows
  g+=head(185,top-12,'1. COMPARE WITH EACH KEY');g+=head(420,top-12,'2. SCALE EACH VALUE');g+=head(612,top-12,'3. ADD');
  [0,1].forEach(k=>{const y=rowY[k],kc='var(--viz-secondary)',vc='var(--m-orange)';
   g+=`<path d="M${23+cs} ${top+20+50} C ${80} ${top+70}, ${80} ${y+13}, ${105} ${y+13}" fill="none" stroke="var(--muted)" stroke-opacity=".5"/>`;
   g+=mt(122,y+18,`a<tspan font-size="11" baseline-shift="-4">${k+1}</tspan>`,kc,17);
   KEYS[k].forEach((v,j)=>g+=cell(140+j*(cs+4),y,v,kc));
   g+=T(273,y+18,'\u00b7 x =','font-size:15px');
   g+=`<rect x="290" y="${y-2}" width="50" height="30" rx="6" fill="var(--viz-secondary)" fill-opacity="${0.12+0.75*Math.min(1,Math.abs(sc[k]))}"/>`+T(315,y+18,f(sc[k]),`font-size:15px;${Math.abs(sc[k])>.55?'fill:#fff':''}`);
   g+=`<text x="315" y="${y+46}" text-anchor="middle" style="font-family:var(--ui);font-size:10px;fill:var(--muted)">score s${k+1}</text>`;
   g+=T(360,y+18,'\u00d7','font-size:16px');
   VALS[k].forEach((v,i)=>g+=cell(376,y-30+i*30,v,vc,0.4,cs,24));g+=mt(393,y+76,`b<tspan font-size="11" baseline-shift="-4">${k+1}</tspan>`,vc,17);
   g+=T(430,y+18,'=','font-size:16px');
   con[k].forEach((v,i)=>g+=cell(446,y-30+i*30,v,vc,0.4,cs+10,24));
   g+=`<text x="${468}" y="${y+76}" text-anchor="middle" style="font-family:KaTeX_Main,serif;font-size:13px;fill:var(--muted)">s${k+1} b${k+1}</text>`;
   g+=`<path d="M${446+cs+12} ${y+13} C ${530} ${y+13}, ${540} ${top+105}, ${585} ${top+105}" fill="none" stroke="var(--muted)" stroke-opacity=".5"/>`;
  });
  cor.forEach((v,i)=>g+=cell(590,top+62+i*32,v,'var(--m-green)',0.5,cs+12,26));
  g+=`<text x="613" y="${top+176}" text-anchor="middle" style="font-family:KaTeX_Math,serif;font-style:italic;font-size:17px;fill:var(--m-green)">BAx</text><text x="613" y="${top+194}" text-anchor="middle" style="font-family:var(--ui);font-size:10px;fill:var(--muted)">correction</text>`;
  q('.viz-plot').innerHTML=`<svg viewBox="0 0 712 ${top+260}" role="img" aria-label="Input compared with two keys, values scaled by scores and summed into the correction"><g transform="translate(52,0)">${g}</g></svg>`;
  const mag=Math.hypot(...cor),dom=Math.abs(sc[0])>Math.abs(sc[1])?1:2;
  q('.viz-result').innerHTML=`Scores: s<sub>1</sub> = ${f(sc[0])}, s<sub>2</sub> = ${f(sc[1])}. Correction = ${f(sc[0])}\u00b7b<sub>1</sub> + ${f(sc[1])}\u00b7b<sub>2</sub> = (${cor.map(f).join(', ')}).<br>${mag<0.05?'The input matches neither key, so almost nothing is added: the layer acts like the base model. This is what <em>local</em> means.':Math.min(Math.abs(sc[0]),Math.abs(sc[1]))>0.4?'The input matches both keys, so it retrieves a mixture of both values. This is what <em>associative</em> means: retrieval by similarity, not by an exact match.':`The input mostly matches key ${dom}, so the correction is mostly value ${dom}, even though this exact input was never stored.`}`;};
 q('[data-p]').addEventListener('input',e=>{if(PRESETS[e.target.value])setX(PRESETS[e.target.value]);draw();});
 el.querySelectorAll('[data-x]').forEach(r=>r.addEventListener('input',()=>{q('[data-p]').value='custom';draw();}));
 setX(PRESETS.chest);draw();
}

// Key-value reading: correction = s1*b1 + s2*b2 with s_k = a_k . x
const KEYS=[15,105];
const VALS=[[0.8,0.5,-0.2,0.1],[-0.1,0.3,0.7,0.6]];
export function kvScores(theta,rel){return KEYS.map(k=>rel*Math.cos((theta-k)*Math.PI/180));}
const ts=(base,sub,sup)=>`<tspan font-style="italic">${base}</tspan>${sub?`<tspan baseline-shift="sub" font-size="10">${sub}</tspan>`:''}${sup?`<tspan baseline-shift="super" font-size="10">${sup}</tspan>`:''}`;
const hs=(base,sub,sup)=>`<em>${base}</em>${sub?`<sub>${sub}</sub>`:''}${sup?`<sup>${sup}</sup>`:''}`;
function kvWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>Keys detect, values correct</h3></div><p>The left panel is the plane spanned by the two unit-length keys ${hs('a',1)} and ${hs('a',2)}. The input ${hs('x')} has length 1; "part the keys can see" is how much of x lies in this plane; the rest lies in directions that give a score of zero for both keys. Each similarity score ${hs('a','k','T')}${hs('x')} scales its value ${hs('b','k')}, and the bars on the right show the resulting correction to four output coordinates. All numbers are illustrative.</p>
 <div class="viz-controls"><label>Input direction in the key plane <output></output><input type="range" min="0" max="359" value="25" data-t aria-label="Input direction in degrees"></label><label>Part of x the keys can see <output></output><input type="range" min="0" max="1" step="0.01" value="1" data-rel aria-label="Relevance"></label></div>
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
const widgets={'lora-diagram':diagramWidget,'lora-lookup':lookupWidget,'lora-init':initWidget,'lora-pairs':pairsWidget,'lora-sum':sumWidget,'lora-scale':scaleWidget,'lora-kv':kvWidget};
document.querySelectorAll('.explainer[data-explainer]').forEach(el=>widgets[el.dataset.explainer]?.(el));
