---
title: "Reinforcement Learning 6: Deep Q-Networks"
date: "2025-06-01"
category: "Reinforcement Learning"
description: "Neural action-value functions, experience replay, and frozen target networks."
draft: false
source_url: "https://jaehoonstudy.tistory.com/65"
series: "Reinforcement Learning"
part: 6
---

The previous article ended with the Q-learning update:

```math
Q(S_t,A_t)\leftarrow Q(S_t,A_t)+\alpha
\left[R_{t+1}+\gamma\max_{a'}Q(S_{t+1},a')-Q(S_t,A_t)\right].
```

Its target follows the next action with the largest estimated value, independently of the current behavior policy. This raises a practical question: **where do all those Q-values come from, and how can they be compared?**

Tabular Q-learning stores and updates a table of state-action values. As the state and action spaces grow, maintaining that table becomes impractical. A parameterized function can instead approximate the values, and a neural network is a natural choice for learning a nonlinear function.

```math
Q(s,a)\approx Q(s,a;\theta).
```

The parameters replace separate table entries with a function shared across observations. Standard DQN still assumes a manageable discrete action set, so its outputs can be compared to obtain a maximum. It does not directly solve maximization over arbitrary continuous actions.

## Deep Q-Networks

DeepMind's [Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) demonstrates this approach in Atari games. DQN provides a useful final step in the value-based part of this series: learn state-action values, then select actions from those values.

The paper emphasizes that an exact action-value calculation for every possible state is impractical. A neural function approximator supplies Q-values instead.

## DQN function approximation

The Q-network can be trained by minimizing a squared prediction error. For iteration i, write:

```math
L_i(\theta_i)=\mathbb{E}_{(s,a)\sim\rho}
\left[(y_i(s,a)-Q(s,a;\theta_i))^2\right],
```

where the expected target is:

```math
y_i(s,a)=\mathbb{E}_{r,s'\mid s,a}
\left[r+\gamma\max_{a'}Q(s',a';\theta_{i-1})\right].
```

The interpretation is a regression problem over experienced state-action pairs: compare the current Q estimate with a reward-plus-continuation target and reduce the difference.

For sampled transitions, it is convenient to use half the squared error and treat the target as fixed during differentiation:

```math
\ell_i=\frac12[Q(s,a;\theta_i)-\operatorname{stopgrad}(y_i)]^2,
```

```math
\nabla_{\theta_i}\ell_i=
[Q(s,a;\theta_i)-y_i]\nabla_{\theta_i}Q(s,a;\theta_i).
```

For the original expected squared loss, differentiating before sampling gives:

```math
\nabla_{\theta_i}L_i
=2\mathbb E_{(s,a)\sim\rho}
\left[(Q(s,a;\theta_i)-y_i(s,a))\nabla_{\theta_i}Q(s,a;\theta_i)\right].
```

Substituting the target expectation gives the transition-sampled form:

```math
\nabla_{\theta_i}L_i
=2\mathbb E_{(s,a)\sim\rho,\,(r,s')\sim p(\cdot\mid s,a)}
\left[\left(Q(s,a;\theta_i)-r-\gamma\max_{a'}Q(s',a';\theta_{i-1})\right)
\nabla_{\theta_i}Q(s,a;\theta_i)\right].
```

The target parameters are held fixed in this derivative. With half-squared loss, the factor two disappears. Gradient descent subtracts this expression; equivalently, the update adds a target-minus-prediction residual times the Q-gradient. This explains the sign and scaling differences between a loss gradient and an ascent-style update direction.

Two details deserve attention: **the distribution rho under the expectation**, and **the older parameters used in the target**. They lead to experience replay and target-network stabilization.

