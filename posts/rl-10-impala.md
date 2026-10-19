---
title: "Reinforcement Learning 10: IMPALA and V-trace"
date: "2026-10-20"
category: "Reinforcement Learning"
description: "Why policy lag needs correction, how V-trace works backward, and why its two clipping weights have different jobs."
draft: false
series: "Reinforcement Learning"
part: 10
---

[A3C](/blog/rl-09-a3c/) workers both interact with environments and compute gradients. IMPALA separates these jobs. Actors produce trajectories; a learner consumes those trajectories and updates the network. Actors periodically obtain newer parameters from the learner.

This separation creates **policy lag**. By the time a trajectory reaches the learner, the policy that produced it may already be outdated. V-trace is the return estimator used to account for that mismatch.

## Two policies for one recorded action

Write the actor's behavior policy as \(\mu\) and the learner's target policy as \(\pi\). Both can assign a probability to the same recorded action at the same recorded state.

```math
w_t=\frac{\pi(a_t\mid s_t)}{\mu(a_t\mid s_t)}.
```

Suppose the actor chose Right with probability 0.2, while the learner now assigns Right probability 0.6. The ratio is 3. The action is three times as likely under the target policy, so it should receive more weight when estimating an expectation for that policy.

At a fixed state, this comes directly from cancellation:

```math
\mathbb E_{a\sim\mu}[w(a)f(a)]
=\sum_a\mu(a)\frac{\pi(a)}{\mu(a)}f(a)
=\sum_a\pi(a)f(a).
```

The behavior policy must give nonzero probability to actions the target policy may take. Otherwise, missing actions cannot be recovered by reweighting observed samples.

This identity corrects the action expectation at a given state. It does not by itself say that the state distribution of an entire replayed trajectory becomes the current policy's state distribution.

## Why multiplying all the ratios is troublesome

A trajectory contains a sequence of sampled actions. A straightforward full-trajectory importance weight involves a product of their ratios. Even moderate factors can accumulate dramatically: ten ratios of 3 produce \(3^{10}=59{,}049\), while ten ratios of 0.5 produce about \(0.000977\).

These are arithmetic examples, not typical measured ratios. They show why a few trajectories can dominate an estimator, while many others contribute almost nothing. V-trace controls this effect through clipped weights applied to TD corrections.

## Start with an ordinary TD error

Use \(r_t\) for the reward after action \(a_t\). The uncorrected TD residual is

```math
d_t=r_t+\gamma V(s_{t+1})-V(s_t).
```

This asks how far the one-step reward-plus-bootstrap prediction lies above the current value. V-trace first scales that residual by a clipped importance ratio:

```math
\rho_t=\min(\bar\rho,w_t),\qquad
\delta_t=\rho_t d_t.
```

The quantity \(\rho_t\) controls the correction made **at transition t**. A second coefficient controls how far later corrections travel backward:

```math
c_t=\min(\bar c,w_t),\qquad 0\leq\bar c\leq\bar\rho.
```

The letters have different jobs even when their clipping thresholds happen to be equal.

## Reading the V-trace equation one term at a time

For a rollout ending at index \(s+n\), the target is

```math
v_s=V(s_s)+\sum_{t=s}^{s+n-1}
\gamma^{t-s}\left(\prod_{i=s}^{t-1}c_i\right)\delta_t.
```

Here the subscript on \(s_t\) indexes states; the scalar \(v_s\) is the corrected target at the starting index. The empty product for \(t=s\) equals 1. Expanding three terms removes much of the notation:

```math
v_0=V(s_0)+\delta_0+\gamma c_0\delta_1
+\gamma^2c_0c_1\delta_2.
```

Begin with the critic's current guess. Add the current corrected error without a trace coefficient. Then add the next error after one discount and one trace coefficient. The error two steps away passes through two of each.

Notice that \(c_2\) is absent from the final term. It would gate corrections arriving from after transition 2; it does not gate transition 2's own residual. That residual is weighted by \(\rho_2\).

## A complete numerical example

Take a terminal three-transition rollout with rewards \([1,0,2]\), values \([0.5,0.8,0.4,0]\), discount \(0.9\), and ratios \([2,0.5,1.5]\). Set both thresholds to 1.

| t | Raw residual \(d_t\) | \(\rho_t\) | \(c_t\) | Corrected residual \(\delta_t\) |
| --- | --- | --- | --- | --- |
| 0 | \(1+0.9(0.8)-0.5=1.22\) | 1 | 1 | 1.22 |
| 1 | \(0+0.9(0.4)-0.8=-0.44\) | 0.5 | 0.5 | -0.22 |
| 2 | \(2+0.9(0)-0.4=1.6\) | 1 | 1 | 1.6 |

The corrections reaching the first state are therefore

```math
v_0=0.5+1.22+0.9(1)(-0.22)
+0.9^2(1)(0.5)(1.6)=2.17.
```

The first ratio was 2, but its immediate error was multiplied by only 1. The final error was also multiplied by 1 locally, then reduced by the intermediate trace coefficient 0.5 as it traveled backward.

