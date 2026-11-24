// Interactive widgets for the Development Study series. Addresses, ports, and sequence numbers are illustrative.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_PORT={'http:':80,'https:':443};

// 1. URL anatomy: which part is the host, the port, the path, and the query.
function urlWidget(el){
 const presets=['https://shop.com/products/7?color=red','http://localhost:8080/posts/3','https://www.naver.com:443/news/list?page=2','http://203.0.113.10/'];
 el.innerHTML=`<div class="viz-heading"><h3>Splitting a URL into its parts</h3></div><p>Choose an example or type any URL. The address is split into the protocol, host, port, path, and query string. When the port is omitted, the browser uses the default for the protocol.</p>
 <div class="viz-controls"><label>Example<select data-p aria-label="Example URL">${presets.map(p=>`<option>${esc(p)}</option>`).join('')}</select></label><label>URL<input class="dev-input" data-u type="text" spellcheck="false" autocomplete="off" aria-label="URL" value="${esc(presets[0])}"></label></div>
 <div class="dev-url" aria-live="polite"></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s);
 const draw=()=>{let u;try{u=new URL(q('[data-u]').value.trim())}catch{q('.dev-url').innerHTML='';q('.viz-result').textContent='This is not a complete URL. Include the protocol, for example https://';return}
  if(!DEFAULT_PORT[u.protocol]){q('.dev-url').innerHTML='';q('.viz-result').textContent='Only http:// and https:// URLs are explained here.';return}
  const port=u.port||String(DEFAULT_PORT[u.protocol]),implicit=!u.port;
  const parts=[['protocol',u.protocol+'//','Protocol','The rules for the conversation. https is HTTP over TLS.'],['host',u.hostname,'Host','Which computer. A domain name is turned into an IP address by DNS.'+(u.hostname==='localhost'?' localhost means this computer itself.':'')],['port',implicit?'':':'+u.port,'Port',implicit?`Omitted, so the default ${port} for ${u.protocol.slice(0,-1)} is used.`:`Port ${port}: which program on that computer.`],['path',u.pathname,'Path','Which resource. The path starts at the first / after the host.'],['query',u.search,'Query','Extra options as key=value pairs after ?.']];
  q('.dev-url').innerHTML=`<div class="dev-url-line">${parts.map(([k,v])=>v?`<span class="seg ${k}">${esc(v)}</span>`:(k==='port'?`<span class="seg port ghost" title="implicit">:${port}</span>`:'')).join('')}</div>
  <table class="viz-table dev-parts"><tbody>${parts.map(([k,v,l,d])=>`<tr><th><span class="dot ${k}"></span>${l}</th><td><code>${esc(k==='port'?port+(implicit?' (default)':''):(v||'(none)'))}</code></td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>`;
  q('.viz-result').innerHTML=`Typed into the address bar, this sends <strong>GET ${esc(u.pathname+u.search)}</strong> to <strong>${esc(u.hostname)}</strong> on port <strong>${port}</strong>. The address bar can only send GET; POST, PUT, and DELETE come from forms, application code, or tools such as curl and Postman.`;};
 q('[data-p]').addEventListener('input',()=>{q('[data-u]').value=q('[data-p]').value;draw()});
 q('[data-u]').addEventListener('input',draw);draw();
}

// 2. Encapsulation: one GET request going down four layers, across routers, and up again.
function layersWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>One request passing through four layers</h3></div><p>Move the step slider to follow a single request for <code>/posts/3</code>. On the sending side each layer adds its own header around what it received; routers read only the outer IP header; on the receiving side each layer removes its header and hands the rest upward. Switch between HTTP and HTTPS to see what an observer on the network can read.</p>
 <div class="viz-controls"><label>Protocol<select data-m aria-label="Protocol"><option value="https">HTTPS</option><option value="http">HTTP (no TLS)</option></select></label><label>Step <output></output><input type="range" min="0" max="8" value="0" data-s aria-label="Step"></label></div>
 <div class="dev-stage"></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s);
 const L=['HTTP','TLS','TCP','IP'];
 const draw=()=>{const tls=q('[data-m]').value==='https',s=+q('[data-s]').value;q('.viz-controls output').textContent=`${s} of 8`;
  // depth = number of layers currently wrapped around the message
  const depth=[1,2,3,4,4,3,2,1,0][s];
  const side=s<4?'client':s===4?'net':'server';
  const active=s<4?L[s]:s===4?'IP':L[8-s];
  // The HTTP text is ciphertext while TLS wraps it (sender steps 1-3, transit, receiver steps 5-6).
  const encrypted=tls&&depth>=2;
  const wraps=[null,['tls','TLS','record header; payload is encrypted'],['tcp','TCP','src port 52341, dst port 443, seq 1001'],['ip','IP','src 192.168.0.5, dst 203.0.113.10']];
  let box=`<div class="pk http"><b>HTTP message</b>${encrypted?'<span class="cipher">9f 3a c1 7e 02 d4 8b 55 ... (encrypted)</span>':'<span class="plain">GET /posts/3 HTTP/1.1<br>Host: shop.com</span>'}</div>`;
  for(let d=2;d<=Math.max(1,depth);d++){const [k,n,info]=wraps[d-1];if(k==='tls'&&!tls)continue;box=`<div class="pk ${k}"><b>${n} header</b><small>${esc(info)}</small>${box}</div>`;}
  const stack=(who,on)=>`<div class="dev-stack ${on?'on':''}"><div class="who">${who}</div>${L.map(l=>`<div class="lay ${l==='TLS'&&!tls?'off':''} ${on&&l===active?'cur':''}">${l}</div>`).join('')}</div>`;
  q('.dev-stage').innerHTML=`${stack('Client (browser)',side==='client')}<div class="dev-mid"><div class="dev-dir">${s<4?'going down: wrap':s===4?'in transit: routers read the IP header only':'going up: unwrap'}</div>${box}</div>${stack('Server (shop.com)',side==='server')}`;
  const msg=[
   'The browser builds an HTTP request: method, path, and headers. Nothing has been sent yet.',
   tls?'TLS encrypts the whole HTTP message with the session key agreed during the TLS handshake. From here on the method, path, headers, and body are unreadable from outside.':'With plain HTTP there is no TLS layer. The text goes down unchanged and remains readable to anyone who sees the packet.',
   'TCP adds its header: source port 52341, destination port 443, and a sequence number so the receiver can reorder, detect loss, and acknowledge.',
   'IP adds its header: source and destination IP addresses. This is the complete packet that leaves the machine.',
   `Routers between the two machines read only the destination IP and forward the packet. An observer here sees IP addresses and ports${tls?', but the HTTP part is ciphertext.':', and also the full HTTP text, including any password in the body.'}`,
   'The server’s IP layer checks that the destination address is its own and removes the IP header.',
   'The operating system’s TCP code reads destination port 443, puts the bytes in order, sends an ACK, and hands the data to the program listening on 443.',
   tls?'TLS decrypts the record with the same session key and recovers the original HTTP text.':'No TLS layer: the data is already plain HTTP.',
   'The web server receives exactly the message the browser wrote. Application code, for example a Spring controller, runs here. The response makes the same trip in reverse.'][s];
  q('.viz-result').innerHTML=`<strong>Step ${s}.</strong> ${msg}`;};
 el.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',draw));draw();
}

