---
title: "Understanding SIGReg: From Latent Point Clouds to Gaussian Projections"
date: "2026-10-20"
category: "Unsupervised Learning"
description: "Why representation collapse occurs, what an isotropic Gaussian means, and how projections and characteristic functions measure a latent distribution."
draft: false
conversation_id: "01a15495-3510-7cb0-926f-bd2ba872fbf6"
conversation_turn: "01a154fa-d92f-7b11-922f-1f3d0ed5ff82"
---

To understand SIGReg, it helps to follow this sequence: **why it is needed → which distribution is desired → how closeness to that distribution is calculated**.

The symbols in the equations will be explained one by one. The setting here is its use in LeWorldModel.

## 1. The starting point: asked to predict well, the model learns nothing

Suppose an image \(o_t\) is passed through an encoder \(f\) to turn it into a vector of numbers.

```math
z_t=f(o_t)
```

- \(o_t\): the image observed at time \(t\)
- \(f\): a neural network that turns the image into numbers
- \(z_t\): a vector summarizing the image, its embedding

For example, consider the following. The numbers are illustrative.

```text
Ball on the left   → encoder → [ 0.2, -0.7]
Ball in the center → encoder → [ 0.5,  0.1]
Ball on the right  → encoder → [ 0.9,  0.6]
```

The predictor uses the current representation and action to predict the next representation.

```math
\hat z_{t+1}=g(z_t,a_t)
```

The hat above \(\hat z\) indicates a prediction.

Training makes the prediction similar to the representation of the actual next image.

```math
\mathcal L_{\text{pred}}
=
\|\hat z_{t+1}-z_{t+1}\|_2^2
```

This means “square the difference in each coordinate, then add the results.”

But what happens if the encoder **turns every image into `[0, 0]`**?

```text
Every image → encoder → [0, 0]
Every input → predictor → [0, 0]
```

The prediction error is zero. Yet every distinction between the images has been lost.

This is **representation collapse**.

An additional requirement is therefore needed alongside prediction accuracy:

> The numbers representing different inputs should not all gather at a single point.

SIGReg implements this requirement as **a loss that constrains the distribution**.

## 2. Look at the point cloud formed by many representations

Suppose an embedding consists of two numbers.

```math
z_b=(z_{b,1},z_{b,2})
```

Treat these two numbers as horizontal and vertical coordinates. One embedding is then one point on a plane.

Here, \(b\) is the index of the input.

- \(z_1\): the point for the first image
- \(z_2\): the point for the second image
- \(z_B\): the point for the final image

Processing \(B\) images produces a point cloud.

This cloud can take several forms.

| Point-cloud shape | Meaning |
| --- | --- |
| Every point overlaps in one place | Every input has the same representation |
| Points lie on a single straight line | Two coordinates are present, but only one direction is effectively used |
| The cloud stretches along one direction | The scale of variation differs substantially by direction |
| The cloud spreads evenly in different directions | Multiple directions are used |

SIGReg brings the cloud closer to a particular reference distribution.

That reference is the **standard isotropic Gaussian distribution**.

## 3. What does \(\mathcal N(0,I)\) mean?

The target of SIGReg can be written simply as:

```math
z\sim\mathcal N(0,I_d)
```

Read it one part at a time.

- \(z\): the embedding obtained by passing data through the encoder
- \(\sim\): “follows this distribution”
- \(\mathcal N\): a normal, or Gaussian, distribution
- \(0\): the center is the origin
- \(I_d\): in \(d\) dimensions, each coordinate has variance 1, and distinct coordinates have covariance 0

The last part needs a little more explanation.

**Mean zero** means that the center of the point cloud is near zero.

```math
\text{mean}=\frac{z_1+\cdots+z_B}{B}
```

**Variance** measures how far values lie from their mean. In one dimension, a basic calculation is:

```math
\text{variance}
=
\frac1B\sum_{b=1}^{B}(z_b-\text{mean})^2
```

