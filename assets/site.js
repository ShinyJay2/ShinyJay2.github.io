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
