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

The product \(BA\) can also be split the other way. Write the columns of \(B\) as \(b_1, \dots, b_r\) and the rows of \(A\) as \(a_1^\top, \dots, a_r^\top\). Then \(BA\) is a sum of \(r\) outer products:

```math
BA = \sum_{k=1}^{r} b_k\, a_k^\top
```

Applying the adapted layer to an input vector \(x\) gives, for \(r = 2\):

```math
y = W_0 x + b_1\,(a_1^\top x) + b_2\,(a_2^\top x)
```

The first term is the original output before adaptation. The remaining terms are the learned correction, and each one is read from right to left:

- \(a_k^\top x\) is **a single number**: the dot product between the input and \(a_k\). It is large when \(x\) points in the same direction as \(a_k\), close to zero when \(x\) is nearly perpendicular to it, and negative when \(x\) points the opposite way. It works as a **similarity score**, so \(a_k\) behaves like a **key**, or a feature detector.
- \(b_k\) is **a vector with the size of the output**. It is the correction that gets added, multiplied by that score. It plays the role of the **value**.

The value deserves a closer look. Where \(a_k\) lives in the input space and decides *when* to act, \(b_k\) lives in the output space and decides *what* changes:

- **\(b_k\) is fixed after training.** It does not depend on the input. The only thing that varies from input to input is the score multiplying it. So each pair can only ever push the output along one fixed direction, \(b_k\), harder or softer.
- **The score sets the amount and the sign.** With \(b_1 = (0.8, 0.5, -0.2, 0.1)\), a score of \(0.9\) adds \((0.72, 0.45, -0.18, 0.09)\) to the output, a score of \(0.1\) adds only \((0.08, 0.05, -0.02, 0.01)\), and a score of \(-0.5\) subtracts \((0.4, 0.25, -0.1, 0.05)\).
- **"Adding knowledge" means nudging a hidden vector.** The output \(y\) of an adapted layer is not text; it is passed on to the next layers. Adding \(b_k\) moves that hidden vector in a particular direction, and the layers after it are what turn that shift into different behavior. Saying that \(b_1\) "adds cardiology knowledge" is shorthand for: \(b_1\) shifts the representation in a direction that the rest of the network turns into cardiology-like outputs.
- **Shapes.** For \(W_0 \in \mathbb{R}^{d \times k}\), each key \(a_k\) has \(k\) entries (the input size) and each value \(b_k\) has \(d\) entries (the output size).

So the correction is "for every key, measure how strongly the input matches it, and add that key's value in proportion." This is the same sum of \(r\) terms from earlier, now grouped by the index \(k\): one term per key-value pair. The rank \(r\) is therefore also the number of key-value pairs the adapter can hold.

A small example makes this concrete. Let \(a_1 = (1, 0, 0)\) and \(a_2 = (0, 1, 0)\).

- If \(x = (0.9, 0.1, 0)\), the scores are \(0.9\) and \(0.1\), so the correction is \(0.9\,b_1 + 0.1\,b_2\): mostly the first value.
- If \(x = (0, 0, 1)\), both scores are \(0\), so the correction is zero and the layer outputs exactly \(W_0 x\).

## Why this is called a local associative memory

An **associative memory** is retrieved by content rather than by address.

An ordinary lookup, such as a Python dictionary, needs the exact key. `memory["heart disease"]` returns its value, but `memory["chest pain"]` fails, even though the two are related. There is no notion of "close to a key."

An associative memory compares the input with every stored key and returns values in proportion to how similar the input is to each key. An input that resembles a key brings back that key's value even if it is not an exact match, and an input that partly resembles two keys brings back a mixture of their values.

In LoRA, the stored pairs are the rows of \(A\) (keys) and the columns of \(B\) (values), and the comparison is the dot product \(a_k^\top x\). To see this with numbers, imagine a three-dimensional hidden space whose coordinates happen to mean "heart-related," "diabetes-related," and "something else," with keys \(a_1 = (1, 0, 0)\) and \(a_2 = (0, 1, 0)\). Real hidden spaces are not this tidy; the clean axes are only for illustration.

| Input | \(x\) | \(a_1^\top x\) | \(a_2^\top x\) | Correction |
| --- | --- | --- | --- | --- |
| A chest-pain question | \((0.9, 0.1, 0.3)\) | \(0.9\) | \(0.1\) | \(0.9\,b_1 + 0.1\,b_2\), mostly the first value |
| A question on blood sugar after heart surgery | \((0.6, 0.7, 0.2)\) | \(0.6\) | \(0.7\) | \(0.6\,b_1 + 0.7\,b_2\), a mixture |
| A cooking question | \((0, 0, 1)\) | \(0\) | \(0\) | nothing added |

The chest-pain question was never stored as a key, but it is close to \(a_1\), so it retrieves mostly \(b_1\). That is what "retrieved by content" means.

It is called **local** because the retrieval only matters near the keys. If an input is unrelated to the fine-tuning domain, it tends to be nearly perpendicular to every key, the similarity scores stay small, and the adapter adds little correction. The base model keeps its general behavior, and LoRA acts as a compact, task-specific memory bank on top of it.

For example, suppose a general-purpose model is fine-tuned on medical literature. The key \(a_1\) might detect heart-disease questions while the value \(b_1\) adds cardiology knowledge, and the key \(a_2\) might detect diabetes questions while the value \(b_2\) adds diabetes knowledge.

<div class="explainer" data-explainer="lora-kv"></div>

This reading is a useful interpretation, not a guarantee:

- **Learned keys need not match human concepts.** Nothing forces \(a_1\) to mean "heart disease." A trained key can respond to a mixture of features, and different keys can overlap.
- **Small is not zero.** An unrelated input usually gets small scores, not exactly zero ones, so "little or no correction" is approximate.
- **\(x\) is a hidden representation.** In a transformer, the input to an adapted layer is the vector entering that layer, not the raw text. "Detects heart-disease questions" means detecting a direction in that internal space.
- **The scaling factor still applies.** The full correction is \(\frac{\alpha}{r} \sum_k b_k (a_k^\top x)\), so \(\alpha / r\) sets the overall strength of every retrieved value.
- **It is not attention.** There is no softmax. Every key contributes in direct proportion to its score, and a negative score subtracts its value.
