---
title: "Reinforcement Learning 11: PPO and the Clipped Objective"
date: "2026-10-20"
category: "Reinforcement Learning"
description: "Probability ratios, positive and negative advantages, and what PPO clipping actually limits."
draft: false
series: "Reinforcement Learning"
part: 11
---

A policy-gradient batch contains useful experience, but taking many optimization steps on it can change the policy far from the one that collected the data. PPO addresses this by modifying the objective used during repeated updates. This chapter focuses on **PPO-Clip**, the commonly used clipped-surrogate version.

The difficult part is not writing a clipping function. It is understanding why the objective takes a minimum, why the sign of the advantage changes the answer, and why clipping is not a hard limit on the new policy.

## Freeze the policy that collected the batch

Let \(\pi_{\mathrm{old}}\) collect a batch of states, actions, rewards, and old log probabilities. During optimization, \(\pi_\theta\) changes but those recorded probabilities remain fixed.

Define the probability ratio

```math
r_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}
{\pi_{\mathrm{old}}(a_t\mid s_t)}
=\exp\left(\log\pi_\theta(a_t\mid s_t)-\log\pi_{\mathrm{old}}(a_t\mid s_t)\right).
```

Here \(r_t\) denotes a ratio, not an environment reward. Rewards below are written as \(R_t\).

If the recorded action originally had probability 0.25 and now has probability 0.30, its ratio is 1.2. A ratio of 1 means unchanged probability for that particular action at that state. It does not mean that every action probability is unchanged.

At the start of a new optimization round, current and old policies match, so all recorded ratios start at 1. The denominator must remain fixed throughout every epoch on that batch. Updating the denominator after each minibatch would continually reset the reference point.

## Why a ratio appears in a policy objective

At a fixed state, importance weighting rewrites an action expectation:

```math
\sum_a\pi_\theta(a\mid s)\widehat A(s,a)
=\sum_a\pi_{\mathrm{old}}(a\mid s)
\frac{\pi_\theta(a\mid s)}{\pi_{\mathrm{old}}(a\mid s)}
\widehat A(s,a).
```

This suggests a batch surrogate

```math
L^{\mathrm{ratio}}(\theta)=\widehat{\mathbb E}_t
\left[r_t(\theta)\widehat A_t\right],
```

where the hat denotes a finite-batch average and advantages are held fixed during this optimization round. The states still come from the old policy's rollout, so this surrogate is not an exact expression for the new policy's complete expected return.

Differentiate the ratio with its denominator held constant:

```math
\nabla_\theta r_t(\theta)
=r_t(\theta)\nabla_\theta\log\pi_\theta(a_t\mid s_t).
```

At the old parameters, \(r_t=1\), giving

```math
\left.\nabla_\theta L^{\mathrm{ratio}}\right|_{\theta=\theta_{\mathrm{old}}}
=\widehat{\mathbb E}_t\left[
\nabla_\theta\log\pi_\theta(a_t\mid s_t)\widehat A_t\right]_{\theta=\theta_{\mathrm{old}}}.
```

This is the familiar sampled policy-gradient direction. The objective agrees locally with that direction, but repeatedly maximizing it without restraint can make large changes based on noisy advantages.

## The clipped objective

PPO-Clip maximizes

```math
L^{\mathrm{clip}}(\theta)=\widehat{\mathbb E}_t\left[
\min\left(r_t\widehat A_t,
\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)\widehat A_t\right)
\right].
```

For one sample, compute two numbers: the original ratio-weighted advantage and the clipped-ratio-weighted advantage. Keep the smaller one. The minimum ensures that clipping removes an excessive improvement incentive without hiding a worsening change.

The result is a lower bound on the **unclipped surrogate for the same samples**. That should not be confused with a guaranteed lower bound on the actual return obtained by executing the updated policy.

## Positive advantage: increasing probability helps

Let \(\widehat A=2\) and \(\epsilon=0.2\). This action looks better than the baseline, so increasing its probability increases the objective.

| Ratio | Unclipped value \(r\widehat A\) | Clipped-ratio value | Minimum |
| --- | --- | --- | --- |
| 0.5 | 1 | 1.6 | 1 |
| 1.0 | 2 | 2 | 2 |
| 1.2 | 2.4 | 2.4 | 2.4 |
| 1.5 | 3 | 2.4 | 2.4 |

Once the ratio exceeds 1.2, further increases do not improve this sample's objective. But decreasing the ratio to 0.5 still reduces the objective. The minimum keeps that penalty rather than replacing it with the more favorable clipped value.

For positive advantage, the expression simplifies to

```math
\ell(r,\widehat A)=\widehat A\min(r,1+\epsilon),
\qquad \widehat A>0.
```

## Negative advantage: decreasing probability helps

Now let \(\widehat A=-2\). This action looks worse than the baseline. Reducing its probability makes the objective less negative, which is an improvement when maximizing.

| Ratio | Unclipped value \(r\widehat A\) | Clipped-ratio value | Minimum |
| --- | --- | --- | --- |
| 0.5 | -1 | -1.6 | -1.6 |
| 0.8 | -1.6 | -1.6 | -1.6 |
| 1.0 | -2 | -2 | -2 |
| 1.5 | -3 | -2.4 | -3 |

