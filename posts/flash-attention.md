---
title: "FlashAttention: Why Moving Less Data Can Beat Doing Less Math"
date: "2026-11-26"
category: "Language Models"
description: "Original paper figures and playable GPU-memory animations explain the bottleneck, tiling, online softmax, and recomputation."
draft: false
---

Linformer compresses the sequence dimension with low-rank projections. Longformer uses local windows and selected global connections. Both pursue a natural idea: **make attention cheaper by computing less of it**.

But fewer operations do not guarantee a faster GPU program. Memory transfers and hardware utilization also matter. These methods are not failures; approximate methods can win at longer sequence lengths. FlashAttention asks a different question:

> Can the same dense attention run faster by moving less data, even if training requires more arithmetic?

Start with the paper's measured runtime. Then play the memory-flow animations: **what crosses the HBM boundary, and what stays on chip?**

<figure class="fa-paper">
<h3 class="fa-paper-title">The expensive part is not just matrix multiplication</h3>
<a class="fa-paper-image" href="https://arxiv.org/pdf/2205.14135v2#page=2" target="_blank" rel="noopener"><img src="/assets/papers/flashattention/figure1-runtime.png" width="970" height="1020" alt="Original Figure 1 runtime breakdown: PyTorch spends much of its GPT-2 attention time on masking, softmax and dropout between two matrix multiplications; FlashAttention uses a much shorter fused kernel." loading="eager"></a>
<div class="fa-paper-reading"><p><b>Read the tall bar</b>Mask, softmax and dropout occupy much of the time, although they do less arithmetic than the matrix multiplications.</p><p><b>Ask what each stage moves</b>Separate stages read and write large arrays. Low arithmetic per transferred byte makes memory traffic expensive.</p></div>
<figcaption><strong>Original Figure 1, right panel.</strong> Dao et al., FlashAttention (2022), PDF p. 2. Cropped from the source, not redrawn. The paper reports 7.6× attention speedup here, not 7.6× whole-model training speedup. Stage duration includes computation and memory effects; it is not a direct measurement of idle time. <a href="https://arxiv.org/pdf/2205.14135v2#page=2">Read the original figure and caption.</a></figcaption>
</figure>

## 1. A large warehouse and a small workbench

**Memory stores numbers. Compute units perform arithmetic.** A large store holds all the materials; a small nearby working area makes repeated use cheaper.

On a CPU, RAM holds working data and a cache keeps nearby copies. On a GPU, HBM is large DRAM-based device memory. SRAM is the technology behind small on-chip stores, including shared memory and caches.

<div class="explainer" data-explainer="fa-hardware"></div>

**SRAM does not mean cache.** A cache is mostly managed automatically; shared memory is explicitly managed by the kernel. Registers hold live operands and accumulators. Local storage belongs to individual SMs, not one enormous shared workbench. The diagram omits cache layers.

Capacity is how much fits. Bandwidth is bytes moved per second. A memory-bound stage does little arithmetic for each byte it must move: faster arithmetic cannot remove that transfer cost. The animation illustrates this dependency, not measured GPU utilization or exact timing.

## 2. Where the ordinary implementation spends its trips

For one head, the familiar computation is:

```math
S=QK^\top/\sqrt d,\qquad P=\operatorname{softmax}(S),\qquad O=PV.
```

S and P are \(N\times N\); O is \(N\times d\). A separated implementation writes S to HBM, reads it for softmax, writes P, then reads P for the multiplication by V.

<div class="explainer" data-explainer="fa-traffic"></div>

A single FP16 score matrix at \(N=4096\) occupies **32 MiB per head and batch element**. Repeatedly moving that intermediate can cost more than its arithmetic. Modern attention APIs may already select a fused implementation; this diagram compares against the separated baseline.

## 3. Tiling: use the intermediate before it leaves

Bring in Q/K/V blocks that fit locally. Compute a small score tile, consume it into the output summary, then discard it. Reuse the freed space for the next tile.

