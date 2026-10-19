---
title: "Reinforcement Learning 4: Monte Carlo, TD Learning, and Eligibility Traces"
date: "2025-05-27"
category: "Reinforcement Learning"
description: "Learning values from sampled returns, bootstrapped targets, and multi-step credit assignment."
draft: false
source_url: "https://jaehoonstudy.tistory.com/63"
series: "Reinforcement Learning"
part: 4
---

Dynamic programming requires an environment model. To move beyond that assumption, the agent must explore and update its estimates from the trajectories it actually experiences. Instead of calculating every possible branch, it samples a route through the environment.

The update equations now take a common form:

```math
\text{new estimate}=\text{old estimate}
+\alpha(\text{target}-\text{old estimate}).
```

The target includes information from new experience. Alpha determines how much of that information is incorporated. One new experience need not be optimal or representative; updating gradually avoids replacing the entire estimate with one possibly unusual outcome.

The first distinction is how the target is constructed:

- **Monte Carlo:** follow a route to the end, then use its return.
- **Temporal difference:** take a step, then use the reward and an estimate of what follows.

SARSA and Q-learning, introduced in the next article, are TD control methods. Their difference concerns whether the target follows the current policy or a different policy.

## Monte Carlo methods

Monte Carlo waits for an episode to reach a terminal state. A complete trajectory under a policy has the form:

```math
\tau=(S_0,A_0,R_1,S_1,A_1,R_2,\ldots,S_{T-1},A_{T-1},R_T,S_T).
```

The return from time t is:

```math
G_t=R_{t+1}+\gamma R_{t+2}+\cdots+\gamma^{T-t-1}R_T.
```

Recall that a state value is an expectation:

```math
V^\pi(s)=\mathbb{E}_\pi[G_t\mid S_t=s].
```

The model is unknown, so that expectation cannot be calculated by summing known transition probabilities. **Monte Carlo replaces the expectation with an empirical average of observed returns.**

Sample episodes under one policy. For a state s, collect the return following its first visit in each episode that visits it, then average those returns:

```math
\hat{V}(s)=\frac{1}{N(s)}\sum_{i=1}^{N(s)}G^{(i)}(s).
```

N(s) counts the relevant visits, rather than episodes that never encountered the state. Each return is an observation of how valuable following the policy from that state turned out to be.

### A two-trajectory example

Suppose two trajectories under the same policy visit state 1 and then state 2 before terminating. Set gamma to one so the rewards can simply be added.

| Episode | Rewards after state 1 and state 2 | Return from state 1 | Return from state 2 |
| --- | --- | --- | --- |
| 1 | 1, 2 | 1 + 2 = 3 | 2 |
| 2 | 3, 4 | 3 + 4 = 7 | 4 |

The state-value estimates are:

```math
\hat{V}(s_1)=\frac{3+7}{2}=5,\qquad
\hat{V}(s_2)=\frac{2+4}{2}=3.
```

The defining feature is not the arithmetic average alone. It is that **the target is the full return**, so each trajectory must finish before its target is available.

An incremental update writes the same process as:

```math
V(S_t)\leftarrow V(S_t)+\alpha[G_t-V(S_t)].
```

Choosing alpha as the reciprocal of the visit count yields a sample average. A constant alpha instead weights recent returns more heavily.

### From prediction to control

Prediction estimates the value of a policy. Control improves the policy using those estimates. For model-free control, estimate action values from returns following state-action pairs:

```math
\hat{Q}(s,a)=\frac{1}{N(s,a)}\sum_{i=1}^{N(s,a)}G^{(i)}(s,a).
```

The policy can then be improved toward actions with larger estimated Q-values. Exploration must be retained so that actions that currently look poor are not permanently excluded before they are adequately evaluated.

The greedy improvement step can be written explicitly:

```math
\pi_{n+1}(s)\in\operatorname*{arg\,max}_a\hat Q_n(s,a).
```

Repeat return estimation and policy improvement, retaining sufficient exploration. This is the prediction-and-control cycle applied to Monte Carlo samples.

