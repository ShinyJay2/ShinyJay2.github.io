---
title: "LoRA"
date: "2026-11-12"
category: "Language Models"
description: "Low-rank adaptation from the ground up: what B and A are, what the alpha over r scaling does, and why the update behaves like a local key-value memory."
draft: false
---

## What LoRA is

Fine-tuning changes a pretrained weight matrix \(W_0\) into \(W_0 + \Delta W\). In full fine-tuning, \(\Delta W\) has exactly the same shape as \(W_0\), so every one of its entries is trained. For a \(4096 \times 4096\) layer that is \(16{,}777{,}216\) trainable numbers for a single matrix, together with their gradients and optimizer states.

**LoRA (Low-Rank Adaptation)** keeps \(W_0\) frozen and does not learn \(\Delta W\) directly. It learns two small matrices whose product plays the role of the update:

```math
\Delta W = BA,\qquad B \in \mathbb{R}^{d \times r},\quad A \in \mathbb{R}^{r \times k},\quad r \ll \min(d, k)
```

In the layer's forward pass, the frozen path and the learned path are added:

```math
y = W_0 x + \Delta W x = W_0 x + BAx
```

<div class="explainer" data-explainer="lora-diagram"></div>

\(B\) is tall and skinny, \(A\) is short and wide, and their product has the same \(d \times k\) shape as \(W_0\). With \(d = k = 4096\) and \(r = 8\), the trainable count is \(4096 \times 8 + 8 \times 4096 = 65{,}536\), about \(0.39\%\) of the full matrix.