// 3. TCP: three-way handshake, sequence numbers, cumulative ACKs, and retransmission.
function tcpWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>Handshake, acknowledgements, and a lost segment</h3></div><p>The client sends 1,000 bytes as two 500-byte segments after the handshake. Step through the exchange, then turn on packet loss to see how sequence numbers and acknowledgements let TCP notice the gap and resend. Initial sequence numbers are fixed at 1000 and 5000 for readability; real ones are random.</p>
 <div class="viz-controls"><label>Network<select data-l aria-label="Network"><option value="ok">No loss</option><option value="loss">First data segment is lost</option></select></label><label>Step <output></output><input type="range" min="1" max="7" value="7" data-s aria-label="Step"></label></div>
 <div class="viz-plot dev-seq"></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s);
 const OK=[
  ['c','SYN, seq=1000','Client: let us connect; my byte numbering starts after 1000.'],
  ['s','SYN+ACK, seq=5000, ack=1001','Server: received your SYN (ack=1001 is the next number expected); my numbering starts after 5000.'],
  ['c','ACK, ack=5001','Client: received your SYN. The connection is established after these three messages.'],
  ['c','DATA seq=1001, 500 bytes (1001–1500)','The first segment carries bytes 1001 through 1500.'],
  ['s','ACK, ack=1501','Server: everything up to 1500 arrived; 1501 is next.'],
  ['c','DATA seq=1501, 500 bytes (1501–2000)','The second segment carries bytes 1501 through 2000.'],
  ['s','ACK, ack=2001','Server: everything up to 2000 arrived. All 1,000 bytes are delivered in order.']];
 const LOSS=[OK[0],OK[1],OK[2],
  ['c','DATA seq=1001, 500 bytes (1001–1500)','The first data segment is dropped by a busy router. The server never sees it.','lost'],
  ['c','DATA seq=1501, 500 bytes (1501–2000)','The second segment arrives. The server stores it but cannot pass it up yet, because bytes 1001–1500 are missing.'],
  ['s','ACK, ack=1001','Server: I still need byte 1001. The acknowledgement number does not advance past a gap.'],
  ['c','DATA seq=1001 (retransmission)','No ACK for 1500 arrives before the timer expires, so the client resends bytes 1001–1500. The server now has 1001–2000 and replies ack=2001.','re']];
 const draw=()=>{const loss=q('[data-l]').value==='loss',s=+q('[data-s]').value,M=loss?LOSS:OK;q('.viz-controls output').textContent=`${s} of 7`;
  const W=460,X1=70,X2=390,T=40,G=44,H=T+G*7+20;let g=`<text x="${X1}" y="20" text-anchor="middle" style="font-weight:500;fill:var(--text)">Client</text><text x="${X2}" y="20" text-anchor="middle" style="font-weight:500;fill:var(--text)">Server</text><line class="axis" x1="${X1}" x2="${X1}" y1="28" y2="${H-6}"/><line class="axis" x1="${X2}" x2="${X2}" y1="28" y2="${H-6}"/>`;
  M.slice(0,s).forEach(([d,label,,kind],i)=>{const y=T+i*G,y2=y+G*.62,from=d==='c'?X1:X2,to=d==='c'?X2:X1,cur=i===s-1,cls=cur?'primary':'secondary';
   const endX=kind==='lost'?(from+to)/2:to;
   g+=`<line class="${cls}" x1="${from}" y1="${y}" x2="${endX}" y2="${kind==='lost'?(y+y2)/2:y2}" ${kind==='re'?'stroke-dasharray="6 4"':''}/>`;
   if(kind==='lost')g+=`<text x="${endX}" y="${(y+y2)/2+5}" text-anchor="middle" style="font-size:18px;font-weight:700;fill:var(--m-red,#c0392b)">✕</text>`;
   else{const a=d==='c'?-1:1;g+=`<path class="${cls}" d="M${to+a*9},${y2-6} L${to},${y2} L${to+a*9},${y2+5}"/>`;}
   g+=`<text x="${(X1+X2)/2}" y="${y-4}" text-anchor="middle" style="${cur?'fill:var(--accent);font-weight:500':''}">${esc(label)}</text>`;});
  q('.dev-seq').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="TCP sequence diagram">${g}</svg>`;
  q('.viz-result').innerHTML=`<strong>${esc(M[s-1][1])}</strong><br>${esc(M[s-1][2])}`;};
 el.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',draw));draw();
}

// 4. Forward versus reverse proxy, and the path from port 443 to a Spring application.
function proxyWidget(el){
 el.innerHTML=`<div class="viz-heading"><h3>Who the proxy works for, and who gets hidden</h3></div><p>Both kinds of proxy receive a request and send a new request of their own. Choose a kind and step through the hops; the table shows what each party can see.</p>
 <div class="viz-controls"><label>Proxy<select data-k aria-label="Proxy kind"><option value="rev">Reverse proxy (nginx in front of Spring)</option><option value="fwd">Forward proxy (company network exit)</option></select></label><label>Hop <output></output><input type="range" min="1" max="4" value="1" data-h aria-label="Hop"></label></div>
 <div class="viz-plot dev-proxy"></div><div class="viz-result" aria-live="polite"></div>`;
 const q=s=>el.querySelector(s);
 const K={
  rev:{boxes:[['User browser','203.0.113.20'],['nginx','shop.com : 443'],['Spring app','127.0.0.1 : 8080']],hidden:2,
   hops:[[0,1,'The browser opens a connection to shop.com on port 443. It has no idea Spring exists.'],[1,1,'The server’s operating system sees destination port 443 and gives the data to nginx, the program listening on 443. nginx decrypts TLS and reads the HTTP request: the path starts with /api/.'],[1,2,'nginx acts as a client: it opens a new TCP connection to 127.0.0.1:8080 and sends a new HTTP request. The operating system sees port 8080 and hands it to Spring.'],[2,0,'Spring builds the response and returns it to nginx, which returns it to the browser over the original HTTPS connection.']],
   see:[['Browser sees','shop.com:443 only. The servers behind nginx, their number, and their ports stay hidden.'],['Spring sees','A request from 127.0.0.1 (nginx). The real user IP is visible only if nginx passes it in a header such as X-Forwarded-For.']]},
  fwd:{boxes:[['Employee PC','10.0.0.5 (private)'],['Forward proxy','198.51.100.7'],['shop.com','203.0.113.10 : 443']],hidden:0,
   hops:[[0,1,'The PC is configured to send every outbound request to the company proxy instead of directly to the internet.'],[1,1,'The proxy checks company policy: blocked sites, logging, cached files.'],[1,2,'The proxy opens its own connection to shop.com and sends the request in its own name.'],[2,0,'The response comes back to the proxy, which hands it to the PC.']],
   see:[['shop.com sees','Requests from 198.51.100.7, the proxy. Which employee asked stays hidden.'],['Employee sees','The normal site; the proxy is mostly invisible to them.']]}};
 const draw=()=>{const k=K[q('[data-k]').value],h=+q('[data-h]').value;q('.viz-controls output').textContent=`${h} of 4`;
  const W=460,H=170,bw=120,bh=58,xs=[10,170,330],y=40;const [a,b]=k.hops[h-1];
  let g='';k.boxes.forEach(([n,addr],i)=>{const on=i===a||i===b,hid=i===k.hidden;g+=`<rect x="${xs[i]}" y="${y}" width="${bw}" height="${bh}" rx="7" style="fill:var(--bg);stroke:${on?'var(--accent)':'var(--line)'};stroke-width:${on?2:1.2}" ${hid?'stroke-dasharray="5 4"':''}/><text x="${xs[i]+bw/2}" y="${y+25}" text-anchor="middle" style="fill:var(--text);font-weight:500">${esc(n)}</text><text x="${xs[i]+bw/2}" y="${y+44}" text-anchor="middle" style="font-size:11px">${esc(addr)}</text>${hid?`<text x="${xs[i]+bw/2}" y="${y+bh+20}" text-anchor="middle" style="font-size:11px">hidden by the proxy</text>`:''}`;});
  [[0,1],[1,2]].forEach(([i,j])=>{const on=(a===i&&b===j)||(a===j&&b===i)||(h===4&&k.hops[3][0]!==k.hops[3][1]);g+=`<line class="${on?'primary':'secondary'}" style="opacity:${on?1:.35}" x1="${xs[i]+bw}" y1="${y+bh/2}" x2="${xs[j]}" y2="${y+bh/2}"/>`;});
  g+=`<text x="${xs[1]+bw/2}" y="22" text-anchor="middle" style="fill:var(--accent);font-size:12px">${q('[data-k]').value==='rev'?'works for the server':'works for the client'}</text>`;
  q('.dev-proxy').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Proxy diagram">${g}</svg>`;
  q('.viz-result').innerHTML=`<strong>Hop ${h}.</strong> ${esc(k.hops[h-1][2])}<table class="viz-table"><tbody>${k.see.map(([w,t])=>`<tr><th>${esc(w)}</th><td>${esc(t)}</td></tr>`).join('')}</tbody></table>`;};
 el.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',draw));draw();
}

