---
title: "Reinforcement Learning 8: Actor-Critic Methods and GAE"
date: "2025-06-08"
category: "Reinforcement Learning"
description: "Value baselines, temporal-difference advantages, and the effect of policy lag."
draft: false
source_url: "https://jaehoonstudy.tistory.com/67"
series: "Reinforcement Learning"
part: 8
---

The [previous article](/blog/rl-07-policy-gradients/) rewrote the gradient of expected return as an expectation involving action values and policy scores:

```math
J(\theta)=\mathbb{E}\left[\sum_{t=0}^{T-1}\gamma^tR_{t+1}\right],
```

```math
\nabla_\theta J(\theta)=\mathbb{E}\left[
\sum_{t=0}^{T-1}\gamma^tQ^{\pi_\theta}(S_t,A_t)
\nabla_\theta\log\pi_\theta(A_t\mid S_t)\right].
```

The remaining problem is that the true Q-value is unknown. Actor-critic methods introduce a **critic network** to approximate the quantity used to evaluate the action. The actor is the policy network whose parameters are improved using that evaluation.

The value-related term in front of the policy score will change across the methods below. The underlying task is to estimate that update signal as usefully as possible.

## Q actor-critic

First introduce a neural critic that directly approximates the policy's Q-function:

```math
Q_\phi(s,a)\approx Q^{\pi_\theta}(s,a).
```

The policy-gradient estimate then uses Q-phi in place of the true Q:

```math
\nabla_\theta J(\theta)\approx\mathbb{E}\left[
\sum_t\gamma^tQ_\phi(S_t,A_t)
\nabla_\theta\log\pi_\theta(A_t\mid S_t)\right].
```

There are now two parameter sets. **Phi belongs to the critic; theta belongs to the policy.** Updating the critic improves the evaluation, and updating the actor changes how actions are selected. Monte Carlo and TD targets provide two ways to train the critic.

### Monte Carlo critic updates

Wait until an episode finishes, then compute the return to go:

```math
G_t=\sum_{k=0}^{T-t-1}\gamma^kR_{t+k+1}.
```

The critic's error compares that return with its current estimate:

```math
\delta_t^{\mathrm{MC}}=G_t-Q_\phi(S_t,A_t).
```

A gradient step on half the squared error gives:

```math
\phi\leftarrow\phi+\beta\delta_t^{\mathrm{MC}}
\nabla_\phi Q_\phi(S_t,A_t).
```

Beta is the critic's learning rate. This is a regression update: fit the critic's prediction to the observed return. A sufficiently expressive, successfully optimized critic can approximate the value, but neural-network convergence is not automatic.

The actor uses the critic's estimate to weight its own update:

```math
\theta\leftarrow\theta+\alpha\gamma^t
\operatorname{stopgrad}(Q_\phi(S_t,A_t))
\nabla_\theta\log\pi_\theta(A_t\mid S_t).
```

Theta changes the policy, not the critic. The critic's value is a fixed weight for the actor update; the actor loss should not differentiate through that weight.

### TD critic updates

One-step TD avoids waiting for the complete episode. Observe the next reward and state, sample the next action from the current policy, and form:

```math
y_t=R_{t+1}+\gamma Q_\phi(S_{t+1},A_{t+1}),
\qquad
\delta_t^{\mathrm{TD}}=y_t-Q_\phi(S_t,A_t).
```

At termination, the next-state term is zero. The target is detached during the critic's update:

```math
\phi\leftarrow\phi+\beta\operatorname{stopgrad}(\delta_t^{\mathrm{TD}})
\nabla_\phi Q_\phi(S_t,A_t).
```

The actor can then use the critic in the same way as before. The distinction is the critic's training target: an observed complete return for MC, or one observed reward plus an estimated continuation for TD.

The two networks improve together. The critic supplies an evaluation of behavior; the actor changes behavior according to that evaluation.

## Advantage actor-critic

Consider a state where the estimated Q-values of many actions are nearly equal:

<figure><img src="/assets/posts/67-11.png" alt="Many action values are close together, with one action slightly higher than the others."><figcaption>Similar absolute Q-values can obscure the useful relative differences in a noisy sampled update. From the lecture notes used for this series.</figcaption></figure>

The largest value is still identifiable, but each sampled policy score is multiplied by a large, similar absolute value. The differences that distinguish better actions can be small relative to this common component and sampling noise.

