const toggle = document.querySelector('.theme');
function updateThemeLabel(){const dark=document.documentElement.dataset.theme==='dark';toggle.textContent=dark?'☼':'◐';toggle.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');}
updateThemeLabel();
toggle.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('theme',next)}catch{}updateThemeLabel()});
const search=document.querySelector('#search');
let category='All';
function filterPosts(){let count=0;document.querySelectorAll('[data-post]').forEach(post=>{const matches=(!search.value||post.textContent.toLowerCase().includes(search.value.toLowerCase()))&&(category==='All'||post.dataset.category===category);post.hidden=!matches;if(matches)count++});document.querySelector('#empty').hidden=count>0;document.querySelector('#count').textContent=`${count} ${count===1?'post':'posts'}`;}
if(search){search.addEventListener('input',filterPosts);document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.category;document.querySelectorAll('.filter').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filterPosts()}));}
