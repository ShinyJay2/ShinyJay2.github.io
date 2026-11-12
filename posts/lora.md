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

Write the rows of \(A\) as \(a_1^\top, \dots, a_r^\top\) and the columns of \(B\) as \(b_1, \dots, b_r\). The correction \(BAx\) can then be computed in two steps.

**Step 1: \(Ax\).** Each row of \(A\) takes a dot product with \(x\), giving \(r\) numbers. With \(a_1 = (1, 0, 0)\), \(a_2 = (0, 1, 0)\), and \(x = (0.9, 0.1, 0.3)\):

```math
Ax = \begin{pmatrix} a_1^\top x \\ a_2^\top x \end{pmatrix} = \begin{pmatrix} 0.9 \\ 0.1 \end{pmatrix}
```

**Step 2: \(B(Ax)\).** Multiplying \(B\) by these numbers adds up the columns of \(B\), each weighted by its number:

```math
BAx = 0.9\,b_1 + 0.1\,b_2 \qquad\text{in general}\qquad BAx = \sum_{k=1}^{r} b_k\,(a_k^\top x)
```

Each index \(k\) is one pair:

- **\(a_k\) is a key.** \(a_k^\top x\) is a similarity score: large when \(x\) points along \(a_k\), near zero when it is perpendicular, negative when it points the other way. A key "responds" to an input when this score is large. The score is computed in every forward pass, during training and after it, and needs no label or loss.
- **\(b_k\) is a value.** It is a fixed vector with the size of the output. The score only scales it, so each pair always pushes the output along the same direction, harder or softer, and a negative score subtracts it.

This is not extra machinery; it is the same \(BAx\) read in two steps. The structure exists from the first step of training. What training adds is meaning. \(B\) starts at zero, so every value is zero, and the random rows of \(A\) detect nothing in particular. Gradient descent then moves each \(b_k\) toward the correction that lowers the loss on inputs where \(a_k\) scores high, and moves each \(a_k\) toward inputs where adding \(b_k\) helped. After training, a key scores high on the kinds of inputs whose outputs needed correcting, and its value is that correction. The rank \(r\) is the number of such pairs.

## Why this is called a local associative memory

**Associative** means retrieval by similarity rather than by exact address. A dictionary lookup fails unless the key matches exactly; here every input is compared with every key, and each value is returned in proportion to its score. An input close to one key retrieves mostly that key's value, and an input between two keys retrieves a mixture.

**Local** means the correction only matters near the keys. An input unrelated to what the adapter was trained on tends to be nearly perpendicular to every key, so every score is small and the layer behaves almost exactly like the frozen base model.

For example, if a general-purpose model is fine-tuned on medical literature, one key might come to respond to heart-related inputs while its value adds a cardiology-flavored correction, and a cooking question would trigger almost nothing.

<div class="explainer" data-explainer="lora-kv"></div>

Three caveats keep this interpretation honest:

- Learned keys need not match human concepts; one key can respond to a mixture of features.
- Unrelated inputs give small scores, not exactly zero ones.
- \(x\) is the hidden vector entering the layer, not raw text, and the full correction is still scaled by \(\alpha / r\).