const widgets={'dev-url':urlWidget,'dev-layers':layersWidget,'dev-tcp':tcpWidget,'dev-proxy':proxyWidget};
document.querySelectorAll('.explainer[data-explainer]').forEach(el=>widgets[el.dataset.explainer]?.(el));

// Static diagrams (no controls). Drawn as SVG so colors follow the light and dark themes.
const D={
 box:(x,y,w,h,title,sub,cls='')=>`<g class="dg-box ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text class="t" x="${x+w/2}" y="${y+(sub?h/2-3:h/2+5)}" text-anchor="middle">${esc(title)}</text>${sub?`<text class="s" x="${x+w/2}" y="${y+h/2+14}" text-anchor="middle">${esc(sub)}</text>`:''}</g>`,
 arrow:(x1,y1,x2,y2,label,lx,ly)=>`<line class="dg-arrow" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#dg-head)"/>${label?`<text class="dg-label" x="${lx??(x1+x2)/2}" y="${ly??((y1+y2)/2-7)}" text-anchor="middle">${esc(label)}</text>`:''}`,
 zone:(x,y,w,h,label)=>`<g class="dg-zone"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><text x="${x+12}" y="${y+20}">${esc(label)}</text></g>`,
 svg:(w,h,body,label)=>`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><defs><marker id="dg-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="dg-head"/></marker></defs>${body}</svg>`};