<figure class="fa-paper">
<h3 class="fa-paper-title">The paper's loop, before pressing Play</h3>
<a class="fa-paper-image" href="https://arxiv.org/pdf/2205.14135v2#page=2" target="_blank" rel="noopener"><img src="/assets/papers/flashattention/figure1-tiling.png" width="900" height="880" alt="Original FlashAttention tiling diagram: red outer-loop arrows move through K and V blocks; blue inner-loop arrows visit Q and output blocks; the full score matrix remains unmaterialized." loading="lazy"></a>
<figcaption><strong>Original Figure 1, center panel.</strong> Red: one K/V block remains local while blue visits each Q block. The dotted score matrix is not stored in HBM. Dao et al. (2022), PDF p. 2. <a href="https://arxiv.org/pdf/2205.14135v2#page=2">Source and full caption.</a></figcaption>
<details><summary>View all three original Figure 1 panels</summary><img src="/assets/papers/flashattention/figure1-full.png" width="1720" height="680" alt="Complete original Figure 1 with memory hierarchy, tiled attention diagram, and GPT-2 runtime breakdown." loading="lazy"><p>The memory pyramid shows aggregate GPU SRAM figures, not one SM's capacity. The physical animation labels per-SM resources separately.</p></details>
</figure>

<div class="explainer" data-explainer="fa-original-loop"></div>

The key is not merely slicing a matrix. It is keeping **score calculation, softmax updates, and multiplication by V together**, without writing the full S or P to HBM.

The animation follows the original loop order: **K/V outside, Q inside**. Each visit reads and rewrites that Q block's partial output and row statistics. Watch the output blocks become complete only after all three K/V blocks. The progress fill means processed blocks, not the magnitude of the answer. Larger tiles must still fit local memory and register budgets.

But softmax needs the whole row's denominator. How can one tile be finished before the next arrives?

## 4. Two divisions: make the numbers smaller, then make probabilities

Attention mixes values V according to scores computed from Q and K. Softmax turns those scores into probabilities: exponentiate each score, then divide by the sum.

Suppose the scores are \([0,\ln2,\ln4,\ln8]\). Exponentiating gives **weights \([1,2,4,8]\)**. These are not probabilities yet: they add up to 15, not 1.

### Divide by the sum to get probabilities

Dividing each weight by 15 gives:

```math
[1/15,\;2/15,\;4/15,\;8/15].
```

These add up to 1. A value with twice the weight contributes twice as much to the output.

But an implementation also needs to keep the numbers from getting too large. Exponentials grow quickly enough to overflow. That is the reason for a different division.

### Divide by the largest weight to make the numbers smaller

The largest weight here is 8. Divide every weight by 8:

```math
[1,2,4,8]\quad\longrightarrow\quad[1/8,2/8,4/8,1].
```

The largest number is now 1, but the ratio is still **1:2:4:8**. These smaller weights still are not probabilities: their sum is \(15/8=1.875\), not 1.

Now divide by their sum. For the second weight:

```math
\frac{2/8}{15/8}=\frac{2}{15}.
```

The 8 cancels. Shrinking all weights by the same factor does not change the final probabilities.

<div class="explainer" data-explainer="fa-normalize" data-mode="0"></div>

**Divide by the largest weight to control the size of the numbers. Divide by the sum of weights to turn them into probabilities.** These are different operations with different jobs.

### Why the code subtracts a maximum instead

Computing a huge exponential and only then dividing would be too late to prevent overflow. Instead, subtract the maximum **score** m before exponentiating:

```math
e^{s_j-m}=\frac{e^{s_j}}{e^m}.
```

Because m is the largest score, \(e^m\) is the largest weight. **Subtracting the maximum score before exponentiating is equivalent to dividing the exponentiated weights by the largest weight.** It just avoids creating the huge numbers in the first place.

## 5. Make the weighted sum first; divide at the end

Take weights **[1, 2]** and values **[10, 20]**. Here each V is a single number to keep the example small.

The usual description first turns the weights into probabilities, then multiplies by V:

```math
O=\frac{1}{3}\times10+\frac{2}{3}\times20.
```

Both fractions have the same denominator. So multiply and add the numerators first, then divide just once:

```math
O=\frac{1\times10+2\times20}{1+2}=\frac{50}{3}.
```

This is ordinary addition of fractions. The denominator stays 3; it does not become 6.

Only two totals are needed:

- **Numerator:** add up weight × V. Here it is 50.
- **Denominator:** add up the weights. Here it is 3.

As more values arrive, add their contributions to the two totals. Divide only after all values have been processed. **There is no need to finish and store every individual probability.**

The size-control step from Section 4 does not change this. Divide both weights by their maximum, 2, and use [0.5, 1]:

```math
O=\frac{0.5\times10+1\times20}{0.5+1}
=\frac{25}{1.5}=\frac{50}{3}.
```