Monte Carlo waits for the full episode. TD changes the target so an update can be made immediately after the next transition.

## Temporal-difference learning

Temporal-difference learning uses an incomplete episode. It combines an observed reward with an existing estimate of future value. This combination of sampling and bootstrapping is one of reinforcement learning's central ideas.

### TD(0)

Compare the Monte Carlo update above with the one-step TD update:

```math
V(S_t)\leftarrow V(S_t)+\alpha
\left[R_{t+1}+\gamma V(S_{t+1})-V(S_t)\right].
```

Only the target has changed. Gₜ is replaced by the next reward plus the discounted next-state estimate. The agent takes one step and updates immediately. At a true terminal state, the next-state value is zero.

The difference between target and estimate is the TD error:

```math
\delta_t=R_{t+1}+\gamma V(S_{t+1})-V(S_t).
```

## The bias-variance tradeoff

Before introducing further TD methods, it is useful to understand why so many methods combine Monte Carlo and one-step TD. Waiting until the end and looking only one step ahead are two extremes. Intermediate methods try to balance their weaknesses.

<figure><img src="/assets/posts/63-14.png" alt="Targets around a bullseye illustrate low or high bias and low or high variance."><figcaption>Bias concerns systematic displacement from the target; variance concerns the spread of estimates.</figcaption></figure>

High bias means the expected estimate is displaced from the true value. High variance means estimates vary substantially across samples. Both matter when the environment model is unknown and sampled targets stand in for the true value.

### Monte Carlo: a complete but variable return

Monte Carlo adds every reward until the end:

```math
G_t=\sum_{k=0}^{T-t-1}\gamma^kR_{t+k+1}.
```

A stochastic policy and uncertain transitions create many opportunities for the outcome to vary. The intuition is similar to repeatedly rolling dice: the sum can differ substantially from one sequence to another. Long sampled trajectories can therefore produce a high-variance target.

Nevertheless, under a fixed policy, the expected sampled return is the value being estimated:

```math
\mathbb{E}[G_t\mid S_t=s]=V^\pi(s).
```

The sample average is also unbiased:

```math
\mathbb{E}\left[\frac1N\sum_{i=1}^NG^{(i)}(s)\right]
=\frac1N\sum_{i=1}^N\mathbb{E}[G^{(i)}(s)]=V^\pi(s).
```

Unbiasedness concerns the expectation over samples. It does not mean that any single completed episode gives the correct value.

### TD: a shorter target with an estimated continuation

TD uses:

```math
R_{t+1}+\gamma V(S_{t+1}).
```

Only one transition is sampled before the remaining future is replaced with an estimate. This often reduces variance, but an inaccurate next-state estimate can bias the target.

The important source of bias is **bootstrapping from an imperfect value**, rather than the mere fact that only one step was observed. If V is exactly the policy's true value, the Bellman equation makes the target unbiased. Similarly, “lower variance” is a common practical comparison, not a theorem covering every environment.

This tradeoff motivates looking farther than one step without necessarily waiting for the entire episode.

## n-step TD

Choose a number n, observe n rewards, and then bootstrap:

```math
G_t^{(n)}=R_{t+1}+\gamma R_{t+2}+\cdots
+\gamma^{n-1}R_{t+n}+\gamma^nV(S_{t+n}).
```

The update becomes:

```math
V(S_t)\leftarrow V(S_t)+\alpha[G_t^{(n)}-V(S_t)].
```

The target waits n steps rather than one or an entire episode. If termination occurs first, it uses the available rewards and omits the bootstrap term. This provides an intermediate point between TD(0) and Monte Carlo, but introduces another question: which n should be chosen?

## TD(lambda) and eligibility traces

Instead of choosing a single horizon, TD(lambda) combines returns from multiple horizons with decaying weights. Lambda controls the mixture. It lies between zero and one: zero recovers one-step TD, while approaching one gives increasing weight to long returns and reaches Monte Carlo in the episodic limit.

**TD(lambda) specifies the desired return. Eligibility traces provide a backward-looking way to distribute its updates.**

