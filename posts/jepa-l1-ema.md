---
title: "L1 Loss and EMA in JEPA"
date: "2026-10-20"
category: "Unsupervised Learning"
description: "Absolute prediction error, slowly changing teachers, and the distinction between EMA and stop-gradient."
draft: false
conversation_id: "01a15495-3510-7cb0-926f-bd2ba872fbf6"
conversation_turn: "01a154bf-2b73-7f52-9843-6c0ffbfe91d7"
---

In V-JEPA, these two ideas serve different purposes:

- **L1 prediction error** measures how far the predicted features are from the target features.
- **EMA of the target encoder** makes those targets change gradually during training.

Let’s separate them.

## 1. What is L1 prediction error?

Suppose the target encoder produces the feature vector

```math
z=[2,-1,3]
```

and the predictor outputs

```math
\hat z=[1,-3,4].
```

The difference is \([-1,-2,1]\). L1 takes the absolute value of each difference:

```math
\|\hat z-z\|_1=1+2+1=4.
```

Training code often averages instead of summing, giving \(4/3\). More generally, mean L1 error is

```math
\mathcal L_{\mathrm{L1}}
=\frac1D\sum_{j=1}^{D}|\hat z_j-z_j|.
```

For V-JEPA, you also average over samples and predicted positions. **These numbers are embedding coordinates, not pixel values.**

Compared with squared error:

| Error in one coordinate | Absolute error, L1 | Squared error, L2 squared |
|---:|---:|---:|
| 0.1 | 0.1 | 0.01 |
| 1 | 1 | 1 |
| 10 | 10 | 100 |

Squared error gives large mistakes disproportionately more influence. L1 grows linearly.

You can see this in their gradients. Let \(e=\hat z-z\):

```math
\frac{\partial |e|}{\partial \hat z}
=\operatorname{sign}(e),
\qquad
\frac{\partial e^2}{\partial \hat z}
=2e.
```

Ignoring averaging factors, **L1 pushes according to the direction of the error; squared error also scales the push with its magnitude.** At zero, L1 is nondifferentiable; implementations use a valid subgradient, commonly zero.

Neither loss is universally better.

<!-- visual:l1 -->

<div class="explainer" data-explainer="l1"></div>

## 2. Why do we need an EMA target encoder?

In ordinary supervised learning, the target is fixed:

```text
image → model → prediction
                   ↕
            fixed human label
```

In V-JEPA, another network generates the target:

```text
visible content → encoder → predictor → prediction
                                           ↕
full content → target encoder ─────────→ target
```

That creates a difficulty: **the model is learning to match a target that is itself learned.**

If the target changes sharply every step, the predictor keeps chasing a moving objective. If the target encoder stays randomly initialized forever, the targets cannot improve alongside the learned representation.

EMA provides a slowly changing teacher.

## 3. What does EMA actually do?

Let:

- \(\theta_t\): the current, gradient-trained encoder parameters.
- \(\bar\theta_t\): the target encoder parameters.
- \(m\): the momentum coefficient, close to 1.

After an optimizer update:

```math
\boxed{
\bar\theta_t
=m\bar\theta_{t-1}+(1-m)\theta_t
}
```

For example, if \(m=0.99\):

```math
\text{new teacher}
=99\%\times\text{old teacher}
+1\%\times\text{current encoder}.
```

This happens separately for every parameter.

Unrolling the equation shows why it is called an **exponential moving average**:

```math
\bar\theta_t
=m^t\bar\theta_0
+(1-m)\sum_{k=1}^{t}m^{t-k}\theta_k.
```

The teacher combines past encoder weights, with older weights receiving exponentially less influence.

A useful approximate memory scale is

```math
\frac{1}{1-m}
```

updates: roughly 100 updates for \(m=0.99\), or 1,000 for \(m=0.999\). This is a decay scale, not a strict window.

## 4. Why does averaging help?

Each optimizer step responds to a particular minibatch. That introduces fluctuations into the weights.

EMA smooths those fluctuations, so the teacher gives the student a more consistent target while still following its progress.

There is a trade-off:

| Momentum | Teacher behavior |
|---|---|
| Lower \(m\) | Adapts quickly, but follows more fluctuations |
| Higher \(m\) | Changes smoothly, but lags farther behind |

The teacher is **not guaranteed to be more accurate at every step**. Its useful property here is that it changes on a slower timescale.

Also, averaging parameters is not exactly the same as averaging predictions from many models, because neural networks are nonlinear.

<!-- visual:ema -->

<div class="explainer" data-explainer="ema"></div>

## 5. EMA and stop-gradient are different

They often appear together, which makes them easy to confuse.

```python
# Target computation: no gradient through the teacher.
with torch.no_grad():
    target = target_encoder(full_input)

prediction = predictor(online_encoder(visible_input))
loss = l1_loss(prediction, target)

optimizer.zero_grad()
loss.backward()
optimizer.step()

# Teacher update: a separate averaging rule.
with torch.no_grad():
    for teacher_p, online_p in zip(
        target_encoder.parameters(),
        online_encoder.parameters(),
    ):
        teacher_p.mul_(momentum).add_(
            online_p, alpha=1 - momentum
        )
```

This is schematic code for parameter updates; models with running-statistic buffers need an explicit buffer-handling policy.

- **Stop-gradient** determines where the loss can send gradients.
- **EMA** determines how the teacher’s weights change.

Without stop-gradient, the target branch could reduce the current error by moving its outputs toward the predictions. With stop-gradient, this step trains the prediction side to match the current targets.

**EMA alone does not guarantee that representations cannot collapse.** A constant-output encoder can also be averaged. Avoiding collapse depends on the full learning setup.

## 6. When do we use EMA?

The same mathematical operation appears in several different roles:

| Use | What is averaged? | Why? |
|---|---|---|
| **Teacher–student learning** | Teacher weights track student weights | Produce slowly changing training targets |
| **Semi-supervised learning** | Teacher weights | Produce more consistent pseudo-labels |
| **Some reinforcement-learning methods** | Target-network weights | Stabilize targets that depend on learned value estimates |
| **Evaluation or generation** | A shadow copy of model weights | Smooth training fluctuations; the averaged model may perform better |
| **Adam and momentum optimizers** | Gradients or squared gradients | Smooth the information used to update parameters |

The final row is especially worth distinguishing: **Adam’s moving averages are not a target encoder.** It averages gradient statistics, whereas a teacher EMA averages model weights.

For your JEPA comparison: **V-JEPA uses a slowly updated teacher to supply targets. LeWorldModel instead trains both sides jointly and adds SIGReg to constrain the representation distribution.** EMA is therefore a design choice for a particular learning setup, not something every neural network needs.
