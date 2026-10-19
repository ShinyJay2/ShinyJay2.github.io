---
title: "Reinforcement Learning 2: Markov Decision Processes and Bellman Equations"
date: "2025-05-20"
category: "Reinforcement Learning"
description: "Recursive value equations and why discounted Bellman updates converge."
draft: false
source_url: "https://jaehoonstudy.tistory.com/61"
series: "Reinforcement Learning"
part: 2
---

The [previous article](/blog/rl-01-foundations/) introduced states, actions, rewards, policies, and values. A Markov decision process connects those quantities into a model of the task. Bellman equations then turn the return over an entire future into a recursive calculation.

## Markov decision processes

Many reinforcement learning tasks are modeled as MDPs. This provides a setting in which the state, action, reward, and transition probability have precise roles.

### The Markov property

The defining assumption is that the current state contains the information needed to predict the future transition. Conditioned on the current action:

```math
\Pr(S_{t+1}\mid S_0,A_0,\ldots,S_t,A_t)
=\Pr(S_{t+1}\mid S_t,A_t).
```

The left-hand side supplies the full history. The right-hand side supplies only the current state and action. The equality says that adding earlier history does not change the next-state prediction. The past and future are conditionally independent given the present state and action.

Why is this assumption useful? In standard finite discounted MDPs, an optimal policy can be chosen using the current state alone. There is no need to search over every possible history-dependent strategy.

The assumption must nevertheless be justified by the state representation. A raw observation does not always satisfy it. Including the full history can formally supply enough information, but may create an impractically large state. Partial observability requires additional care rather than an assumption that every observation is automatically Markov.

### MDP elements

An MDP consists of the state space, action space, transition probabilities, reward function, and discount factor:

```math
\mathcal{M}=(\mathcal{S},\mathcal{A},P,R,\gamma).
```

These are the same quantities introduced earlier. David Silver's student example makes their roles concrete:

<figure><img src="/assets/posts/61-4.png" alt="A student MDP connects classes, Facebook, the pub, and sleep with rewards and transition probabilities."><figcaption>The student MDP from David Silver’s reinforcement learning lectures.</figcaption></figure>

Activities such as attending a class, using Facebook, visiting the pub, and sleeping form the states and choices in the example. The arrows specify transitions, some with probabilities such as 0.2 or 0.4, while the reward labels describe the consequences of those choices.

## Bellman equations

The central idea is simple: **separate a value into the immediate reward and the remaining future value**.

```math
G_t=R_{t+1}+\gamma G_{t+1}.
```

The full return from the current state is the reward received immediately plus the discounted return from the next state. Nothing has been discarded; the sum has only been separated into its first term and the remainder.

The same decomposition applies to both value functions:

```math
V^\pi(s)=\mathbb{E}_\pi[R_{t+1}+\gamma G_{t+1}\mid S_t=s],
```

```math
Q^\pi(s,a)=\mathbb{E}_\pi[R_{t+1}+\gamma G_{t+1}\mid S_t=s,A_t=a].
```

Writing out the state-value decomposition makes every step explicit:

```math
\begin{aligned}
V^\pi(s)&=\mathbb E_\pi[G_t\mid S_t=s]\\
&=\mathbb E_\pi[R_{t+1}+\gamma R_{t+2}+\gamma^2R_{t+3}+\cdots\mid S_t=s]\\
&=\mathbb E_\pi[R_{t+1}+\gamma(R_{t+2}+\gamma R_{t+3}+\cdots)\mid S_t=s]\\
&=\mathbb E_\pi[R_{t+1}+\gamma G_{t+1}\mid S_t=s]\\
&=\mathbb E_\pi[R_{t+1}+\gamma V^\pi(S_{t+1})\mid S_t=s].
\end{aligned}
```

The last equality averages the remaining return conditional on the next state. For Q, the next action can also be averaged explicitly:

```math
Q^\pi(s,a)=\mathbb E\left[R_{t+1}+\gamma\mathbb E_{A_{t+1}\sim\pi(\cdot\mid S_{t+1})}
[Q^\pi(S_{t+1},A_{t+1})]\mid S_t=s,A_t=a\right].
```

### Bellman expectation equations

The next step is to express **the current state's value through the next state's value**. This matters because directly enumerating every future possibility, especially over an infinite horizon, is not practical. Splitting the problem into one step and a remaining value gives it a recursive form.

First, V and Q can be written in terms of one another:

```math
V^\pi(s)=\sum_a\pi(a\mid s)Q^\pi(s,a),
```

```math
Q^\pi(s,a)=R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V^\pi(s').
```

The first line multiplies each action's value by its probability and sums over actions. The second fixes an action, takes its immediate expected reward, and adds the probability-weighted values of all possible successor states.

Substitute the second expression into the first. The current V is now written entirely using next-state V values:

```math
V^\pi(s)=\sum_a\pi(a\mid s)
\left[R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V^\pi(s')\right].
```

Conversely, substitute the first expression into the second. The current Q is written using next-state Q values:

```math
Q^\pi(s,a)=R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)
\sum_{a'}\pi(a'\mid s')Q^\pi(s',a').
```

