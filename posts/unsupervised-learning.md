---
title: "Unsupervised Learning: Contrastive and Reconstruction Objectives"
date: "2025-05-15"
category: "Unsupervised Learning"
description: "How positive pairs, negative samples, and reconstruction objectives shape learned representations."
draft: false
source_url: "https://jaehoonstudy.tistory.com/57"
---

When a dataset contains many examples but no labels, unsupervised learning provides a way to learn from the data itself. Labels ordinarily identify a category or a property of an example. Without them, a self-supervised method can construct a **pretext task** that supplies a learning signal and encourages the model to understand the data's structure.

Two major approaches to representation learning are contrastive learning and reconstruction-based learning. These are the two approaches considered here, rather than an exhaustive classification of unsupervised learning. The aim is to establish their central intuitions before examining individual methods.

## Contrastive learning

**Similar examples should have similar representations.**

Two similar images, or two augmented versions of one image, should produce similar representation vectors. This requires two steps: select or generate related examples, then train an encoder to place those examples closer together than unrelated examples in representation space.

<figure><img src="/assets/posts/57-1.png" alt="Similar images are mapped to related representation vectors."><figcaption>An encoder should preserve meaningful relationships between examples.</figcaption></figure>

### Why not simply minimize the distance?

If f is an encoder, a natural first attempt is to minimize the distance between the representations of two similar examples:

```math
\min_\theta\sum_{(x,x^+)}\|f_\theta(x)-f_\theta(x^+)\|_2^2.
```

The difficulty becomes clear by considering an encoder that always returns the same constant c:

```math
f_\theta(x)=c\quad\text{for every }x
\quad\Longrightarrow\quad
\|f_\theta(x)-f_\theta(x^+)\|_2^2=\|c-c\|_2^2=0.
```

The loss is zero, yet the model has learned nothing that distinguishes the data. Bringing similar examples together is therefore insufficient on its own. Contrastive learning adds a second requirement: **keep different examples apart**. This is the compare-and-contrast strategy.

<figure><img src="/assets/posts/57-4.png" alt="Similar examples are attracted and dissimilar examples are separated in representation space."><figcaption>Agreement for related examples, separation for unrelated examples.</figcaption></figure>

Two decisions now become important: which examples should be compared, and which loss should express their relationship?

### Which examples should be compared?

<figure><img src="/assets/posts/57-5.png" alt="Positive pairs can come from matching labels, image augmentations, patches, or nearby video frames."><figcaption>Possible related examples. Pairing by a known class label is a supervised case.</figcaption></figure>

Each construction identifies a relationship that the encoder should preserve. Two augmentations originate from the same image; nearby video frames often contain related content; patches can share information about a scene. Their representations are encouraged to move toward one another. The choice of positive pair determines what “similar” means for the learning task.

### Triplet loss

Choose an **anchor**, an example similar to it called the **positive**, and an unrelated example called the **negative**. The objective should pull the positive toward the anchor and push the negative away.

<figure><img src="/assets/posts/57-6.png" alt="An anchor lion is compared with a positive lion image and a negative bowl image."><figcaption>A triplet contains an anchor, a positive, and a negative.</figcaption></figure>

```math
\min_\theta\sum_{(a,p,n)}
\max\left(0,\|f_\theta(a)-f_\theta(p)\|_2^2
-\|f_\theta(a)-f_\theta(n)\|_2^2+\varepsilon\right).
```

The minimization seeks encoder parameters that reduce the triplet loss. The sum aggregates that loss across examples. Inside the maximum are the positive distance, the negative distance, and a positive margin epsilon.

When the positive is close and the negative is sufficiently far away, the expression inside the maximum becomes nonpositive. The maximum then selects zero. The model is not asked to keep increasing a separation that already satisfies the margin.

If every representation collapses to the same constant, both distances become zero and the loss equals the margin. A collapsed representation therefore no longer achieves zero loss. To satisfy the objective, the negative distance must exceed the positive distance by at least the margin. This describes the desired solution; it does not guarantee that optimization will escape every collapsed stationary point.

### N-way classification and InfoNCE

Triplet loss compares an anchor with one positive and one negative. This raises a practical question: **which negative should be chosen?**

A **hard negative** is a different example that the model has placed close to the anchor. An **easy negative** is already far away. Selecting an easy negative that satisfies the margin gives zero loss and no learning signal for that triplet. A hard negative exposes a distinction the model still needs to learn.

Instead of selecting only one negative, an N-way classification objective compares the positive against several negatives at once:

```math
\mathcal{L}_{\mathrm{InfoNCE}}=-\log
\frac{\exp(\operatorname{sim}(q,k^+)/\tau)}
{\exp(\operatorname{sim}(q,k^+)/\tau)+\sum_{j=1}^{K}\exp(\operatorname{sim}(q,k_j^-)/\tau)}.
```

The positive must be identified among K + 1 candidates. Negatives with greater similarity contribute more strongly to the denominator. This extends the positive-versus-negative comparison to a larger set, reducing reliance on whether a single selected negative happens to provide a useful signal.

## Reconstruction-based learning

**Representations must retain enough information to reconstruct the original input.**

The objective remains to learn meaningful properties without labels. Contrastive learning approaches this by arranging examples in representation space. Reconstruction takes a different route: encode the image as a vector, then use that vector to recover an image resembling the original.

If the vector retains the important information in the image, a decoder should be able to reconstruct it at the original size. The reconstruction task therefore supplies the signal for learning the representation.

<figure><img src="/assets/posts/57-10.png" alt="A dog image passes through an encoder and a decoder to produce a reconstruction."><figcaption>Learning a representation through reconstruction.</figcaption></figure>

```math
z=f_\theta(x),\qquad\hat{x}=g_\phi(z),\qquad
\mathcal{L}_{\mathrm{rec}}=\|x-\hat{x}\|_2^2.
```

A bottleneck or another constraint is needed to make this more than unrestricted copying. Reconstruction avoids selecting negatives and does not require a large batch specifically to provide contrastive negatives. However, reconstructing pixels accurately does not automatically ensure that the representation captures every semantic property needed downstream.

## Further directions

Both approaches aim to produce useful representations from unlabeled data. The contrastive methods in this sequence begin with [SimCLR](/blog/simclr/) and [MoCo](/blog/moco/). Other directions include BYOL, SimSiam, and SCLR. Autoencoders and masked autoencoders develop the reconstruction approach, while GCRL explores a hybrid generative-contrastive objective.