The numerator and denominator shrink together, so their ratio stays the same.

For the next section, call the numerator **u** and the denominator **ℓ** (lowercase ell). Then the final output is simply **O = u / ℓ**. When V is a vector, u is a vector too; every component is divided by the same scalar ℓ.

## 6. What if the next block contains a larger weight?

Now read the data in two blocks rather than all at once:

- **Block A:** original weights [1, 2], values [10, 20].
- **Block B:** original weights [4, 8], values [30, 40].

“Original weights” means the exponentials before size control, used here only to explain the arithmetic. The implementation still subtracts the maximum score before exponentiating.

### First, process A using the largest weight seen so far

After reading only A, the largest weight is 2. Divide by 2 to get [0.5, 1]. This is exactly the calculation from Section 5:

```math
\ell=0.5+1=1.5,\qquad u=0.5\times10+1\times20=25.
```

Keep the maximum score \(m=\ln2\) and these two totals. The individual scores and weights from A can now be discarded.

### B changes the scale: the largest weight is now 8

B arrives with weights [4, 8]. The new largest weight is 8, so B will be calculated using weights divided by 8.

But A's totals were calculated using weights divided by 2. **Do not add totals calculated on different scales.** First make A's totals look as if its weights had been divided by 8 all along.

A has already been divided by 2. Multiplying by **2/8 = 1/4** finishes the adjustment:

| Block A | Old scale: divide by 2 | New scale: divide by 8 |
| --- | ---: | ---: |
| First weight | 0.5 | 0.125 |
| Second weight | 1 | 0.25 |
| Denominator ℓ | 1.5 | 0.375 |
| Numerator u | 25 | 6.25 |

Every row on the right is the corresponding row on the left multiplied by 1/4.

**The kernel does not need to recover the individual old weights. It multiplies the two saved totals by 1/4 directly.** Multiplying every term by the same factor and then adding is equivalent to multiplying the sum by that factor.

This adjustment alone does not change A's weighted average: \(25/1.5=6.25/0.375\). It only changes the scale used to represent it.

### Now add B on the same scale

Divide B's original weights [4, 8] by 8 to get [0.5, 1]. B contributes:

```math
\text{denominator: }0.5+1=1.5,
\qquad
\text{numerator: }0.5\times30+1\times40=55.
```

Add those contributions to A's adjusted totals:

```math
\ell=0.375+1.5=1.875,\qquad u=6.25+55=61.25.
```

All blocks have now been processed. Finally divide:

```math
O=\frac{61.25}{1.875}=32.6667\ldots
```

<div class="explainer" data-explainer="fa-online" data-mode="1"></div>

The animation's first two bars represent A. They shrink together when the maximum changes; only then are B's contributions added. The old bars explain the arithmetic, not an array that the kernel keeps in memory.

As a check, processing everything at once gives the same answer:

```math
\frac{1\times10+2\times20+4\times30+8\times40}{1+2+4+8}
=\frac{490}{15}=32.6667\ldots
```

### This is what “online” means

“Online” means processing incoming blocks while updating a running summary. It has nothing to do with an internet connection. Each query row remembers just:

1. **m:** the largest score seen so far, which determines the current scale.
2. **ℓ:** the sum of weights on that scale.
3. **u:** the sum of weight × V on that scale.

If a new block raises the maximum, shrink the old totals to the new scale before adding the block. If the maximum does not increase, no adjustment is needed. Divide u by ℓ after the last block.

**Do not apply softmax independently to each block and average the results.** That would give every block a probability total of 1 and lose their relative importance. Online softmax maintains one shared scale and one denominator for the entire row.

<details>
<summary>The same update in symbols</summary>

The new maximum is m′. The scale adjustment is the old largest weight divided by the new largest weight:

```math
m'=\max(m,\max s_{\mathrm{new}}),\qquad
\alpha=\frac{e^m}{e^{m'}}=e^{m-m'}.
```

Adjust the old totals, then add the new block:

```math
\ell'=\alpha\ell+\sum_{j\in\mathrm{new}}e^{s_j-m'},
\qquad
u'=\alpha u+\sum_{j\in\mathrm{new}}e^{s_j-m'}V_j.
```

Initialize from the first valid block and return u/ℓ after the last. These equations omit dropout and assume finite valid scores. Masked blocks require appropriate handling. With dropout, the denominator uses undropped weights; numerator contributions use the dropout mask and its scaling. Implementations can maintain an equivalent normalized output accumulator instead of u.