This is the important change: **a current value is an immediate reward plus another value function**. That next value can be decomposed in the same way. A problem involving an entire future becomes a sequence of local calculations.

<figure><img src="/assets/posts/61-9.png" alt="A Bellman backup branches through actions and successor states."><figcaption>A node’s value combines the probability-weighted contributions of its branches.</figcaption></figure>

Making an initially intractable expression computable through such transformations is a recurring theme in reinforcement learning. The policy-gradient theorem later uses a different transformation for the same broad purpose.

## Bellman optimality equations

For optimal control, begin with the observation that **the best value available in a state comes from choosing its best action**:

```math
V^*(s)=\max_aQ^*(s,a).
```

The best value of a particular action is its immediate expected reward followed by the best attainable future values:

```math
Q^*(s,a)=R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V^*(s').
```

As before, substitute one expression into the other:

```math
V^*(s)=\max_a\left[R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V^*(s')\right],
```

```math
Q^*(s,a)=R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)\max_{a'}Q^*(s',a').
```

These describe the optimal values through the next step. It might appear that this immediately solves the problem, but the maximum introduces another difficulty.

### Why there is no direct linear-system solution

For a fixed policy, the Bellman expectation equations form a linear system:

```math
V^\pi=r^\pi+\gamma P^\pi V^\pi,
\qquad
V^\pi=(I-\gamma P^\pi)^{-1}r^\pi.
```

The optimality equations contain a maximum. The maximizing action can change as the values change, so there is no single fixed transition matrix to invert in this way. The maximum breaks the linear structure that made the direct expression possible.

More explicitly, taking a maximum does not preserve linear combinations:

```math
\max_a[\alpha f(a)+\beta g(a)]
\ne\alpha\max_a f(a)+\beta\max_a g(a)
\quad\text{in general}.
```

The action maximizing one expression need not maximize the other. With the greedy action fixed in each state, the corresponding Bellman expression is affine in the values; when the maximizing action changes, the expression switches between these pieces.

Instead, the discount factor provides a useful property: **contraction**. Repeatedly updating a guess using the Bellman operator can bring it toward a fixed solution.

### Why contraction leads to a fixed point

Let T* denote the Bellman optimality operator. For two candidate value functions V and U, the immediate rewards cancel when their backups are compared. The difference between maxima is no larger than the largest difference of the corresponding terms. Therefore:

```math
\begin{aligned}
|(T^*V)(s)-(T^*U)(s)|
&\le\gamma\max_a\sum_{s'}P(s'\mid s,a)|V(s')-U(s')|\\
&\le\gamma\|V-U\|_\infty.
\end{aligned}
```

The transition probabilities sum to one. Averaging differences cannot exceed the largest difference, and multiplying by gamma below one shrinks that bound further:

```math
\|T^*V-T^*U\|_\infty\le\gamma\|V-U\|_\infty.
```

Applying the operator repeatedly brings the estimates closer. In a finite discounted MDP with bounded rewards, there is a unique fixed point V*, and:

```math
V_{k+1}=T^*V_k,\qquad
\|V_k-V^*\|_\infty\le\gamma^k\|V_0-V^*\|_\infty\longrightarrow0.
```

The supremum norm measures the largest statewise discrepancy. The contraction reduces that discrepancy at every iteration. This explains why recursive updates can solve the value problem even though the optimality equations lack the simple matrix-inverse form.

Contraction also controls the distance between successive iterates:

```math
\|V_{k+1}-V_k\|_\infty
=\|T^*V_k-T^*V_{k-1}\|_\infty
\le\gamma\|V_k-V_{k-1}\|_\infty.
```

Each successive change becomes smaller. The methods that use these backups include value iteration and policy iteration with a known model, and sampled Q-learning updates when a model is unavailable.

<div class="explainer" data-explainer="rl-bellman"></div>

The following comparison previews how the maximum enters different algorithms:

| Method | Model required? | Where the maximum appears | Interpretation |
| --- | --- | --- | --- |
| Value iteration | P and R | \(V_{k+1}(s)=\max_a[R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V_k(s')]\) | A backup both evaluates the continuation and selects the best action. |
| Policy iteration, improvement | P and R | \(\pi_{k+1}(s)\in\arg\max_a[R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V^{\pi_k}(s')]\) | The improvement step maximizes; evaluation of a fixed policy remains linear. |
| Q-value iteration | P and R | \(Q_{k+1}(s,a)=R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)\max_{a'}Q_k(s',a')\) | Directly iterates on Q-values. |
| Q-learning | No | \(Q(s,a)\leftarrow Q(s,a)+\alpha[r+\gamma\max_{a'}Q(s',a')-Q(s,a)]\) | A sampled, off-policy update. Tabular convergence requires sufficient exploration and suitable learning rates. |

The next article introduces classical algorithms that use this structure, beginning with dynamic programming when the environment model is known.


## Reference

Lilian Weng, [A (Long) Peek into Reinforcement Learning](https://lilianweng.github.io/posts/2018-02-19-rl-overview/).
