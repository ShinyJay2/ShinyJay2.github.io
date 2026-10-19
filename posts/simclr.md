---
title: "SimCLR: Learning Visual Representations with Augmentation"
date: "2025-05-15"
category: "Unsupervised Learning"
description: "A closer look at augmented views, projection heads, and the NT-Xent objective."
draft: false
source_url: "https://jaehoonstudy.tistory.com/58"
---

SimCLR is a representative contrastive learning method for visual representations. Like the framework introduced in [the preceding overview](/blog/unsupervised-learning/), it brings positive pairs together and separates negative pairs. Its contribution is a simple training framework and a study of the components that make contrastive learning effective.

The paper is [A Simple Framework for Contrastive Learning of Visual Representations](https://arxiv.org/abs/2002.05709), by Ting Chen, Simon Kornblith, Mohammad Norouzi, and Geoffrey Hinton.

## What makes contrastive learning work well?

The paper identifies several important ingredients:

- **Strong, compositional augmentations.** Cropping, color distortion, and Gaussian blur are combined to create challenging positive pairs.
- **A nonlinear projection head.** A small MLP sits above the encoder, and the contrastive loss is applied to its output z.
- **L2 normalization and temperature.** Projected embeddings are normalized, and a temperature controls the sharpness of the softmax comparison.
- **Large batches, long training, and high-capacity networks.** More negatives, longer optimization, and stronger encoders improve the reported representations.

SimCLR combines these ingredients. The paper reports 76.5% ImageNet top-1 accuracy under linear evaluation for its large-model configuration. Fine-tuning with 1% of ImageNet's labels gives 85.8% **top-5** accuracy. The metrics and evaluation protocols differ, so these numbers are not a direct before-and-after comparison.

## SimCLR method

The framework can be understood by following one image through each stage.

<figure><img src="/assets/posts/58-1.png" alt="Two augmented views pass through an encoder and projection head before their similarity is optimized."><figcaption>The SimCLR framework, from Chen et al., ICML 2020.</figcaption></figure>

### 1. Data augmentation

Start with an image x. Apply the same family of transformations twice, but sample the transformation parameters independently. The result is a pair of different views:

```math
\tilde{x}_i=t(x),\qquad\tilde{x}_j=t'(x),\qquad t,t'\sim\mathcal{T}.
```

The augmentation pipeline consists of random image cropping, random color distortion, and Gaussian blur. A crop is sampled with scale in [0.08, 1.0] and aspect ratio in [3/4, 4/3], then resized to 224 by 224 pixels. Color distortion changes brightness, contrast, saturation, and hue, with grayscale conversion also used. Gaussian blur provides a further change in local appearance.

The two views are a **positive pair** because they originate from the same image. The paper's ablations emphasize the combination of cropping and color distortion, with blur providing an additional improvement.

### 2. Encoder network

The encoder is a ResNet with its final classification head removed. In the standard ResNet-50 example, global average pooling gives a 2,048-dimensional representation:

```math
h_i=f_\theta(\tilde{x}_i)\in\mathbb{R}^{2048}.
```

This h is the image representation that will later be used for downstream tasks.

### 3. Projection head

A small MLP is added above h: a fully connected layer from 2,048 to 2,048 dimensions, ReLU, and a second fully connected layer from 2,048 to 128 dimensions.

```math
z_i=g_\phi(h_i)=W_2\operatorname{ReLU}(W_1h_i).
```

The contrastive loss is applied to z rather than directly to h. Without the head, h must simultaneously satisfy two demands: support the contrastive objective's attraction and separation constraints, and remain useful for a downstream task such as classification.

**The projection head gives those demands some room to separate.** Its output can specialize in the contrastive comparison, while h can retain information useful beyond that comparison. An augmentation-invariant objective, for example, may discard information about color or orientation that another task needs.

The nonlinear head learns an additional transformation in which the contrastive relationship can be easier to express. It supplies an intermediate space dedicated to the training objective. This does not isolate h from the loss: gradients still pass through g into the encoder.

After pretraining, g is discarded and h is used for downstream evaluation.

### 4. Normalization

Before comparing projected embeddings, normalize their lengths:

```math
\bar{z}_i=\frac{z_i}{\|z_i\|_2},\qquad
\bar{z}_j=\frac{z_j}{\|z_j\|_2}.
```

The inner product of these normalized vectors is cosine similarity. Their comparison depends on direction rather than vector magnitude.

### 5. Contrastive loss

A minibatch of N original images produces 2N augmented views. For any anchor i, its paired view j is the positive; every other view except the anchor itself is treated as a negative.

```math
s_{i,k}=\bar{z}_i^\top\bar{z}_k,
\qquad
\ell_{i,j}=-\log\frac{\exp(s_{i,j}/\tau)}
{\sum_{k=1}^{2N}\mathbf{1}[k\ne i]\exp(s_{i,k}/\tau)}.
```

The indices identify views in the minibatch, not semantic classes. Only the other augmentation of the same original image is positive. The denominator includes that positive and all negative candidates, but excludes the anchor.

Each direction of a pair is evaluated, and the losses are averaged:

```math
\mathcal{L}=\frac{1}{2N}\sum_{n=1}^{N}
\left(\ell_{2n-1,2n}+\ell_{2n,2n-1}\right).
```

This uses all available in-batch negatives instead of requiring a separate hard-negative selection step.

## Large batch size

The paper uses a batch size of 4,096 in its 100-epoch experiments. Two views per image give 8,192 views, so each anchor has **8,190 negative views** and one positive.

One motivation for many negatives comes from the mutual-information interpretation of InfoNCE. Under the assumptions of that bound:

```math
I(Z;Z^+)\ge\log(K+1)-\mathcal{L}_{\mathrm{InfoNCE}}.
```

Here K is the number of negatives. Increasing the candidate count raises the ceiling of the lower bound and can make it less restrictive. This motivates larger comparison sets, but it does not guarantee that every increase in batch size improves downstream performance. Sampling assumptions and the relationship between mutual information and useful features also matter.

For further discussion, see [On Mutual Information in Contrastive Learning for Visual Representations](https://arxiv.org/abs/2005.13149).

## Limitations

Large batches are expensive. Comparing every pair of views creates a similarity matrix whose size grows quadratically, in addition to the memory required by the encoder's activations.

Memory banks and queues offer alternatives for supplying negatives. Ordinary gradient accumulation does not automatically recreate a large contrastive batch: separate minibatches do not share the same denominator unless the implementation explicitly arranges that comparison.

Results are also sensitive to augmentations and their hyperparameters, and strong performance can require long training schedules.

A further problem is **false negatives**. Suppose the dataset contains several photographs of lions. Two augmentations of one photograph are positive, but an augmentation of another lion photograph is negative, even though both contain similar semantic information. The objective can push apart examples that a downstream classifier should group together.

[MoCo](/blog/moco/) offers a queue-based alternative. BYOL explores learning without explicit negatives, while debiased contrastive methods and other Siamese approaches address related limitations. These are related directions rather than a strict chronological sequence: the original MoCo preprint predates SimCLR.