const diagrams={
 packet(){const L=[['ip','IP header','src 192.168.0.5 → dst 203.0.113.10','which computer'],['tcp','TCP header','src port 52341 → dst port 443, seq 1001','which program, which byte'],['tls','TLS record','encrypted with the session key','unreadable in transit'],['http','HTTP message','GET /posts/3 HTTP/1.1  Host: shop.com','what the application reads']];
  let g='';L.forEach(([k,t,s,why],i)=>{const x=10+i*22,y=10+i*58,w=460-i*44,h=250-i*58;g+=`<g class="dg-layer ${k}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/><text class="t" x="${x+14}" y="${y+22}">${t}</text><text class="s" x="${x+14}" y="${y+40}">${esc(s)}</text><text class="why" x="${x+w-14}" y="${y+22}" text-anchor="end">${why}</text></g>`});
  return D.svg(480,270,g,'Nested packet: IP header wraps TCP header, which wraps a TLS record containing the HTTP message');},
 flow(){const S=[['1','DNS lookup','naver.com → 223.130.200.104'],['2','TCP handshake','SYN, SYN+ACK, ACK on port 443'],['3','TLS handshake','check certificate, agree on session key'],['4','HTTP request and response','encrypted with the session key']];
  let g='';S.forEach(([n,t,s],i)=>{const y=8+i*70;g+=`<circle class="dg-step" cx="30" cy="${y+26}" r="15"/><text class="dg-stepn" x="30" y="${y+31}" text-anchor="middle">${n}</text>`+D.box(60,y,400,52,t,s);if(i<3)g+=D.arrow(30,y+43,30,y+79)});
  return D.svg(470,280,g,'Four stages: DNS lookup, TCP handshake, TLS handshake, encrypted HTTP');},
 nginx(){let g=D.zone(150,8,326,256,'server machine shop.com');
  g+=D.box(10,104,110,52,'Internet','user requests');
  g+=D.box(168,30,128,52,'Operating system','reads TCP port','os');
  g+=D.box(168,170,128,52,'nginx','listens on 443','hl');
  g+=D.box(350,120,116,52,'Spring app','listens on 8080');
  g+=D.box(350,200,116,52,'Files on disk','/images/...');
  g+=D.arrow(120,124,168,64,'port 443',128,82)+D.arrow(232,82,232,168);
  g+=`<text class="dg-label" x="240" y="118">hands data to the</text><text class="dg-label" x="240" y="132">program on 443</text>`;
  g+=D.arrow(296,186,348,148,'/api/...',318,158)+D.arrow(296,208,348,226,'/images/...',318,236);
  return D.svg(480,272,g,'Internet traffic on port 443 goes through the operating system to nginx, which routes /api to Spring on 8080 and /images to files');},
 forward(){let g=D.zone(6,8,250,232,'company network');
  [0,1,2].forEach(i=>{g+=D.box(20,36+i*66,100,48,'Employee PC',`10.0.0.${5+i}`);g+=D.arrow(120,60+i*66,158,112+i*16)});
  g+=D.box(160,100,86,56,'Forward','proxy','hl');
  g+=D.arrow(246,120,316,88)+D.arrow(246,136,316,168);
  g+=D.box(318,64,152,48,'shop.com','internet server')+D.box(318,144,152,48,'news.com','internet server');
  g+=`<text class="dg-note" x="130" y="232" text-anchor="middle">hidden: which employee asked</text><text class="dg-note" x="394" y="218" text-anchor="middle">both see requests from</text><text class="dg-note" x="394" y="233" text-anchor="middle">198.51.100.7 (the proxy)</text>`;
  return D.svg(480,248,g,'Forward proxy: employee PCs inside the company network send requests through the proxy, so internet servers see only the proxy address');},
 reverse(){let g=D.zone(224,8,250,232,'shop.com servers');
  [0,1,2].forEach(i=>{g+=D.box(8,36+i*66,104,48,'User',`browser ${i+1}`);g+=D.arrow(112,60+i*66,236,112+i*16)});
  g+=D.box(238,100,86,56,'nginx','reverse proxy','hl');
  [0,1,2].forEach(i=>{g+=D.arrow(324,112+i*16,358,60+i*66);g+=D.box(360,36+i*66,104,48,'Spring',`:${8080+i}`)});
  g+=`<text class="dg-label" x="174" y="40" text-anchor="middle">all connect to</text><text class="dg-label" x="174" y="54" text-anchor="middle">shop.com:443</text><text class="dg-note" x="112" y="232" text-anchor="middle">users see only shop.com</text><text class="dg-note" x="412" y="232" text-anchor="middle">hidden: servers and ports</text>`;
  return D.svg(480,248,g,'Reverse proxy: users connect to nginx at shop.com:443, which forwards to several hidden Spring servers');}};
document.querySelectorAll('[data-diagram]').forEach(el=>{const f=diagrams[el.dataset.diagram];if(f)el.innerHTML=f()});