This does not make learning impossible. It motivates a more efficient signal: **subtract a baseline and use how much better the action is than the state average**.

### Recall the advantage

```math
A^\pi(s,a)=Q^\pi(s,a)-V^\pi(s).
```

V is the expected return under the policy in the current state. Q fixes one action first. Their difference measures the action's relative benefit, removing the common baseline associated with being in that state.

An action-independent baseline does not change the expected policy gradient:

```math
\begin{aligned}
\sum_a\pi_\theta(a\mid s)b(s)\nabla_\theta\log\pi_\theta(a\mid s)
&=b(s)\nabla_\theta\sum_a\pi_\theta(a\mid s)\\
&=0.
\end{aligned}
```

The baseline must be treated as a baseline weight, not differentiated through as part of the actor objective. A suitable value baseline can reduce variance by centering the signal around the state's expected outcome.

### A Monte Carlo advantage estimate

Instead of learning a Q-network, learn a state-value critic V-phi. After completing an episode, form:

```math
\hat A_t=G_t-V_\phi(S_t).
```

The return estimates the selected action's outcome; the critic supplies the baseline. The value loss is:

```math
\mathcal{L}_V(\phi)=\frac12\sum_t[G_t-V_\phi(S_t)]^2.
```

The corresponding updates are:

```math
\phi\leftarrow\phi+\beta\sum_t[G_t-V_\phi(S_t)]\nabla_\phi V_\phi(S_t),
```

```math
\theta\leftarrow\theta+\alpha\sum_t\gamma^t
\operatorname{stopgrad}(\hat A_t)\nabla_\theta\log\pi_\theta(A_t\mid S_t).
```

The structural idea is that **the critic learns state value, and the actor uses return minus state value**. This is a Monte Carlo advantage actor-critic construction. The name A2C is also commonly used for a synchronous multi-step implementation; it should not be defined as exclusively full-episode Monte Carlo.

The architecture still consists of an actor producing action probabilities and a critic producing a value estimate. The environment's response supplies the rewards and observations used to update both.

<figure><a href="/assets/posts/67-18.png"><img src="/assets/posts/67-18.png" alt="An actor selects actions, the environment produces rewards, and sampled returns train the policy and state-value critic."></a><figcaption>Actor-critic architecture from <a href="https://wikidocs.net/169327">the schematic cited in the original notes</a>. The box labeled TDs uses return-minus-value residuals; it is not restricted to a one-step TD target. Open the figure to view it at full size.</figcaption></figure>

## TD advantage actor-critic

The Monte Carlo construction waits for Gₜ. The TD version keeps the state-value critic but replaces the complete return with a one-step target:

```math
y_t=R_{t+1}+\gamma V_\phi(S_{t+1}).
```

Subtracting the current-state baseline gives:

```math
\hat A_t=y_t-V_\phi(S_t)
=R_{t+1}+\gamma V_\phi(S_{t+1})-V_\phi(S_t).
```

This is exactly the TD error. **A one-step advantage estimate can therefore be obtained without learning a separate Q-function.**

With the true value function, the conditional expectation of this error given the current state and action is the true advantage. An approximate value function can introduce bias.

### Updating critic and actor

The critic fits the detached target:

```math
\mathcal{L}_V(\phi)=\frac12
[V_\phi(S_t)-\operatorname{stopgrad}(y_t)]^2,
```

```math
\phi\leftarrow\phi+\beta\operatorname{stopgrad}(\hat A_t)
\nabla_\phi V_\phi(S_t).
```

The actor uses the same error as its evaluation signal:

```math
\theta\leftarrow\theta+\alpha\gamma^t
\operatorname{stopgrad}(\hat A_t)
\nabla_\theta\log\pi_\theta(A_t\mid S_t).
```

The critic evaluates the outcome relative to its prediction, and the actor responds to that evaluation. A better-than-predicted transition increases the selected action's probability; a worse-than-predicted transition decreases it through the policy gradient.

The outer discount here follows the discounted start-state objective from the preceding article. Some practical implementations use a different sampling or objective convention and omit that explicit weight.

## Generalized advantage estimation

The same MC-versus-TD tradeoff appears again. One-step advantages rely heavily on the critic; complete-return advantages rely on long, variable trajectories. Generalized advantage estimation combines multiple horizons, much as TD(lambda) combines multi-step returns.

Let:

```math
\delta_t=R_{t+1}+\gamma V(S_{t+1})-V(S_t).
```

The one-step and two-step advantage estimates are:

```math
\hat A_t^{(1)}=\delta_t,
```

```math
\begin{aligned}
\hat A_t^{(2)}&=\delta_t+\gamma\delta_{t+1}\\
&=R_{t+1}+\gamma R_{t+2}+\gamma^2V(S_{t+2})-V(S_t).
\end{aligned}
```

The intermediate value terms cancel. Extending this calculation gives:

```math
\hat A_t^{(n)}=\sum_{l=0}^{n-1}\gamma^l\delta_{t+l}
=G_t^{(n)}-V(S_t).
```

Rather than select one horizon, exponentially weight the estimates. In the continuing formulation with lambda below one:

```math
\begin{aligned}
\hat A_t^{\mathrm{GAE}}
&=(1-\lambda)\sum_{n=1}^{\infty}\lambda^{n-1}\hat A_t^{(n)}\\
&=\sum_{l=0}^{\infty}(\gamma\lambda)^l\delta_{t+l}.
\end{aligned}
```

For an episode, the sum ends at termination. Lambda zero gives the one-step TD error. Lambda one telescopes to the full episodic return minus the current value, with zero terminal value. Intermediate choices balance short bootstrapped estimates with longer sampled ones.

This recovers the same conceptual progression as the value-learning chapter: one-step TD, multi-step targets, then a weighted mixture of horizons. The quantity being estimated here is the advantage used by the actor.

## Toward distributed training

Actor-critic methods maintain an evaluator and a policy that are updated together. The policy-gradient derivation made these sampled MC and TD signals usable for optimizing the actor.

Scaling to difficult environments introduces additional problems. Atari, robotic-control benchmarks such as MuJoCo, and complex strategy games can require large amounts of experience. A single collection process may become a bottleneck, and on-policy methods have limited freedom to reuse trajectories after the policy changes.

The throughput example in the lecture notes describes a single process producing only a few thousand transitions per second while a demanding task may require tens or hundreds of millions of frames. Those figures illustrate the scale mismatch rather than a universal hardware limit. The key issue is how much interaction and fresh data are required before learning becomes useful.

Reusing old trajectories without accounting for a changed policy can bias an on-policy gradient estimate. Thus collection throughput, variance, and the changing data distribution all matter when scaling up.

Distributing collection across multiple actors and learning across one or more learners increases throughput. It also introduces **policy lag**.

<figure><img src="/assets/posts/67-26.png" alt="Actor and learner pools exchange trajectories and parameters at different speeds."><figcaption>Policy lag in a distributed actor-learner architecture. Lecture notes by Sungwoong Kim, with annotations.</figcaption></figure>

Suppose a simulator starts collecting a trajectory using one version of the policy. While it runs, a learner may update the parameters two or three times. By the time the trajectory reaches the learner, the data-generating policy is older than the current policy.

The discrepancy comes from different collection and learning speeds. It motivates methods such as importance sampling and explicit corrections for off-policy data.

A3C uses asynchronous actor-critic workers and is generally described as on-policy despite parameter staleness. IMPALA explicitly handles actor-learner lag using V-trace. PPO constrains policy updates through a clipped surrogate; it is relevant to scalable policy optimization but was not simply introduced as a correction for distributed lag. These methods address related but distinct problems.

## The progression through the series

The series began with the meanings of state, reward, policy, and value. Bellman equations then made the future recursive. Dynamic programming used a known model, while MC and TD replaced that model with experience. SARSA, Q-learning, and DQN developed value-based control. Policy gradients then moved to directly optimizing the policy, and actor-critic methods introduced learned evaluations for those updates.

The most useful thread is not a list of algorithm names but **why each new method is needed and which part of the previous method it changes**. Distributed training, AlphaGo, and AlphaZero provide further directions beyond this foundation.

## References

- Lilian Weng, [A (Long) Peek into Reinforcement Learning](https://lilianweng.github.io/posts/2018-02-19-rl-overview/).
- Actor-critic explanations draw on lecture notes by Sungwoong Kim; the GAE discussion also follows material by Sungjoon Choi.
- Schulman et al., [Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438).
- Mnih et al., [Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783).
- Espeholt et al., [IMPALA](https://arxiv.org/abs/1802.01561).
- Schulman et al., [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347).
