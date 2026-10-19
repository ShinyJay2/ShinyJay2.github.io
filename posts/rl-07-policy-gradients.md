---
title: "Reinforcement Learning 7: Policy Gradients and REINFORCE"
date: "2025-06-07"
category: "Reinforcement Learning"
description: "Deriving a policy update from trajectory probabilities and sampled returns."
draft: false
source_url: "https://jaehoonstudy.tistory.com/66"
series: "Reinforcement Learning"
part: 7
---

So far, the series has followed value-based reinforcement learning. A value function or Q-function is estimated first, and a policy is then obtained from those values, often through epsilon-greedy action selection.

This suggests another possibility: **why not parameterize the policy itself?** Instead of learning action values and deriving a policy afterward, a policy-based method directly learns a function that selects actions. If that function is a neural network, an objective and a computable gradient are needed to train it.

## The objective

A policy interacts with the environment one step at a time:

```math
A_t\sim\pi_\theta(\cdot\mid S_t),\qquad
S_{t+1}\sim P(\cdot\mid S_t,A_t).
```

The resulting complete trajectory is:

```math
\tau=(S_0,A_0,R_1,S_1,A_1,R_2,\ldots,S_T).
```

Its value is the complete discounted return, starting at time zero:

```math
G(\tau)=G_0=\sum_{t=0}^{T-1}\gamma^tR_{t+1}.
```

After defining the value of a trajectory, the next question is its probability. Let rho-zero be the initial-state distribution. With environment dynamics independent of theta:

```math
p_\theta(\tau)=\rho_0(s_0)\prod_{t=0}^{T-1}
\pi_\theta(a_t\mid s_t)P(s_{t+1}\mid s_t,a_t).
```

At each step, the policy gives the probability of the selected action, and the environment gives the probability of the next state. Multiplying them across all steps, together with the initial-state probability, gives the probability of that particular trajectory. If rewards are stochastic, their conditional distribution can also be included; it is part of the environment and remains independent of the policy parameters.

There are now two ingredients: **the trajectory's return and the probability of that trajectory**. Their probability-weighted average is the objective:

```math
J(\theta)=\mathbb{E}_{\tau\sim p_\theta}[G(\tau)].
```

For discrete trajectories, this expectation is a sum; for continuous variables, the corresponding expression uses integration. The goal is to find parameters maximizing it:

```math
\theta^*\in\operatorname*{arg\,max}_\theta J(\theta).
```

Optimization requires the policy gradient:

```math
\nabla_\theta J(\theta).
```

The challenge is that directly calculating the expectation involves every possible trajectory. **The purpose of the derivation is to turn this gradient into something that can be estimated from sampled experience.**

## Deriving the policy gradient

The key strategy is to put the gradient **inside an expectation**. Once that is possible, a finite set of sampled trajectories can approximate it through Monte Carlo estimation.

### 1. Expand the expectation

For discrete trajectories:

```math
\nabla_\theta J(\theta)
=\nabla_\theta\sum_\tau p_\theta(\tau)G(\tau).
```

The return associated with a fixed trajectory is treated as independent of theta. Theta affects which trajectories are sampled through the policy.

### 2. Use linearity of differentiation

Move differentiation inside the sum:

```math
\nabla_\theta J(\theta)
=\sum_\tau\nabla_\theta p_\theta(\tau)G(\tau).
```

This follows from the linearity of differentiation, assuming the regularity conditions needed to exchange the derivative and sum or integral.

### 3. Apply the log-derivative identity

The crucial identity is:

```math
\nabla_\theta\log p_\theta(\tau)
=\frac{\nabla_\theta p_\theta(\tau)}{p_\theta(\tau)}.
```

It is simply the chain rule for the logarithm. Rearranging gives:

```math
\nabla_\theta p_\theta(\tau)
=p_\theta(\tau)\nabla_\theta\log p_\theta(\tau).
```

Substitute this expression into the previous sum:

```math
\nabla_\theta J(\theta)=\sum_\tau p_\theta(\tau)
G(\tau)\nabla_\theta\log p_\theta(\tau).
```

### 4. Recognize an expectation again

A sum of a probability multiplied by a quantity is an expectation:

```math
\nabla_\theta J(\theta)=
\mathbb{E}_{\tau\sim p_\theta}
\left[G(\tau)\nabla_\theta\log p_\theta(\tau)\right].
```

The gradient is now inside the expectation. Instead of evaluating the full objective across every possible trajectory and then differentiating, sample trajectories, calculate their score-function gradients, and average them:

```math
\widehat{\nabla_\theta J}=
\frac1N\sum_{i=1}^{N}
G(\tau^{(i)})\nabla_\theta\log p_\theta(\tau^{(i)}).
```

This is what makes the expression tractable. Under the stated assumptions and sampling from the policy, it is a Monte Carlo gradient estimator.

## From trajectory probabilities to action probabilities

The remaining term appears to require the probability of an entire trajectory. Expand its logarithm:

```math
\log p_\theta(\tau)=\log\rho_0(s_0)
+\sum_{t=0}^{T-1}\log\pi_\theta(a_t\mid s_t)
+\sum_{t=0}^{T-1}\log P(s_{t+1}\mid s_t,a_t).
```

The logarithm turns a product into a sum. The initial distribution and environment dynamics do not depend on theta, so their gradients are zero:

```math
\nabla_\theta\log p_\theta(\tau)
=\sum_{t=0}^{T-1}\nabla_\theta\log\pi_\theta(a_t\mid s_t).
```

Substituting gives an equivalent form:

```math
\nabla_\theta J(\theta)=\mathbb{E}
\left[\left(\sum_{t=0}^{T-1}\nabla_\theta\log\pi_\theta(A_t\mid S_t)\right)
\left(\sum_{k=0}^{T-1}\gamma^kR_{k+1}\right)\right].
```

The environment model need not be differentiated or known. Only the policy's selected-action log probabilities are differentiated.

## Why past rewards can be removed

The expression above weights every action's gradient by the whole trajectory return, including rewards that occurred before that action. Those earlier rewards cannot be changed by the action.

For a fixed state, the expected policy score is zero:

```math
\begin{aligned}
\mathbb{E}_{A\sim\pi_\theta}[\nabla_\theta\log\pi_\theta(A\mid s)]
&=\sum_a\nabla_\theta\pi_\theta(a\mid s)\\
&=\nabla_\theta1=0.
\end{aligned}
```

Conditioned on the history before selecting Aₜ, earlier rewards are already fixed. Multiplying them by the score and taking the action expectation therefore gives zero. Removing those terms leaves the expected gradient unchanged.

Only rewards from time t onward are needed:

```math
\nabla_\theta J(\theta)=\mathbb{E}
\left[\sum_{t=0}^{T-1}\nabla_\theta\log\pi_\theta(A_t\mid S_t)
\sum_{k=t}^{T-1}\gamma^kR_{k+1}\right].
```

Define the return to go with discounting relative to t:

```math
G_t=\sum_{k=t}^{T-1}\gamma^{k-t}R_{k+1}.
```

The inner sum above is gamma-to-the-t times Gₜ. Thus, for the discounted start-state objective used here:

```math
\nabla_\theta J(\theta)=\mathbb{E}
\left[\sum_{t=0}^{T-1}\gamma^tG_t
\nabla_\theta\log\pi_\theta(A_t\mid S_t)\right].
```

The outer discount factor follows from the objective's original time-zero discounting. Formulas using a discounted state-visitation distribution can absorb this weighting into the expectation; those conventions should not be mixed.

## From returns to Q-values

By definition, the expected return conditioned on the state and action is Q:

```math
\mathbb{E}[G_t\mid S_t=s,A_t=a]=Q^{\pi_\theta}(s,a).
```