The original 2013 formulation uses earlier parameters in describing its target. The separate network frozen for multiple updates is the standard formulation developed in the later [2015 DQN paper](https://doi.org/10.1038/nature14236). Keeping that distinction avoids treating the two descriptions as identical implementations.

## Experience replay

### What distribution is being averaged over?

A finite replay buffer stores transitions:

```math
\mathcal{D}=\{(s_i,a_i,r_i,s'_i,d_i)\}_{i=1}^{N}.
```

Here d records true termination. Once the buffer reaches its capacity, new transitions replace older ones. Uniform sampling from it defines an empirical distribution over stored transitions:

```math
\hat{\rho}_{\mathcal{D}}(s,a,r,s',d)=\frac1N
\sum_{i=1}^{N}\mathbf{1}[(s_i,a_i,r_i,s'_i,d_i)=(s,a,r,s',d)].
```

The indicator counts matching records, and division by N turns the count into a frequency. A minibatch approximates the replay expectation:

```math
L_{\mathrm{batch}}(\theta)=\frac1B\sum_{j=1}^{B}
\frac12[y_j-Q(s_j,a_j;\theta)]^2,
```

```math
y_j=r_j+\gamma(1-d_j)\max_{a'}Q(s'_j,a';\theta^-).
```

The target network parameters theta-minus will be explained below. For a terminal transition, the target is just the reward.

### Breaking correlation

Neural-network training benefits from representative, sufficiently well-behaved gradient samples. Consecutive online transitions can be highly correlated:

```math
(S_t,A_t,R_{t+1},S_{t+1}),\quad
(S_{t+1},A_{t+1},R_{t+2},S_{t+2}),\quad\ldots
```

The next experience often differs only slightly from the previous one. Training exclusively on that narrow sequence repeatedly exposes the network to similar states and can make updates unstable.

Replay separates the order of collection from the order of training. Transitions from different parts of experience are stored together and randomly sampled, reducing short-range temporal correlation within a minibatch.

This moves the training procedure closer to the usual independent-sample intuition, but does not make the environment data truly independent or guarantee convergence. SGD is not restricted to perfectly independent data; the practical issue here is the harmful dependence and changing distribution of online experience.

The independent-sample intuition can be stated more precisely. If sampled gradients have the correct expectation and finite variance, an average of independent draws converges to that expectation:

```math
\hat g_B=\frac1B\sum_{j=1}^{B}g_j,\qquad
\mathbb E[g_j]=\nabla L,\qquad
\operatorname{Var}(g_j)<\infty,
\qquad \hat g_B\longrightarrow\nabla L.
```

Replay sampling makes this argument useful conditional on the stored buffer. It does not mean that the buffer perfectly represents every state or that the original environment trajectory was independent.

### Reusing experience

Without replay, a transition may be used once and then discarded. Interaction can be expensive, especially when an agent must act in a simulator or a physical environment.

Storing a transition allows it to contribute to multiple updates. Replay therefore improves the amount of learning obtained from collected experience as well as changing the correlation structure of the training samples.

## Frozen target network

### The moving-target problem

Suppose the same network supplies both the current estimate and its target:

```math
y_\theta=r+\gamma\max_{a'}Q(s',a';\theta).
```

A semi-gradient update fits Q to that target:

```math
\theta\leftarrow\theta-\alpha
[Q(s,a;\theta)-\operatorname{stopgrad}(y_\theta)]\nabla_\theta Q(s,a;\theta).
```

Although the target is detached within this individual update, its value will change after theta changes. **The quantity being fitted and the target being fitted to depend on the same moving parameters.**

This feedback can produce oscillation or divergence: moving the estimate toward the current target also changes the target used in the next update. It can make learning noisy and unstable rather than steadily reducing a fixed prediction error.

<figure><img src="/assets/posts/65-18.png" alt="A schematic plot contrasts oscillation under a moving target with smoother progress toward a frozen target."><figcaption>An illustration of the moving-target problem, not an experimental learning curve.</figcaption></figure>

### Holding the target parameters fixed

Maintain a separate copy of the Q-network with parameters theta-minus:

```math
y=r+\gamma(1-d)\max_{a'}Q(s',a';\theta^-).
```

The online parameters theta receive gradient updates. The target parameters remain fixed for C updates, then receive a copy of the online parameters:

```math
\theta^-\leftarrow\theta\qquad\text{every }C\text{ training steps}.
```

For those C steps, changing theta does not immediately change the value function used to construct the target. This provides a more stable regression problem. Replay and the target network address different issues: replay changes the training samples, while the target network stabilizes their targets.

## DQN pseudocode

The two mechanisms fit into the following algorithm. States may include a preprocessing function or a stack of observations, as in Atari implementations.

```algorithm
{"title":"Deep Q-learning with experience replay and a target network","inputs":"Replay capacity $N$, minibatch size $B$, target interval $C$, learning rate $\u005calpha$, discount $\u005cgamma$, exploration probability $\u005cvarepsilon$.","lines":[[0,"Initialize replay buffer $\u005cmathcal{D}\u005cleftarrow\u005cvarnothing$ with capacity $N$."],[0,"Initialize action-value network $Q_\u005ctheta$; set $\u005ctheta^-\u005cleftarrow\u005ctheta$ and update counter $u\u005cleftarrow0$."],[0,"**for each** episode **do**"],[1,"Observe and preprocess initial state $s$."],[1,"**repeat**"],[2,"With probability $\u005cvarepsilon$, sample $a$ uniformly; otherwise choose $a\u005cin\u005carg\u005cmax_{a'}Q_\u005ctheta(s,a')$."],[2,"Execute $a$; observe $r$ and termination $d$; construct and preprocess the next state $s'$."],[2,"Store $(s,a,r,s',d)$ in $\u005cmathcal{D}$, replacing the oldest record if full."],[2,"**if** at least $B$ transitions are available **then**"],[3,"Sample a minibatch $\u005c{(s_j,a_j,r_j,s'_j,d_j)\u005c}_{j=1}^{B}$ uniformly from $\u005cmathcal{D}$."],[3,"$y_j\u005cleftarrow r_j+\u005cgamma(1-d_j)\u005cmax_{a'}Q_{\u005ctheta^-}(s'_j,a')$ for each $j$."],[3,"$\u005cmathcal{L}(\u005ctheta)\u005cleftarrow\u005cfrac{1}{2B}\u005csum_j[Q_\u005ctheta(s_j,a_j)-\u005coperatorname{stopgrad}(y_j)]^2$."],[3,"$\u005ctheta\u005cleftarrow\u005ctheta-\u005calpha\u005cnabla_\u005ctheta\u005cmathcal{L}(\u005ctheta)$; $u\u005cleftarrow u+1$."],[3,"**if** $u\u005cbmod C=0$ **then** $\u005ctheta^-\u005cleftarrow\u005ctheta$."],[2,"**end if**"],[2,"$s\u005cleftarrow s'$."],[1,"**until** the episode terminates"],[0,"**end for**"]]}
```

In the Atari notation, a raw observation is an image \(x_t\), while the network receives a processed representation \(\phi(s_t)\) of the observation history. At the start of an episode, initialize \(s_1=(x_1)\) and compute \(\phi(s_1)\). After executing \(a_t\), append the new action and observation to form \(s_{t+1}=(s_t,a_t,x_{t+1})\), then compute \(\phi(s_{t+1})\).

Store the processed transition \((\phi(s_t),a_t,r_t,\phi(s_{t+1}),d_t)\) for replay. Both the online prediction and the target-network evaluation use these processed inputs. The pseudocode above uses \(s\) as shorthand for the representation supplied to the network; preprocessing is performed for the next observation as well as the initial one.

## Epsilon-greedy behavior and the replay distribution

DQN also selects actions epsilon-greedily. Most actions maximize the current Q estimate, while a fraction are random exploratory choices.

The behavior policy and environment together determine which states and actions enter the buffer. For a fixed behavior policy b with a stationary state distribution, the visitation distribution can be written:

```math
\rho_b(s,a)=d^b(s)b(a\mid s).
```

Uniform replay sampling is uniform **over stored transitions**, not over all possible states or actions. Frequently visited state-action pairs can appear many times. Because the behavior policy changes during training, the buffer generally mixes experience from different versions of that policy rather than representing one fixed stationary distribution exactly.

This completes the progression from a Q table to a learned Q-function. The next article asks whether the policy itself can be parameterized and optimized directly.
