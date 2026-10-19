---
title: "Reinforcement Learning 9: A3C and Asynchronous Learning"
date: "2026-10-20"
category: "Reinforcement Learning"
description: "Local workers, n-step returns, and why an asynchronous actor-critic update can be stale."
draft: false
series: "Reinforcement Learning"
part: 9
---

[Actor-critic methods](/blog/rl-08-actor-critic/) combine a policy that chooses actions with a value function that evaluates their consequences. A3C keeps that basic relationship and changes how experience and gradients are produced: several workers interact with their own environments and update shared parameters asynchronously.

The name expands to **Asynchronous Advantage Actor-Critic**. “Advantage” identifies the actor's learning signal. “Asynchronous” identifies the coordination rule. These are separate ideas: an advantage estimator does not itself require multiple workers.

## What each worker owns

Suppose three workers explore three copies of the same task. Their observations and actions need not match. One may be near the beginning of an episode while another has just reached a terminal state.

| Component | Responsibility |
| --- | --- |
| Shared parameters | Hold the current policy and value network weights |
| Worker-local parameters | Supply a consistent policy and critic during a short rollout |
| Worker environment | Produce that worker's observations, actions, and rewards |
| Worker gradients | Carry learning signals back to the shared parameters |

A worker copies the shared weights, collects a short sequence, computes gradients locally, and applies those gradients to the shared weights. It then copies the updated shared weights and repeats. It does not wait for every other worker to finish the same stage.

Different trajectories help reduce the correlation that would arise from training only on consecutive observations from one environment. The original A3C design uses this parallel experience without DQN's replay buffer. This does not make individual trajectories independent or remove every source of instability.

## Turning a short rollout into a return

Use \(r_t\) for the reward observed after action \(a_t\) in state \(s_t\). Let \(V_\phi(s)\) be the critic. If a worker collects \(n\) transitions without reaching a terminal state, it estimates the return from the first state as

```math
G_t^{(n)}=\sum_{k=0}^{n-1}\gamma^k r_{t+k}
+\gamma^n V_\phi(s_{t+n}).
```

The first term is observed experience. The final term estimates everything beyond the rollout boundary. The discount on that estimate is \(\gamma^n\) because the boundary lies \(n\) transitions away.

Ending a **rollout** is different from ending an **episode**. A worker may stop collecting because its buffer is full even though the environment continues. In that case, the future still matters. At a true terminal state, there is no future return, so the final value is zero.

Consider three rewards \([1,0,2]\), discount \(0.9\), and a final critic prediction of \(3\):

```math
G_0^{(3)}=1+0.9(0)+0.9^2(2)+0.9^3(3)
=1+0+1.62+2.187=4.807.
```

If the third transition instead ends the episode, the last term disappears and the target becomes \(2.62\). No observed reward changed. Only the claim about what comes after the final observation changed.

<div class="explainer" data-explainer="rl-nstep"></div>

## Why the return is computed backward

Recomputing a separate sum for every state is unnecessary. Start at the end of the rollout and repeatedly apply

```math
R\leftarrow r_i+\gamma R.
```

For the same nonterminal example, initialize \(R=3\). The successive values are:

| State being evaluated | Backward calculation | Return target |
| --- | --- | --- |
| \(s_2\) | \(2+0.9(3)\) | \(4.7\) |
| \(s_1\) | \(0+0.9(4.7)\) | \(4.23\) |
| \(s_0\) | \(1+0.9(4.23)\) | \(4.807\) |

The first state receives a three-step target, the second a two-step target, and the third a one-step target. All three use the same endpoint bootstrap. “An n-step rollout” therefore does not mean every transition in its loss uses exactly n observed rewards.

Longer returns replace more critic predictions with observed rewards, but those rewards introduce sampling variability. Shorter returns depend more heavily on the critic. This is the same bootstrap-versus-sampling tradeoff encountered in TD and Monte Carlo learning.

## From the return to two different losses

The worker's advantage estimate is

```math
\widehat A_i=G_i-V_\phi(s_i).
```

If \(V_\phi(s_0)=2\), the example gives \(\widehat A_0=4.807-2=2.807\). The observed continuation was better than the critic expected. A positive advantage increases the log probability of the sampled action; a negative advantage decreases it.