</details>

## 7. Need the probabilities again? Recompute just the piece being used

So far, the output has been computed without saving every probability. That completes the **forward pass**. Training also needs a **backward pass**, which calculates gradients: how changes in the inputs affect the loss.

### Why backward needs the probabilities

Suppose:

```math
O=0.25V_1+0.75V_2.
```

Holding the weights fixed, increasing V₁ by 1 increases O by 0.25. Increasing V₂ by 1 increases O by 0.75. Those probabilities tell backward how strongly each V contributes.

If the gradient arriving at O is g, the gradients for these values are \(0.25g\) and \(0.75g\). **Backward needs the mixing weights again.** This is the V-gradient example; the full backward pass also computes Q and K gradients.

A conventional implementation saves the probability matrix P during forward and reads it during backward. For N tokens, P has N × N entries per head and batch element. Saving and reading it moves a lot of data.

### Discarding a probability does not make it impossible to recover

Q and K can produce its score again. The final maximum score m and weight sum ℓ from forward turn that score back into the same probability:

```math
P_j=\frac{e^{s_j-m}}{\ell}.
```

Use the numbers from Section 6. The final largest weight was 8, and the final denominator was 1.875. To recover the probability for the item whose original weight was 2:

```math
P_j=\frac{2/8}{1.875}=\frac{2}{15}.
```

There is no need to recover the entire matrix. Read the required Q/K blocks, recompute a small score tile, recover its probabilities, use them for gradients, then discard the tile.

**The saved denominator describes the entire query row, not just the current tile.** That is why the recovered probabilities match the original full-row softmax. Normalizing only within the current tile would give different probabilities.

<div class="explainer" data-explainer="fa-recompute"></div>

The diagram's saved statistic L is just a compact way to encode the same normalization: \(L=m+\log\ell\), so \(P_j=e^{s_j-L}\). Original FlashAttention saves m and ℓ; either representation contains the information needed here. The required inputs and output are also retained for backward.

### Why extra calculation can be faster

The choice is not “do the same work” versus “do less work.” It is:

- **Save and read:** move the large probability matrix to memory and back.
- **Recompute:** do some extra arithmetic to recreate only the small tile currently needed.

On a GPU, moving a large array can cost more time than repeating those calculations. Recomputing wins when that extra arithmetic costs less than the memory traffic it replaces.

Q/K blocks are still read, and gradients are still written. Dropout also requires consistently regenerated masks. The saving is not zero memory traffic: it is avoiding the huge saved P matrix.

**Section 5 keeps totals instead of individual probabilities. Section 6 updates those totals one block at a time. Section 7 recreates discarded probabilities only when backward needs them.** All three serve the same goal: move less intermediate data.

## 8. More arithmetic, less time

The paper's A100 experiment increases arithmetic but sharply reduces memory traffic. Switch metrics to see why FLOPs alone tell the wrong story.

<div class="explainer" data-explainer="fa-benchmark"></div>

The attention comparison is Figure 2's forward-plus-backward benchmark, not a whole-model benchmark. Table 2's training times use different baselines and report the same perplexity. **Traffic in GB is not peak allocated memory, and these results do not promise a universal tenfold speedup over modern kernels.**

Three boundaries remain:

- **Dense arithmetic is still quadratic.** Less intermediate storage is not linear-time attention.
- **Exact is not bitwise identical.** Floating-point reduction order changes.
- **Hardware and workload matter.** Tile sizes, masks, precision, head dimension, and sequence length affect the result. Approximate methods remain useful.

Tiling keeps intermediates local. Online softmax keeps only the needed summary. Recomputation extends that saving to backward. **The central optimization is the lifetime and location of data, not skipping the dense attention function.**

## References

- [FlashAttention](https://arxiv.org/abs/2205.14135), 2022: Sections 2–3, Figure 2, Table 2, Appendix B.
- [Linformer](https://arxiv.org/abs/2006.04768) and [Longformer](https://arxiv.org/abs/2004.05150), 2020.
- [NVIDIA Ampere Tuning Guide](https://docs.nvidia.com/cuda/ampere-tuning-guide/index.html): memory hierarchy and shared-memory limits.
- [CODER X DOX's FlashAttention discussion](https://www.youtube.com/watch?v=vL0d9in1Y-I): the video motivating this explanation.