In the [original LoRA paper](https://arxiv.org/abs/2106.09685), \(B\) is initialized to zero, so \(\Delta W = 0\) at the start and training begins exactly from the pretrained model. After training, \(BA\) can be added into \(W_0\), so the adapted layer runs as a single matrix with no extra inference cost. Keeping \(BA\) separate instead allows one frozen base model to be shared by many small task-specific adapters.

The rest of this article goes through the pieces of this update one at a time: the scaling factor applied to it, what the rank \(r\) means, and how the update can be read as a set of keys and values.

## What the scaling factor scales

The scaling factor does not scale the original weight \(W_0\). It scales the correction \(BA\) that LoRA learns. The weight that is actually applied is:

```math
W_{\text{applied}} = W_0 + \underbrace{\frac{\alpha}{r}}_{\text{strength of the correction}}\underbrace{BA}_{\text{learned correction}}
```

In other words, it is a **volume knob for how strongly the newly learned correction is applied to the original model**. It does not change the size or dimensions of any matrix. It multiplies **every entry of \(BA\) by the same number**.

For example, with \(r=8\) and \(\alpha=16\):

- the scaling factor is \(2\);
- if one entry of \(BA\) is \(0.03\), then \(0.06\) is added to the original weight.

**The reason for dividing by \(r\)** is that each entry of \(BA\) is formed by adding \(r\) terms:

```math
(BA)_{ij}=\sum_{k=1}^{r}B_{ik}A_{kj}
```

The design is meant to soften the way the size of the correction changes along with the rank when the rank is increased. The phrase "keeps the size roughly stable" is an intuitive description, not a guarantee that the size stays exactly constant.

In short, **\(r\) is the capacity available to express the correction, and \(\alpha / r\) is the strength with which that correction is applied**.

## What the rank r is

\(r\) is the rank chosen for LoRA. Strictly speaking, it is a setting that makes the rank of \(BA\) **at most \(r\)**.

When \(r=2\):

- **B has 2 columns**: two tall vertical strips;
- **A has 2 rows**: two long horizontal strips.

For example, if the original weight is \(3\times3\):

```math
B=
\begin{pmatrix}
1&2\\
3&4\\
5&6
\end{pmatrix},
\quad
A=
\begin{pmatrix}
10&20&30\\
40&50&60
\end{pmatrix}
```

Their product \(BA\) is \(3\times3\), the same shape as the original weight.

## Why each entry is a sum of r terms

In matrix multiplication, **one cell of the result is computed by pairing one row of B with one column of A, multiplying the pairs, and adding them**.

For example, the top-left cell of \(BA\) above is:

```math
\underbrace{1\times10}_{\text{first term}}
+
\underbrace{2\times40}_{\text{second term}}
=90
```

**Two numbers are taken across a row of B and two numbers down a column of A, so there are two terms to multiply and add.**

If \(r=3\), computing that same cell requires:

```math
B_{i1}A_{1j}+B_{i2}A_{2j}+B_{i3}A_{3j}
```

That is **3 terms**. The shape of the result is still \(3\times3\).

<div class="explainer" data-explainer="lora-sum"></div>

## Why the size of the update changes with r

Here **size does not mean the width and height of the matrix. It means how large the numbers inside it are.**

As a very simple case, suppose every term being added equals \(0.1\):

- \(r=2\): \(0.1+0.1=0.2\)
- \(r=4\): \(0.1+0.1+0.1+0.1=0.4\)

The rank was raised to increase expressive capacity, but **because there are more terms to add, the correction applied to the original weights can also grow**.

In this example, dividing by \(r\) gives \(0.1\) in both cases. Multiplying by \(\alpha\) then sets the strength to the desired level. That is \(\alpha / r\).

However, **in practice the terms mix positive and negative values, and their values change during training, so doubling the rank does not necessarily double the correction.** This is why the effect is described as softening the influence of the rank, not as an exact guarantee on the size.

<div class="explainer" data-explainer="lora-scale"></div>

## Reading BA as keys and values

Write the rows of \(A\) as \(a_1^\top, \dots, a_r^\top\) and the columns of \(B\) as \(b_1, \dots, b_r\). Then the correction \(BAx\) splits into one term per pair, \(BAx = \sum_k b_k\,(a_k^\top x)\):

<div class="explainer" data-explainer="lora-pairs"></div>

Each index \(k\) is one key-value pair:

- **\(a_k\) is a key.** \(a_k^\top x\) is a similarity score: large when \(x\) points along \(a_k\), near zero when it is perpendicular, negative when it points the other way. A key "responds" to an input when this score is large. The score is computed in every forward pass and needs no label or loss.
- **\(b_k\) is a value.** In a key-value store, the key is what an input is compared against and the value is what comes back. Here \(b_k\) is what comes back: a vector with the size of the output that gets added to it, with weight \(a_k^\top x\). The key decides *how much*, the value decides *what*. If \(W_0 x = (1.0, 2.0, 0.5)\), \(b_1 = (0.3, -0.1, 0.2)\), and the score is \(0.9\), the output becomes \((1.0, 2.0, 0.5) + 0.9\,b_1 = (1.27, 1.91, 0.68)\). With a score of \(0\), it stays \((1.0, 2.0, 0.5)\).

### The structure is there from the start; training gives it meaning

Nothing new was added to LoRA to get keys and values. They are the same \(BAx\), computed in two steps: first \(Ax\) scores the input against every key, then \(B\) adds every value in proportion to its score. So the key-value structure exists from the very first training step, not only after training.

What the structure holds changes during training:

1. **At the start, the values are empty.** \(B\) is initialized to zero, so every \(b_k\) is zero and nothing is added, whatever the scores are. The keys are the random rows of \(A\): they respond to inputs, but not to anything in particular.
2. **Training writes the values.** On inputs where a key scores high, gradient descent moves its value \(b_k\) toward the correction that lowers the loss on the training set.
3. **Training sharpens the keys.** Once \(b_k\) is useful, \(a_k\) moves toward the inputs on which adding \(b_k\) helped, so the key responds more strongly to them.
4. **After training, the pairs mean something.** Each key responds to a kind of input whose output needed correcting, and its value holds that correction.

The rank \(r\) is the number of these pairs: \(r\) keys and \(r\) values. A larger rank gives the adapter more slots, each able to hold a different correction for a different kind of input.

## Why this is called a local associative memory

**Memory** because \(A\) and \(B\) behave like a store that is written once and read many times. Training *writes* the pairs into the weights, where they stay fixed afterward. Inference *reads* from them: every input \(x\) acts as a cue. The layer does not pick a key; it scores the cue against every key and adds every value in proportion to its score, so the values of matching keys dominate.

**Associative** means retrieval by similarity rather than by exact address. A dictionary lookup fails unless the key matches exactly; here an input close to one key retrieves mostly that key's value, and an input between two keys retrieves a mixture.

**Local** means the correction only matters near the keys. An input unrelated to what the adapter was trained on scores low against every key, so almost nothing is added and the layer behaves like the frozen base model.

For example, if a general-purpose model is fine-tuned on medical literature, one key might come to respond to heart-related inputs while its value adds a cardiology-flavored correction, and a cooking-related user query would trigger almost nothing.

<div class="explainer" data-explainer="lora-lookup"></div>

## Training LoRA

### Starting from zero

At the first training step, the adapted model should behave exactly like the pretrained one. The correction \(\Delta y = BAx\) must therefore be zero for every input. If both \(B\) and \(A\) were drawn at random, \(\Delta y\) would generally not be zero: the adapter would change the model's outputs before learning anything, which can destabilize training and interfere with what the pretrained model already knows. Any correction should come from fine-tuning, not from random initialization.

Making \(\Delta y\) zero only requires one of the two matrices to be zero. Making both zero is not an option, because of how the gradients flow. Write \(z = Ax\) for the \(r\) scores and \(g\) for the gradient of the loss with respect to \(\Delta y\). Then

```math
\frac{\partial L}{\partial B} = g\, z^\top = g\,(Ax)^\top, \qquad \frac{\partial L}{\partial A} = B^\top g\, x^\top
```

- The gradient of \(B\) contains \(A\). If \(A = 0\), \(B\) gets no gradient.
- The gradient of \(A\) contains \(B\). If \(B = 0\), \(A\) gets no gradient.
- If both are zero, neither moves. The adapter never learns.

So exactly one matrix starts at zero and the other starts random. Either choice keeps \(\Delta y = 0\) at the start, and in either case only one matrix receives a gradient at the first step. After that step both are nonzero and both learn.

<div class="explainer" data-explainer="lora-init"></div>

### Why random A and zero B

LoRA normally uses random \(A\) and zero \(B\). The roles from the previous sections explain why. \(A\) is the feature extractor: it projects the input into the \(r\) low-rank features. \(B\) maps those features back to the output space as corrections.

- **Random \(A\), zero \(B\).** From the first step, \(A\) already produces \(r\) diverse, nonzero features for every input. \(B\)'s gradient \(g\,(Ax)^\top\) is immediately informative: it learns which correction to attach to each of those features. Once \(B\) moves away from zero, \(A\) starts learning too and refines the features.
- **Zero \(A\), random \(B\).** Every feature \(Ax\) starts at zero and only grows as \(A\) learns, step by step. Until then, \(B\) receives a weak and less diverse signal.

In key-value terms, random \(A\) starts with \(r\) keys that already respond to inputs in different ways, while zero \(B\) starts with empty values. Training only has to fill in what each key should retrieve. This is an intuition rather than a theorem; [an analysis of LoRA initialization](https://arxiv.org/abs/2406.08447) also reports that random \(A\) with zero \(B\) tolerates larger learning rates and tends to perform better than the reverse.

### Different learning rates for A and B

Because \(A\) and \(B\) play different roles, they need not share a learning rate. [LoRA+](https://arxiv.org/abs/2402.12354) gives \(B\) a larger learning rate than \(A\):

```math
\eta_B = \lambda\, \eta_A, \qquad \lambda > 1
```

The reason is a mismatch in scale. \(A\) maps a wide input down to a few dimensions, and \(B\) maps those few dimensions back up to the full output. With a single learning rate, \(B\) tends to be undertrained. Raising \(B\)'s learning rate keeps the two matrices learning at a matched pace, which speeds up fine-tuning and often improves the final result without adding any parameters.

## Source

These notes are based on [The Tiny Idea That Lets Anyone Fine-Tune AI](https://www.youtube.com/watch?v=U80tjcThl9Q) by Jia-Bin Huang.