<div class="explainer" data-explainer="rl-vtrace"></div>

## The same calculation as a backward recursion

The expanded sum can be evaluated without repeatedly forming products:

```math
v_s=V(s_s)+\delta_s+\gamma c_s
\left(v_{s+1}-V(s_{s+1})\right).
```

Initialize the endpoint to its critic value, or zero at a true terminal state. The difference inside parentheses is the **correction** already accumulated at the next state. Multiplying that correction by \(\gamma c_s\) propagates it backward.

For the example:

```math
\begin{aligned}
v_3&=0,\\
v_2&=0.4+1.6+0.9(1)(0-0)=2,\\
v_1&=0.8-0.22+0.9(0.5)(2-0.4)=1.3,\\
v_0&=0.5+1.22+0.9(1)(1.3-0.8)=2.17.
\end{aligned}
```

Subtracting \(V(s_{s+1})\) matters. The one-step residual already contains that bootstrap value. Adding the entire \(v_{s+1}\) again would count part of the future twice.

## When the policies match

If \(\mu=\pi\) and both thresholds are at least 1, then \(\rho_t=c_t=1\). Substituting into the recursion gives

```math
\begin{aligned}
v_s&=V(s_s)+r_s+\gamma V(s_{s+1})-V(s_s)
+\gamma(v_{s+1}-V(s_{s+1}))\\
&=r_s+\gamma v_{s+1}.
\end{aligned}
```

The current and next critic terms cancel. Repeating this backward produces the usual n-step return. With the terminal rewards above, that is \(1+0.9(0)+0.81(2)=2.62\).

This cancellation is a useful implementation check: feeding unit ratios with unit clipping thresholds should recover ordinary return targets.

## Why the two clipping thresholds are not interchangeable

Clipping \(\rho\) changes which policy's value is the fixed point of the V-trace operator. Under the paper's tabular assumptions, that policy is

```math
\pi_{\bar\rho}(a\mid s)=
\frac{\min(\bar\rho\mu(a\mid s),\pi(a\mid s))}
{\sum_b\min(\bar\rho\mu(b\mid s),\pi(b\mid s))}.
```

For example, let \(\mu=[0.2,0.8]\), \(\pi=[0.6,0.4]\), and \(\bar\rho=1\). The unnormalized entries become \([0.2,0.4]\), and normalization gives \([1/3,2/3]\). The fixed-point policy is no longer exactly \([0.6,0.4]\). Increasing the threshold until no ratio is clipped recovers the target policy.

The trace coefficients \(c\) instead control the influence of distant errors, affecting variance and convergence behavior without changing that fixed point under the operator's assumptions. Smaller trace coefficients shorten the effective correction horizon. These tabular statements are not a guarantee that an arbitrary neural learner will converge.

## What the actor and critic optimize

The critic fits a detached V-trace target. The actor uses a corrected next-state target to estimate the sampled action's advantage:

```math
q_s=r_s+\gamma v_{s+1},\qquad
\widehat A_s=q_s-V(s_s).
```

Its update direction includes

```math
\rho_s\nabla_\theta\log\pi_\theta(a_s\mid s_s)
\operatorname{sg}(\widehat A_s).
```

When implementing this direction as a loss, detach the correction weight as well as the advantage; the displayed gradient does not include derivatives through \(\rho_s\) or the return construction. An entropy term can encourage exploration, as in A3C.

The behavior probability must be the probability at collection time. Replacing it with a probability from the current actor would erase the very mismatch being measured. Log probabilities allow ratios to be computed as \(\exp(\log\pi-\log\mu)\).

```algorithm
{"title":"An IMPALA learner update","inputs":"Actor trajectories with behavior log probabilities; discount γ; clipping thresholds","lines":[[0,"Evaluate current policy probabilities and values on the received trajectories."],[0,"Compute importance ratios using the stored behavior probabilities."],[0,"Compute clipped residual weights and trace coefficients."],[0,"Set the endpoint target to the bootstrap value, or zero at a true terminal state."],[0,"**For** transitions in reverse temporal order:"],[1,"Compute the corrected TD residual."],[1,"Propagate the next state's value correction backward using the V-trace recursion."],[0,"Fit the critic to detached V-trace targets."],[0,"Update the actor using detached corrected advantages and importance weights, with entropy regularization."],[0,"Make updated parameters available to actors."]]}
```

V-trace makes policy lag manageable; it does not make unlimited lag harmless. Queue length, actor refresh frequency, and learner throughput still affect how different the two policies become.

The next chapter, [PPO](/blog/rl-11-ppo/), also uses a probability ratio. Its main purpose is different: controlling the incentive to change a policy while repeatedly optimizing a freshly collected batch.

## Reference

Espeholt et al., [IMPALA: Scalable Distributed Deep-RL with Importance Weighted Actor-Learner Architectures](https://arxiv.org/abs/1802.01561), provides the actor-learner architecture, V-trace operator, and fixed-point analysis. The tables and adjustable example above expose the individual arithmetic steps of that operator.