The policy score at time t depends only on that state and action. Conditioning on them therefore allows the sampled Gₜ to be replaced by its conditional expectation:

```math
\nabla_\theta J(\theta)=\mathbb{E}
\left[\sum_{t=0}^{T-1}\gamma^tQ^{\pi_\theta}(S_t,A_t)
\nabla_\theta\log\pi_\theta(A_t\mid S_t)\right].
```

This is the policy-gradient form that the following actor-critic methods will use. The term in front of the score indicates how valuable the chosen action is.

In practice, the true Q is unknown. Sampled returns provide one estimate:

```math
\hat g=\frac1N\sum_{i=1}^{N}\sum_{t=0}^{T_i-1}
\gamma^tG_t^{(i)}\nabla_\theta\log\pi_\theta(A_t^{(i)}\mid S_t^{(i)}).
```

The sequence of transformations has converted an expectation over all possible outcomes into a quantity that can be estimated from finite experience.

<div class="explainer" data-explainer="rl-gradient"></div>

## REINFORCE

REINFORCE uses the Monte Carlo return Gₜ in place of the unknown Q-value. It collects a complete episode, calculates returns, and performs a policy update:

```math
\theta\leftarrow\theta+\alpha\sum_{t=0}^{T-1}
\gamma^tG_t\nabla_\theta\log\pi_\theta(A_t\mid S_t).
```

Equivalently, a gradient-descent optimizer minimizes the negative weighted log probability:

```math
\mathcal{L}(\theta)=-\sum_{t=0}^{T-1}
\gamma^t\operatorname{stopgrad}(G_t)\log\pi_\theta(A_t\mid S_t).
```

### REINFORCE pseudocode

```algorithm
{"title":"REINFORCE for a discounted episodic objective","inputs":"Differentiable policy $\u005cpi_\u005ctheta$, learning rate $\u005calpha$, discount $\u005cgamma$.","lines":[[0,"Initialize policy parameters $\u005ctheta$."],[0,"**for each** episode **do**"],[1,"Sample $S_0,A_0,R_1,\u005cldots,S_T$ using $\u005cpi_\u005ctheta$."],[1,"$G\u005cleftarrow0$; initialize $g\u005cleftarrow0$."],[1,"**for** $t=T-1,T-2,\u005cldots,0$ **do**"],[2,"$G\u005cleftarrow R_{t+1}+\u005cgamma G$."],[2,"$g\u005cleftarrow g+\u005cgamma^tG\u005cnabla_\u005ctheta\u005clog\u005cpi_\u005ctheta(A_t\u005cmid S_t)$."],[1,"**end for**"],[1,"$\u005ctheta\u005cleftarrow\u005ctheta+\u005calpha g$."],[0,"**end for**"]]}
```

The episode finishes before its returns are used for learning. This is the same complete-return requirement encountered in Monte Carlo value estimation. “Optimize the loss” and “update theta” are two descriptions of the same policy-parameter update, with gradient descent on the negative objective equivalent to gradient ascent on return.

## The expression to carry forward

The following methods modify the quantity multiplying the policy score: a learned Q estimate, an advantage relative to a baseline, a TD error, or a mixture of multi-step estimates.

```math
\underbrace{Q^{\pi_\theta}(S_t,A_t)}_{\text{evaluation of the action}}
\underbrace{\nabla_\theta\log\pi_\theta(A_t\mid S_t)}_{\text{policy score}}.
```

Keeping this structure in view makes the transition to Q actor-critic, advantage actor-critic, TD actor-critic, and GAE easier to follow. Their estimators differ, but they build on the computable policy gradient derived here.

The step-by-step derivation also follows the lecture notes of Sungwoong Kim and the REINFORCE presentation in David Silver's lectures.


## Reference

Lilian Weng, [A (Long) Peek into Reinforcement Learning](https://lilianweng.github.io/posts/2018-02-19-rl-overview/).