Below 0.8, reducing the probability further receives no additional benefit from this sample. Above 1.2, the worsening change is still penalized. Multiplication by a negative advantage reverses which clipped boundary creates the plateau:

```math
\ell(r,\widehat A)=\widehat A\max(r,1-\epsilon),
\qquad \widehat A<0.
```

The minimum in the original equation has not become a maximum by mistake. Factoring a negative number outside a minimum reverses the ordering of the terms inside it.

<div class="explainer" data-explainer="rl-ppo"></div>

## A plateau in the loss is not a wall around the policy

Away from the clipping boundary, the derivative with respect to the ratio is

```math
\frac{\partial\ell}{\partial r}=
\begin{cases}
0,&\widehat A>0\text{ and }r>1+\epsilon,\\
0,&\widehat A<0\text{ and }r<1-\epsilon,\\
\widehat A,&\text{otherwise}.
\end{cases}
```

The function has a corner at the relevant boundary, so the ordinary derivative is not unique there. When \(\widehat A=0\), this sample contributes zero everywhere.

A zero derivative on the favorable side means this sample stops pushing the ratio further in that direction. It does **not** clamp the policy probability. An optimizer step can cross the boundary, and gradients from other samples or shared-network losses can continue moving the same parameters.

For example, with old probability 0.25, an upper ratio threshold of 1.2 corresponds to probability 0.30. The objective can flatten beyond 0.30 while the actual probability still reaches 0.35. The ratio is then 1.4; PPO has not forcibly reset it to 1.2.

Clipping also does not impose a strict KL-divergence constraint between complete distributions. Monitoring policy change and limiting excessive optimization remain useful. A KL-based stopping rule is an additional training choice, not a mathematical consequence of clipping.

## Where the advantage estimates come from

PPO can use the GAE estimator introduced in [Part 8](/blog/rl-08-actor-critic/). For a rollout with rewards \(R_t\), compute residuals using the rollout critic:

```math
\delta_t=R_t+\gamma V_{\mathrm{old}}(s_{t+1})-V_{\mathrm{old}}(s_t),
\qquad
\widehat A_t=\delta_t+\gamma\lambda\widehat A_{t+1}.
```

The recursion runs backward within a rollout. At a true terminal transition, the next-state bootstrap is zero. At a collection boundary in a continuing episode, the next-state value is retained, but the trace does not cross into an unrelated reset episode. A common critic target is

```math
\widehat G_t=\widehat A_t+V_{\mathrm{old}}(s_t).
```

Keep these targets and advantages detached while updating the model. Otherwise the actor could change its own evaluation signal rather than improve the probability of actions with a fixed evaluation. Advantage normalization is a practical option; it is separate from the clipping definition.

With a squared value loss and entropy bonus, a combined minimized loss can be written as

```math
\mathcal L=-L^{\mathrm{clip}}
+c_v\widehat{\mathbb E}_t\left[
\frac12(V_\phi(s_t)-\operatorname{sg}(\widehat G_t))^2\right]
-c_H\widehat{\mathbb E}_t[H(\pi_\theta(\cdot\mid s_t))].
```

The minus sign converts the maximized policy objective into a minimized loss. The positive value coefficient fits returns; the negative entropy coefficient rewards uncertainty. Value clipping and other implementation variants should be identified separately rather than treated as part of this basic objective.

## Reusing a batch without moving its reference point

```algorithm
{"title":"PPO-Clip with a fixed rollout reference","inputs":"Rollout size; optimization epochs K; minibatch size; clipping width ε","lines":[[0,"**Repeat** for each rollout batch:"],[1,"Collect fresh trajectories with the current policy; save action log probabilities and value estimates."],[1,"Compute bootstrapped returns and advantage estimates; detach them."],[1,"**For** epoch 1 through K:"],[2,"Shuffle the rollout into minibatches."],[2,"**For** each minibatch:"],[3,"Evaluate current log probabilities, values, and entropy."],[3,"Form ratios against the unchanged saved log probabilities."],[3,"Compute the clipped policy objective and value loss."],[3,"Take an optimizer step on the combined minimized loss."],[1,"Discard the batch and collect new experience using the updated policy."]]}
```

Reusing a fresh batch for several epochs differs from keeping a long-lived replay buffer of trajectories from many past policies. PPO is commonly called on-policy in this collection-and-update sense, even though the policy changes during its optimization epochs.

## How the three methods fit together

| Method | Main mechanism in this series | Where the mismatch appears |
| --- | --- | --- |
| A3C | Workers collect rollouts and asynchronously apply local gradients | Other workers may update shared parameters before a local gradient arrives |
| IMPALA | Actors send experience to a learner using V-trace corrections | The learner's policy differs from the behavior policy that generated a trajectory |
| PPO-Clip | Repeatedly optimize a fresh batch with a clipped surrogate | The current policy moves away from the fixed policy that collected the batch |

IMPALA and PPO both compare action probabilities, but their clipping rules serve different purposes. V-trace constructs corrected value targets under policy lag. PPO-Clip limits a sample's incentive for a favorable policy change during batch reuse. One clipping formula should not be substituted for the other merely because both contain a ratio.

## Reference

Schulman et al., [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347), defines the clipped surrogate and batch optimization procedure. The sign-by-sign tables and adjustable curves above work through that objective directly.