Subtract the mean, square each difference, and average.

- If all values are the same, the variance is zero.
- The more widely the values spread, the greater the variance.

**Isotropic** means the spread is the same in every direction. Think of circular equal-density contours in two dimensions and spherical equal-density surfaces in three dimensions.

However, **this does not mean the points lie only on the surface of a circle or sphere.** A Gaussian is distributed throughout space.

There is another important distinction:

> SIGReg does not require adding random noise to each embedding. It constrains the distribution of embeddings produced by different inputs.

A deterministic encoder that gives the same embedding for the same image is entirely compatible with this requirement.

This distributional target is the basic design of SIGReg. [Official LeJEPA explanation](https://github.com/galilai-group/lejepa)

<div class="explainer" data-explainer="latent"></div>

## 4. Why not just match the mean and variance?

A Gaussian is not the only distribution with mean zero and variance one.

For example, suppose a value is always one of the following two numbers:

```math
s=
\begin{cases}
-1 & \text{with probability }1/2\\
+1 & \text{with probability }1/2
\end{cases}
```

Its mean is:

```math
\frac{-1+1}{2}=0
```

Its variance is:

```math
\frac{(-1)^2+(+1)^2}{2}=1
```

But all values are located at only \(-1\) and \(+1\), which is completely different from a bell-shaped normal distribution.

In other words:

```math
\text{mean 0, variance 1}
\quad\not\Rightarrow\quad
\text{standard normal distribution}
```

SIGReg aims to compare **the shape of the distribution, not only its mean and variance**.

Directly comparing distributions of embeddings with hundreds of dimensions is difficult. The problem is therefore transformed into an easier one.

## 5. Look at shadows in several directions

Suppose points lie on a plane. Projecting them onto the horizontal axis leaves only each point’s horizontal coordinate.

Projecting them diagonally leaves one number that combines the horizontal and vertical coordinates.

This is a **projection**.

If \(u\) is a vector specifying a direction:

```math
s=u^\top z
```

The notation may look complicated, but the calculation is simple. In two dimensions:

```math
s=u_1z_1+u_2z_2
```

For example, if:

```math
z=(2,0),\qquad
u=\left(\frac1{\sqrt2},\frac1{\sqrt2}\right)
```

then:

```math
s
=
\frac1{\sqrt2}\times2
+
\frac1{\sqrt2}\times0
=
\sqrt2
```

A point originally described by two numbers has become one number along the diagonal direction.

SIGReg chooses several such directions at random.

```math
s_{b,m}=u_m^\top z_b
```

- \(b\): which input
- \(m\): which projection direction
- \(s_{b,m}\): the value obtained by projecting that input in that direction

**Why normalize the direction vector to length one?**

Doubling the direction vector also doubles the projected values. It would then be unclear whether a wider distribution came from the data or simply from the length of the direction vector.

Setting:

```math
\|u_m\|_2=1
```

allows **direction alone to be compared**.

The standard isotropic Gaussian has a useful property:

```math
z\sim\mathcal N(0,I_d)
\quad\Rightarrow\quad
u^\top z\sim\mathcal N(0,1)
```

Here, \(u\) must have unit length.

In words:

> If a high-dimensional point cloud follows a standard isotropic Gaussian, its shadow in every direction follows a one-dimensional standard normal distribution.

The **Cramér–Wold theorem** supplies the mathematical basis for distinguishing a distribution through its projections in all directions. In practice, SIGReg approximates this using a finite set of random directions. [LeJEPA paper, Section 4](https://arxiv.org/html/2511.08544v3)

<div class="explainer" data-explainer="projection"></div>

## 6. How can numbers be compared with a normal distribution?

After projecting in one direction, the following numbers remain:

```math
s_1,s_2,\ldots,s_B
```

Their distribution needs to be compared with \(\mathcal N(0,1)\).

A histogram could be used for a visual comparison. For training, however, **small changes in the numbers should produce smooth changes in the loss, and gradients must be computable**.

SIGReg uses the **characteristic function**.

Start with two calculations, leaving complex numbers aside for a moment.

```math
c(\omega)
=
\frac1B\sum_{b=1}^{B}\cos(\omega s_b)
```

```math
q(\omega)
=
\frac1B\sum_{b=1}^{B}\sin(\omega s_b)
```

The calculation proceeds as follows:

1. Multiply each projected value \(s_b\) by \(\omega\).
2. Apply cosine and sine to each result.
3. Average across the inputs.

Here, \(\omega\) is **a frequency used to inspect the distribution**. It is different from the video time \(t\).

Intuitively, each number \(s_b\) becomes **an arrow on a circle with angle \(\omega s_b\)**.

- Cosine is the arrow’s horizontal component.
- Sine is its vertical component.
- The average is the direction and magnitude remaining when the arrows are combined and divided by their count.

Different distributions cause the arrows to cancel differently across frequencies.

The following notation combines these two calculations into one line:

```math
\hat\varphi(\omega)
=
\frac1B\sum_{b=1}^{B}e^{i\omega s_b}
```

Since:

```math
e^{ix}=\cos x+i\sin x
```

it follows that:

```math
\hat\varphi(\omega)=c(\omega)+i q(\omega)
```

**There is no need to learn a new complex-number calculation here. This simply packages the cosine average and sine average together.**

<div class="explainer" data-explainer="circle"></div>

## 7. The Gaussian reference has a known answer

The characteristic function of the standard normal distribution is:

```math
\varphi_{\text{Gaussian}}(\omega)
=
e^{-\omega^2/2}
```

For a standard normal variable:

```math
\mathbb E[\cos(\omega s)]
=
e^{-\omega^2/2}
```

and:

```math
\mathbb E[\sin(\omega s)]=0
```

The symbol \(\mathbb E\) means an average over the entire distribution. In code, this is estimated using a minibatch average.

The reason the sine average is zero is fairly intuitive. The Gaussian is symmetric around zero, and:

```math
\sin(-x)=-\sin(x)
```

so values on opposite sides cancel.

The cosine formula follows from integrating the Gaussian. Initially, it is enough to accept this formula as a known reference value.

The error at a particular frequency can now be defined:

```math
E(\omega)
=
\left(c(\omega)-e^{-\omega^2/2}\right)^2
+
q(\omega)^2
```

The two parts have clear meanings:

- How far is the cosine average from the Gaussian reference?
- How far is the sine average from its reference value of zero?

Square both differences and add them.

**Substitute a collapsed representation.**

If every \(s_b=0\), then:

```math
c(\omega)=1,\qquad q(\omega)=0
```

Therefore:

```math
E(\omega)
=
\left(1-e^{-\omega^2/2}\right)^2
```

There is an error whenever \(\omega\ne0\). Thus, **a constant representation that achieves zero prediction loss is not a good solution from SIGReg’s perspective**.

However, a positive error and a guarantee that gradients escape collapse from every initialization are different claims.

## 8. Why use more than one frequency?

Different distributions can happen to give the same result at one frequency.

For the earlier \(-1,+1\) distribution, the cosine average is:

```math
c(\omega)
=
\frac{\cos(-\omega)+\cos(\omega)}2
=
\cos(\omega)
```

The Gaussian value is:

```math
e^{-\omega^2/2}
```

Both equal one at \(\omega=0\), but changing the frequency reveals the difference.

Their expansions near zero are particularly informative:

```math
\cos\omega
=
1-\frac{\omega^2}{2}
+\frac{\omega^4}{24}
-\cdots
```

```math
e^{-\omega^2/2}
=
1-\frac{\omega^2}{2}
+\frac{\omega^4}{8}
-\cdots
```

The matching leading terms are connected to the distributions having the same mean and variance. The later terms differ.

This is **why comparing characteristic functions reveals more information than comparing only means and variances**.

<div class="explainer" data-explainer="frequency"></div>

## 9. Combine errors over frequencies, then over directions

First combine the frequency-wise errors for one projection direction \(m\).

```math
T_m
=
B\int
E_m(\omega)w(\omega)\,d\omega
```

Each symbol has the following meaning:

- \(E_m(\omega)\): the error for direction \(m\) at frequency \(\omega\)
- \(w(\omega)\): a weight specifying the importance of each frequency
- \(\int\): summation over a continuous range of frequencies
- \(B\): batch size, a scale factor in the statistic

This has the form of the **Epps–Pulley statistic**.

A computer cannot evaluate every frequency in a continuum, so it selects a finite set and adds their contributions.

```math
T_m
\approx
B\sum_{k=1}^{K}\alpha_k E_m(\omega_k)
```

- \(\omega_k\): a selected frequency
- \(\alpha_k\): a coefficient accounting for integration spacing and weighting

Finally, average the results over \(M\) random directions.

```math
\boxed{
\operatorname{SIGReg}(Z)
=
\frac1M\sum_{m=1}^{M}T_m
}
```

The structure is **project → compare distributions at each frequency → sum over frequencies → average over directions**. The official minimal implementation follows this calculation. [Official SIGReg example](https://github.com/galilai-group/lejepa/blob/main/MINIMAL.md)

## 10. Connect the calculation to tensor shapes

Ignoring time for a moment, one embedding batch has the following shapes.

| Value | Shape | Meaning |
| --- | --- | --- |
| \(Z\) | `[B, D]` | Embeddings for B inputs |
| \(U\) | `[D, M]` | M random unit directions |
| \(ZU\) | `[B, M]` | Each input projected in each direction |
| After multiplying by frequencies | `[B, M, K]` | Each projection examined at K frequencies |
| Batch means of cosine and sine | `[M, K]` | Empirical characteristic function for each direction |
| Sum of frequency-wise errors | `[M]` | Distribution error for each direction |
| Average over directions | scalar | Final SIGReg loss |

The official LeWorldModel code includes a time axis and accepts `[T, B, D]`. It computes batch averages at each time position, then averages over time and projection directions. [LeWorldModel SIGReg implementation](https://github.com/lucas-maes/le-wm/blob/main/module.py)

Therefore, **the axis being averaged is part of the algorithm**. Averaging across embedding coordinates is entirely different from averaging across different inputs.

## 11. What happens when SIGReg is combined with prediction loss?

LeWorldModel uses the following objective:

```math
\mathcal L
=
\mathcal L_{\text{pred}}
+
\lambda\operatorname{SIGReg}(Z)
```

- \(\mathcal L_{\text{pred}}\): learn representations useful for predicting the future given actions
- \(\operatorname{SIGReg}(Z)\): constrain the representation distribution so it does not collapse to one point or only a few directions
- \(\lambda\): the relative strength of these two requirements

With only the prediction term, everything can be mapped to the same representation.

Conversely, with only SIGReg, the distribution may have a desirable shape without its coordinates being useful for predicting the future.

**Using both terms encourages representations that retain diverse information while predicting action-dependent changes.** [LeWorldModel paper](https://arxiv.org/html/2603.19312v1)

The Gaussian target does not mean that the ball’s physical position or velocity must follow a normal distribution. **It is a requirement on the distribution in the coordinate system created by the encoder.** SIGReg does not directly teach physical laws either. Information about physical change is learned through the prediction task using observations and actions.

When reading the official code, begin with the meaning of these three lines:

```python
projected = embeddings @ directions
cos_mean = (projected[..., None] * frequencies).cos().mean(dim=0)
sin_mean = (projected[..., None] * frequencies).sin().mean(dim=0)
```

This is an explanatory form for a `[B, D]` input. The first line **creates shadows in several directions**. The remaining two lines **measure the distribution of those shadows at several frequencies**. Comparing those measurements with the Gaussian’s known answers is the central calculation in SIGReg.
