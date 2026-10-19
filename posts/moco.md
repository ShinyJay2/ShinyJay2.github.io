---
title: "MoCo: Momentum Contrast for Visual Representation Learning"
date: "2025-05-17"
category: "Unsupervised Learning"
description: "How a queue and a momentum encoder make a large contrastive dictionary practical."
draft: false
source_url: "https://jaehoonstudy.tistory.com/59"
---

The large-batch requirement in [SimCLR](/blog/simclr/) motivates a useful question: can representations from earlier minibatches supply the negative examples needed now?

MoCo answers this by **storing earlier representations**. Its momentum encoder makes that reuse practical by keeping the stored keys reasonably consistent. The comparison with SimCLR is conceptual; the original MoCo preprint appeared earlier.

The paper, [Momentum Contrast for Unsupervised Visual Representation Learning](https://arxiv.org/abs/1911.05722), comes from Facebook AI Research and includes Kaiming He among its authors.

## Introduction: contrastive learning as dictionary lookup

Contrastive learning is often described geometrically: minimize distance to a positive representation and increase distance to negatives. MoCo describes the same matching problem as **dictionary lookup**.

The dictionary contains image representations. Given a query, the model should identify its matching positive key among a set of negative keys. With one positive and K negatives, this becomes a K + 1-way softmax classification objective:

```math
\mathcal{L}_q=-\log\frac{\exp(q^\top k^+/\tau)}
{\exp(q^\top k^+/\tau)+\sum_{i=1}^{K}\exp(q^\top k_i^-/\tau)}.
```

The remaining questions are concrete: where do the query and keys come from, and what happens when one image enters the model?

## Method

<figure><img src="/assets/posts/59-2.png" alt="MoCo uses a query encoder, a momentum key encoder, and a queue of previously computed keys."><figcaption>The MoCo framework, from He et al., CVPR 2020.</figcaption></figure>

### Dictionary as a queue

For each original image x, sample two transformations independently to obtain a query view and a key view:

```math
x_q=t(x),\qquad x_k=t'(x),\qquad
q=f_q(x_q),\qquad k^+=f_k(x_k).
```

The query view enters the query encoder. The key view enters the momentum encoder. Because these views come from the same image, k⁺ is the positive key for q.

The negative dictionary is a queue of keys computed from earlier minibatches. Its capacity K can be much larger than the current minibatch size N. A query can therefore be compared against many negatives without encoding all those negatives in the current step.

**The dictionary size is separated from the minibatch size by reusing earlier representations.** This is the reason for storing past keys.

After the current comparison, newly computed keys are enqueued and the oldest keys are removed. Adding N keys and removing N old keys keeps the queue at its chosen capacity. Over time, it becomes a rolling collection from recent minibatches.

The contrastive denominator compares the query with its one positive key and K queued negatives. A large dictionary no longer requires an equally large current batch.

### Momentum update

The queue explains how earlier representations are stored. The momentum encoder explains why those representations can be compared coherently.

<figure><img src="/assets/posts/59-7.png" alt="Only the query encoder receives gradients; the key encoder follows through momentum updates."><figcaption>Gradient-based query updates and momentum-based key updates have different roles.</figcaption></figure>

Gradients flow through the query encoder, but not through the key encoder. The key parameters are updated by:

```math
\theta_k\leftarrow m\theta_k+(1-m)\theta_q.
```

The queue contains keys from many earlier steps. Representations of the same or similar content must therefore remain reasonably consistent across those steps.

The query encoder can move sharply as gradient updates change its parameters. If the key encoder changed just as abruptly, a similar image could receive a very different representation depending on when it entered the queue. The dictionary would combine keys from incompatible embedding spaces.

The momentum encoder follows the query encoder more slowly. It behaves like a stable, slightly older version of the encoder, making the stored comparison targets change more gradually.

### A numerical example

Initialize both encoders with the same two parameters:

```math
\theta_q^{(0)}=\theta_k^{(0)}=
\begin{bmatrix}0.7\\0.3\end{bmatrix}.
```

Suppose one gradient step changes the query parameters to:

```math
\theta_q^{(1)}=\begin{bmatrix}0.8\\0.1\end{bmatrix}.
```

With momentum 0.9, the key update is:

```math
\begin{aligned}
\theta_k^{(1)}
&=0.9\begin{bmatrix}0.7\\0.3\end{bmatrix}
+0.1\begin{bmatrix}0.8\\0.1\end{bmatrix}\\
&=\begin{bmatrix}0.71\\0.28\end{bmatrix}.
\end{aligned}
```

The query has moved to [0.8, 0.1], but the key parameters have moved only to [0.71, 0.28]. Copying the query parameters immediately would make the target move just as sharply as the query; the weighted update avoids that.

<figure><img src="/assets/posts/59-10.png" alt="An illustrative query trajectory changes abruptly while the momentum key trajectory evolves more smoothly."><figcaption>Gradual key evolution, shown schematically rather than as a measured benchmark.</figcaption></figure>

The central reasoning is worth keeping explicit. **Using keys from multiple steps reduces dependence on large batches. Using keys from multiple steps also requires consistency. Momentum provides that consistency by following the query encoder slowly rather than accepting its full movement at every step.**

## Results

The paper compares MoCo with earlier representation-learning methods:

<figure><img src="/assets/posts/59-11.png" alt="A plot compares MoCo with previous representation-learning methods."><figcaption>The comparison reported in the original MoCo paper.</figcaption></figure>

It also varies the momentum coefficient. With a dictionary size of 4,096, the reported ImageNet linear-classification results are:

| Momentum | Top-1 accuracy |
| --- | --- |
| 0 | Training failed |
| 0.9 | 55.2% |
| 0.99 | 57.8% |
| 0.999 | 59.0% |
| 0.9999 | 58.9% |

The results support a slowly changing key encoder. They also show that increasing momentum without limit is not the objective: consistency must be balanced against following the query network's improvement.

## Limitations

MoCo still depends on negative examples. Images from the same semantic category can be treated as negatives simply because they are different images. The method can therefore push apart semantically related examples.

It also still needs a substantial negative dictionary. Storing and comparing its representations introduces memory and computational overhead even though the batch itself can be smaller.

Later methods such as BYOL and SimSiam investigate useful representations without explicit negative examples.
