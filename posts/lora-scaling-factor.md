---
title: "What the LoRA Scaling Factor Scales"
date: "2026-11-12"
category: "Language Models"
description: "Why LoRA multiplies its update by alpha over r, what rank means for B and A, and why each entry of BA is a sum of r terms."
draft: false
---

A common slide on Low-Rank Adaptation shows two lines: **Scale factor: \(\alpha / r\)** and **\(\Delta W = BA\)**. The caption beneath it says that dividing by the rank keeps the size of the update roughly stable. This article unpacks what is being scaled, what the rank \(r\) is, and what "size" means in that sentence.

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

When \(r=2\), as in the slide:

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