### The forward view

For an episode ending at T, the lambda return is:

```math
G_t^\lambda=(1-\lambda)\sum_{n=1}^{T-t-1}\lambda^{n-1}G_t^{(n)}
+\lambda^{T-t-1}G_t.
```

The early terms mix one-step, two-step, and longer returns. The final term assigns the remaining weight to the complete return. For a continuing task and lambda below one, the corresponding expression is an infinite weighted sum of n-step returns.

For a continuing task, the forward-view expression is:

```math
G_t^\lambda=(1-\lambda)\sum_{n=1}^{\infty}\lambda^{n-1}G_t^{(n)},
\qquad 0\le\lambda<1.
```

The weights sum to one. Lambda replaces a hard choice of one horizon with a weighted mixture of all horizons; it still remains a parameter to choose. The episodic formula above handles the final full return explicitly as lambda approaches one.

Direct computation has practical difficulties. Each n-step return requires waiting for its future rewards. Those returns must then be weighted and added, and this process is repeated for every starting time in the episode. A literal implementation stores future information and performs many overlapping calculations.

It is called the **forward view** because the target at a state looks forward to rewards and values that have not yet arrived.

### The backward view

An eligibility trace records how recently and frequently a state was visited. Recent visits receive more weight; older visits decay. Repeated visits can accumulate eligibility.

```math
e_t(s)=\gamma\lambda e_{t-1}(s)+\mathbf{1}[s=S_t].
```

At each step, every trace decays by gamma times lambda, and the current state's trace receives an increment of one. Compute the ordinary one-step TD error and distribute it over the traces:

```math
\delta_t=R_{t+1}+\gamma V(S_{t+1})-V(S_t),
```

```math
V(s)\leftarrow V(s)+\alpha\delta_t e_t(s)
\qquad\text{for every state }s.
```

The left side is V(s), not only the value of the currently visited state. **One new TD error can update earlier states in proportion to how eligible they remain.** This is why the method is a backward view.

### Example: one transition updates A, B, and C

Suppose the current state is C, the next state is D, gamma is one, and alpha is 0.1. Let V(C) = 1, V(D) = 2, and the reward for the transition be 1.

```math
\text{target}=1+2=3,\qquad\delta_t=3-1=2.
```

Only C and D were needed to calculate this one-step error. Now suppose the last three visited states were A, B, and C, and lambda is 0.8. Starting with zero traces:

| Time | State visited | Trace of A | Trace of B | Trace of C |
| --- | --- | --- | --- | --- |
| t − 2 | A | 1 | 0 | 0 |
| t − 1 | B | 0.8 | 1 | 0 |
| t | C | 0.64 | 0.8 | 1 |

The error is then distributed as follows:

```math
\begin{aligned}
\Delta V(A)&=0.1(2)(0.64)=0.128,\\
\Delta V(B)&=0.1(2)(0.8)=0.160,\\
\Delta V(C)&=0.1(2)(1)=0.200.
\end{aligned}
```

The resulting values, rather than just their increments, are:

```math
V_{\mathrm{new}}(A)=V_{\mathrm{old}}(A)+0.128,\qquad
V_{\mathrm{new}}(B)=V_{\mathrm{old}}(B)+0.160,
```

```math
V_{\mathrm{new}}(C)=1+0.200=1.200.
```

Although the observed transition was only C to D, earlier states also receive incremental updates. States with zero eligibility receive none.

Under the appropriate offline or fixed-weight conditions, the accumulated backward-view updates correspond to the forward-view lambda return. Conventional online TD(lambda), where values change during an episode, is not automatically identical to a frozen forward-view calculation. The essential intuition remains that traces distribute new information backward without explicitly recomputing every future return.

<div class="explainer" data-explainer="rl-traces"></div>

The next article moves from prediction to control, comparing the on-policy SARSA update with off-policy Q-learning.


## Reference

Lilian Weng, [A (Long) Peek into Reinforcement Learning](https://lilianweng.github.io/posts/2018-02-19-rl-overview/).
