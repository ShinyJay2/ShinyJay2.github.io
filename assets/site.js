const toggle = document.querySelector('.theme');
function updateThemeLabel(){const dark=document.documentElement.dataset.theme==='dark';toggle.querySelector('.theme-icon').textContent=dark?'☾':'☼';toggle.querySelector('.theme-label').textContent=dark?'Light':'Dark';toggle.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');}
updateThemeLabel();
toggle.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('theme',next)}catch{}updateThemeLabel()});
const search=document.querySelector('#search');
let category='All';
function filterPosts(){let count=0;document.querySelectorAll('[data-post]').forEach(post=>{const matches=(!search.value||post.textContent.toLowerCase().includes(search.value.toLowerCase()))&&(category==='All'||post.dataset.category===category);post.hidden=!matches;if(matches)count++});document.querySelector('#empty').hidden=count>0;document.querySelector('#count').textContent=`${count} ${count===1?'post':'posts'}`;}
if(search){search.addEventListener('input',filterPosts);document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.category;document.querySelectorAll('.filter').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filterPosts()}));}
function paintRange(r){const min=+r.min||0,max=+r.max||100;r.style.setProperty('--fill',((r.value-min)/(max-min)*100)+'%')}
function paintAll(){document.querySelectorAll('.explainer input[type=range]').forEach(paintRange)}
document.addEventListener('input',e=>{if(e.target.matches?.('.explainer input[type=range]'))paintRange(e.target)});
new MutationObserver(paintAll).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',paintAll);
// Code section: scroller buttons, edge masks, live star counts.
(function(){const sc=document.querySelector('.repo-scroller');if(!sc)return;
 const btns=document.querySelectorAll('.repo-btn');
 const upd=()=>{const s=sc.scrollLeft<=2,e=sc.scrollLeft+sc.clientWidth>=sc.scrollWidth-2;sc.classList.toggle('is-start',s);sc.classList.toggle('is-end',e);btns.forEach(b=>b.disabled=b.dataset.dir==='-1'?s:e)};
 btns.forEach(b=>b.addEventListener('click',()=>sc.scrollBy({left:+b.dataset.dir*(sc.clientWidth*.8)})));
 sc.addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);upd();
 const fmt=n=>n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+'k':String(n);
 fetch('https://api.github.com/users/ShinyJay2/repos?per_page=100').then(r=>r.ok?r.json():[]).then(list=>{const m=new Map(list.map(r=>[r.full_name.toLowerCase(),r.stargazers_count]));document.querySelectorAll('.repo-star-count').forEach(el=>{const v=m.get(el.dataset.repo.toLowerCase());if(v!=null)el.textContent=fmt(v)})}).catch(()=>{});
})();
