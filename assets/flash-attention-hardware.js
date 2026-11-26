(() => {
  'use strict';
  // Each frame is a dependency, not a clock sample. Read/write frames group many transfers.
  const paths = {
    standard: [
      ['read','Q, K','Fetch the operands','Q, K tiles','The dot products cannot start until the query and key tiles reach the SM.'],
      ['math','','Compute scores','score tile','The cores form a tile of scaled dot products. The next kernel cannot inherit this local tile.'],
      ['write','S','Write the scores','score tile','Across all tiles this write materializes S, an N × N score matrix in HBM.',1],
      ['read','S','Read the scores back','score tile','Softmax needs those same scores. Its arithmetic depends on this read.',1],
      ['math','','Normalize rows','weights','Softmax converts each row of scores into probabilities.'],
      ['write','P','Write the probabilities','weights','The separated softmax kernel writes a second N × N intermediate, P.',1],
      ['read','P, V','Fetch weights and values','P, V tiles','The final multiply needs V and must reread the probabilities that just left the chip.',1],
      ['math','','Combine values','output tile','The cores multiply probabilities by values and sum to form an output tile.'],
      ['write','O','Store the output','output tile','S and P each crossed the link twice. These four intermediate passes move bytes without adding arithmetic.']
    ],
    fused: [
      ['read','Q, K, V','Fetch input tiles','Q, K, V tiles','Bring a small working set into the SM. This path groups the input reads.'],
      ['math','','Compute local scores','score tile','Compute the same scaled dot products, but keep the score tile on chip for the next operation.'],
      ['math','','Update the online softmax','row statistics','Update the running row maximum and weight sum, rescaling earlier contributions as needed. No full S travels to HBM.'],
      ['math','','Accumulate weighted values','accumulator','Use the local weights with V to update the numerator. No full P is stored. Repeat for the remaining key/value tiles.'],
      ['math','','Normalize the output','output tile','After the final tile, divide the accumulated numerator by the row weight sum.'],
      ['write','O','Store the output','output tile','The output still goes to HBM. Fusion removes the full S and P round trips, not every transfer.']
    ]
  };
  const square = (tag, count) => `<${tag}></${tag}>`.repeat(count);
  const states = {math:'Working',read:'Waiting for data',write:'Writing data'};
  function mount(root) {
    if (root.classList.contains('fah')) return;
    root.classList.add('fah');
    root.innerHTML = `<div class="viz-heading"><h3>Follow the bytes across a GPU package</h3></div>
      <p>When moving operands takes longer than doing the math, memory bandwidth sets the pace. Follow one chain of dependent operations to see which transfers fusion removes.</p>
      <div class="fah-modes" role="group" aria-label="Attention implementation"><button type="button" data-mode="standard">Standard: separated</button><button type="button" data-mode="fused">FlashAttention: fused</button></div>
      <div class="fah-package"><div class="fah-package-head"><strong>GPU package</strong><span>A100 / 40 GB</span></div>
        <div class="fah-devices"><div class="fah-die"><strong>Compute die</strong><div class="fah-array" aria-label="A grid of streaming multiprocessors; one highlighted"><i>SM</i>${square('i',5)}</div></div>
          <div class="fah-bridge"><span class="fah-cargo"></span><div class="fah-bus" aria-hidden="true"><i></i><i></i><i></i></div><span class="fah-direction"></span></div>
          <div class="fah-hbm"><strong>HBM</strong><span>40 GB</span><div class="fah-banks" aria-hidden="true">${square('i',5)}</div></div></div>
      </div>
      <div class="fah-leader" aria-hidden="true"></div>
      <div class="fah-zoom"><div class="fah-zoom-head"><span class="fah-square"></span><strong>One SM, magnified</strong></div>
        <div class="fah-inside"><div class="fah-sram"><strong>On-chip SRAM</strong><small>L1 + shared: 192 KB/SM</small><span class="fah-tiles" aria-hidden="true">${square('i',6)}</span></div>
        <div class="fah-local" aria-hidden="true">⇄</div><div class="fah-cores"><strong>Arithmetic cores</strong><small class="fah-state"></small><div class="fah-core-grid" aria-hidden="true">${square('i',8)}</div></div></div>
        <div class="fah-set">Local working set: <strong></strong></div></div>
      <div class="fah-playback" role="group" aria-label="Process playback"><button type="button" data-act="play">Play</button><button type="button" data-act="back">Back</button><button type="button" data-act="next">Next</button><button type="button" data-act="restart">Restart</button><span class="fah-position"></span></div>
      <div class="fah-step" aria-live="polite" aria-atomic="true"><strong></strong><span></span></div>
      <div class="fah-trace"><div class="fah-trace-head"><strong>Dependency timeline</strong><span>One segment per step</span></div><div class="fah-strip" aria-hidden="true"></div>
      <div class="fah-key">${Object.entries(states).map(([key,s])=>`<span data-kind="${key}">${s}</span>`).join('')}</div>
      <div class="fah-stat">S/P passes across the link: <b></b></div></div>
      <div class="fah-note">Schematic, not measured timing or GPU utilization. Counts cover only the pictured full-intermediate passes, not total kernel traffic. Actual reads, writes, and arithmetic can overlap.</div>
      <div class="fah-note">Shared memory is software-managed; L1 is a cache. Operands and accumulators also use registers, not shown. Placement and SM count are schematic.</div>`;
    const $ = s => root.querySelector(s);
    const stepTitle = $('.fah-step strong'), stepBody = $('.fah-step span'), bus = $('.fah-cargo'), direction = $('.fah-direction'), compute = $('.fah-state'), workingSet = $('.fah-set strong'), count = $('.fah-stat b'), strip = $('.fah-strip'), position = $('.fah-position');
    const play = $('[data-act="play"]'), back = $('[data-act="back"]'), next = $('[data-act="next"]');
    const modeButtons = Array.from(root.querySelectorAll('[data-mode]'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let mode = 'standard', index = 0, timer = null;
    function stop() { clearTimeout(timer); timer = null; root.dataset.playing = 'false'; play.textContent = 'Play'; }
    function paint() {
      const frames = paths[mode], [kind,cargo,title,set,body] = frames[index];
      root.dataset.kind = kind;
      modeButtons.forEach(b => b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
      back.disabled = index===0; next.disabled = index===frames.length-1;
      position.textContent = `${index+1} / ${frames.length}`;
      bus.textContent = cargo || 'Idle'; direction.textContent = {read:'← Read',write:'Write →',math:'No trip'}[kind];
      compute.textContent = kind==='write' ? 'Result in transit' : states[kind]; workingSet.textContent = set;
      stepTitle.textContent = title; stepBody.textContent = body;
      strip.innerHTML = frames.map(([type],i)=>`<i data-kind="${type}"${i===index?' class="fah-current"':''}></i>`).join('');
      count.textContent = mode==='standard' ? `${frames.slice(0,index+1).reduce((n,f)=>n+(f[5]||0),0)} of 4` : '0 (kept on chip)';
    }
    function start() {
      if(index===paths[mode].length-1) index=0;
      root.dataset.playing='true'; play.textContent='Pause'; paint();
      const tick = () => { index++; paint(); if(index===paths[mode].length-1) stop(); else timer=setTimeout(tick,2600); };
      timer=setTimeout(tick,2600);
    }
    root.addEventListener('click',e=>{
      const b=e.target.closest('button'); if(!b || !root.contains(b)) return;
      if(b.dataset.act==='play') { if(timer===null) start(); else stop(); return; }
      stop();
      if(b.dataset.mode) {mode=b.dataset.mode; index=0;}
      else if(b.dataset.act==='back') index=Math.max(0,index-1);
      else if(b.dataset.act==='next') index=Math.min(paths[mode].length-1,index+1);
      else index=0;
      paint();
    });
    if('IntersectionObserver' in window) new IntersectionObserver(entries=>{if(!entries[0].isIntersecting) stop();}).observe(root);
    document.addEventListener('visibilitychange',()=>{if(document.hidden) stop();});
    reduce.addEventListener?.('change',stop);
    stop(); paint();
  }
  const init=()=>document.querySelectorAll('.explainer[data-explainer="fa-hardware"]').forEach(mount);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