Writing losses to **minimize**, a useful expression is

```math
\mathcal L_{\mathrm{actor}}
=-\sum_i\log\pi_\theta(a_i\mid s_i)\,
\operatorname{sg}(\widehat A_i)
-\beta\sum_i H(\pi_\theta(\cdot\mid s_i)),
```

```math
\mathcal L_{\mathrm{critic}}
=\frac12\sum_i\left(V_\phi(s_i)-\operatorname{sg}(G_i)\right)^2.
```

Here \(\operatorname{sg}\) means stop-gradient: use the number as a target or weight without differentiating through its construction. The actor should learn which action to favor, rather than reduce its loss by modifying the critic inside the advantage. The critic should fit the return target, rather than move the bootstrapped target while fitting it.

For discrete actions, entropy is

```math
H(\pi)=-\sum_a\pi(a\mid s)\log\pi(a\mid s).
```

Its negative sign in the minimized actor loss encourages higher entropy when \(\beta>0\). It discourages prematurely concentrating all probability on one action; it does not guarantee useful exploration.

Policy and value heads may share a feature network. Stop-gradient on the advantage does not prevent the actor and critic losses from both updating those shared features through their intended paths.

## What exactly becomes stale?

Imagine a worker copies parameter version 10. While it collects experience, other workers advance the shared network to version 13. Its gradient was computed using version 10, but it is applied to version 13.

The gradient has not been recomputed at the current shared parameters. This is the source of **stale gradients**.

For a concrete one-parameter example, let the probability of Right be \(p=\operatorname{sigmoid}(\theta)\). For a sampled Right action,

```math
\frac{\partial\log p}{\partial\theta}=1-p.
```

If the local policy has \(p=0.2\), this score is \(0.8\). If the shared policy has already moved to \(p=0.7\), its current score would be \(0.3\). With a fixed positive advantage of 1, applying the old gradient uses 0.8, not 0.3. This example isolates staleness; real updates also involve state distributions, changing advantages, and many parameters.

A3C is usually described as on-policy because each worker learns from fresh experience generated by its local policy. That description should not hide the asynchronous mismatch at the shared parameters. A3C does not explicitly correct this mismatch with the importance ratios used by IMPALA.

## A worker's training procedure

```algorithm
{"title":"An A3C worker","inputs":"Shared policy and critic parameters; rollout limit n; discount γ","lines":[[0,"**Repeat** until training ends:"],[1,"Copy shared parameters into the worker's local policy and critic."],[1,"Collect up to n transitions using the local policy; stop early at a terminal state."],[1,"Set R = 0 at a true terminal endpoint; otherwise use the local critic's endpoint value."],[1,"Clear accumulated local gradients."],[1,"**For** transitions in reverse temporal order:"],[2,"Set $R \\leftarrow r_i + \\gamma R$."],[2,"Form the detached advantage $R - V(s_i)$."],[2,"Accumulate policy, value, and entropy-loss gradients."],[1,"Apply the local gradients to the shared parameters asynchronously."]]}
```

For a time-limit truncation, use the final observation's value when the underlying task is continuing. Do not accidentally bootstrap from the reset observation of the next episode. A true finite-horizon task requires its own terminal semantics, including remaining time in the state when necessary.

## A3C, A2C, and the next bottleneck

A synchronous alternative waits for workers, combines their batches, and performs a coordinated update. This is the central coordination difference associated with A2C. It does not require a different definition of advantage.

Asynchronous workers avoid a global wait at each update, but they also complicate reproducibility and can apply increasingly stale gradients. Adding more workers is therefore not automatically beneficial.

There is another architectural choice: let actors generate experience while a separate learner computes all gradients. That makes centralized accelerator training possible, but introduces a new mismatch between the policy that generated the data and the policy being trained. [IMPALA](/blog/rl-10-impala/) addresses that problem with V-trace.

## Reference

The algorithm and asynchronous architecture follow Mnih et al., [Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783), especially the actor-critic description and Algorithm S3. The numerical examples above are small worked examples for tracing the calculations.
