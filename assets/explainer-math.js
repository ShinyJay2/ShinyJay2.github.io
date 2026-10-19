export const gaussianCF=w=>Math.exp(-w*w/2);
export function cf(samples,w){return {c:samples.reduce((sum,s)=>sum+Math.cos(w*s),0)/samples.length,q:samples.reduce((sum,s)=>sum+Math.sin(w*s),0)/samples.length};}
export function ema(values,m,initial=values[0]){let previous=initial;return values.map(value=>(previous=m*previous+(1-m)*value));}
export function normalPairs(count,seed=12345){let state=seed>>>0;const random=()=>((state=(1664525*state+1013904223)>>>0)+1)/4294967297;return Array.from({length:count},()=>{const r=Math.sqrt(-2*Math.log(random())),a=2*Math.PI*random();return [r*Math.cos(a),r*Math.sin(a)];});}
export function cloud(shape,count=256){return normalPairs(count).map(([x,y])=>shape==='collapse'?[0,0]:shape==='line'?[x,0]:shape==='stretch'?[1.7*x,.35*y]:[x,y]);}
export const project=(points,angle)=>points.map(([x,y])=>x*Math.cos(angle)+y*Math.sin(angle));
export function moments(samples){const mean=samples.reduce((a,b)=>a+b,0)/samples.length;return {mean,variance:samples.reduce((a,b)=>a+(b-mean)**2,0)/samples.length};}
