---
title: "Reinforcement Learning 1: States, Returns, and Value Functions"
date: "2025-05-20"
category: "Reinforcement Learning"
description: "The agent-environment interface, discounted returns, policies, and the meaning of value."
draft: false
source_url: "https://jaehoonstudy.tistory.com/60"
series: "Reinforcement Learning"
part: 1
---

Reinforcement learning has driven a series of important developments in AI: Atari gameplay with DQN, AlphaGo's 2016 match, and AlphaZero's learning through self-play. OpenAI Five later demonstrated strong Dota 2 performance. Reinforcement learning also appears in language-model training, including RLHF and reasoning-oriented training such as DeepSeek-R1, and in control problems involving robots and other physical systems.

Its reach extends beyond games. AlphaTensor applied ideas related to AlphaZero to discover matrix-multiplication algorithms, while AlphaProof explored mathematical reasoning. The common thread is **decision-making through feedback**: an action has consequences, and those consequences provide a signal for improving later decisions.

This series follows the concepts and classical methods in Lilian Weng's *A (Long) Peek into Reinforcement Learning*, with an emphasis on the intuition behind the equations and the reasons one algorithm leads to the next.

## What is reinforcement learning?

Consider an agent placed in an environment whose behavior may initially be unknown. The agent can interact with that environment and receive rewards. It needs a strategy that maximizes the cumulative reward it can obtain. Reinforcement learning improves that strategy through repeated trials and feedback.

**Reinforcement learning is the process of learning a policy through interaction with an environment so as to maximize expected long-term cumulative reward.**

The emphasis is on an agent that tries actions, observes what happens, and gradually develops a better way to act. The objective is not necessarily the action with the largest immediate reward, because an action can also change which rewards become available later.

## Key concepts

### State, action, and reward

The interaction requires three basic quantities:

- **State Sₜ:** the representation of the environment available to the agent at time t.
- **Action Aₜ:** the action selected in that state.
- **Reward Rₜ₊₁:** the reward received after taking the action and moving to the next state.

One transition is a record of the current state, the chosen action, the resulting reward, and the next state. A trajectory is a sequence of these experiences:

```math
S_0,A_0,R_1,S_1,A_1,R_2,S_2,\ldots,S_T.
```

An episode is a trajectory that ends at a terminal state. It is useful to distinguish the whole sequence from a single transition, because many learning methods differ in how much of that sequence they wait to observe.

### Return

The ultimate objective concerns the rewards obtained from now onward. Their discounted sum is the **return**:

```math
G_t=R_{t+1}+\gamma R_{t+2}+\gamma^2R_{t+3}+\cdots
=\sum_{k=0}^{\infty}\gamma^kR_{t+k+1}.
```

For an episode, the sum stops at termination. Gamma is the discount factor, between zero and one.

Why discount future rewards? A smaller gamma places more emphasis on rewards available soon. A larger gamma gives distant rewards greater influence. This lets the objective express the relative importance of immediate and delayed outcomes.

Consider rewards [0, 3, 5, 10] arriving at four successive steps:

```math
G_0=0+3\gamma+5\gamma^2+10\gamma^3.
```

At gamma zero, the return is zero because only the first reward matters. As gamma approaches 0.99, the return rises to approximately 17.57, close to the undiscounted total of 18. The example makes the role of discounting visible: future rewards gradually regain their influence as gamma increases.

<figure><img src="/assets/posts/60-4.png" alt="The return for rewards zero, three, five, and ten increases as the discount factor increases."><figcaption>The discount factor controls how much the future contributes to the return.</figcaption></figure>

Discounting also matters mathematically. In an infinite-horizon problem, an undiscounted sum need not converge. With bounded rewards and gamma below one, the geometric discount keeps the return bounded. Gamma equal to one is still appropriate for some finite episodic problems; the convergence concern applies to the continuing infinite sum.

## Model: transition probability and reward function

A model describes the environment. Its two principal components are the state-transition probability and the reward function.

### State-transition probability

The transition probability asks: given state s and action a, how likely is the next state to be s′?

```math
P(s'\mid s,a)=\Pr(S_{t+1}=s'\mid S_t=s,A_t=a).
```

The environment can also be described with a joint probability for both the next state and reward:

```math
p(s',r\mid s,a)
=\Pr(S_{t+1}=s',R_{t+1}=r\mid S_t=s,A_t=a).
```

If only the next state matters, the reward can be removed by **marginalization**:

```math
P(s'\mid s,a)=\sum_r p(s',r\mid s,a).
```

For example, suppose the only possible rewards are −1, 0, and 1. Then:

```math
\begin{aligned}
P(s'\mid s,a)
&=p(s',-1\mid s,a)\\
&\quad+p(s',0\mid s,a)+p(s',1\mid s,a).
\end{aligned}
```

The first term is the probability of reaching s′ with reward −1, the second of reaching it with reward zero, and the third of reaching it with reward one. These cover every possible reward, so adding them gives the probability of reaching s′ regardless of the reward. That is the meaning of marginalization here.

### Reward function

The reward function is the expected immediate reward after taking an action in a state:

```math
R(s,a)=\mathbb{E}[R_{t+1}\mid S_t=s,A_t=a]
=\sum_{s'}\sum_r r\,p(s',r\mid s,a).
```

Each particular reward is multiplied by the probability of receiving it together with a particular next state. The sum over rewards accounts for every reward that could occur, and the sum over next states accounts for every possible destination.

This expectation concerns **the next transition**, not the entire future return. The value functions below extend the calculation to future rewards.

## Policy

A policy describes the agent's behavior. A deterministic policy maps a state to one action. A stochastic policy maps it to a distribution over actions:

```math
\pi(a\mid s)=\Pr(A_t=a\mid S_t=s).
```

The important intuition is that a stochastic policy produces **probabilities**, not necessarily one fixed answer. Given a state in which the possible actions are up, down, left, and right, a policy could assign probabilities of 10%, 30%, 40%, and 20% respectively.

<figure><img src="/assets/posts/60-10.png" alt="A policy assigns probabilities 0.1, 0.3, 0.4, and 0.2 to up, down, left, and right."><figcaption>A stochastic policy specifies how the agent chooses among the available actions.</figcaption></figure>

These probabilities describe the agent's way of acting in that state. The aim of reinforcement learning is to improve that behavior until it produces the best achievable expected return.

## Value functions

A value function measures how good a state or action is by considering all future rewards that follow it. Recall that Gₜ denotes the return from time t.

The **state value** is:

```math
V^\pi(s)=\mathbb{E}_\pi[G_t\mid S_t=s].
```

The **action value**, also called the Q-value, is:

```math
Q^\pi(s,a)=\mathbb{E}_\pi[G_t\mid S_t=s,A_t=a].
```

Both expressions are expectations. The first conditions only on starting in state s. The second also fixes the first action to a. Subsequent actions follow the policy in both cases.

The relationship between them follows directly from the meaning of a policy. A policy gives the probability of each action, and Q gives the value of each action. Multiplying probability by value and summing over all actions gives the state's expected value:

```math
V^\pi(s)=\sum_a\pi(a\mid s)Q^\pi(s,a).
```

**One action's probability times its value gives its contribution to the expectation. Adding those contributions over every action gives the state value.** Reading the equation this way is more useful than memorizing its symbols in isolation.

## Advantage

Subtracting the state value from the action value gives the advantage:

```math
A^\pi(s,a)=Q^\pi(s,a)-V^\pi(s).
```

V measures how good the state is on average under the policy. Q measures the return when a particular action is selected first. Their difference isolates how much better or worse that action is than the policy's normal outcome in the state.

This is a relative measure. It removes the state's baseline value and leaves the contribution associated with choosing that action. The policy-weighted average advantage is zero.

Advantage becomes important again in policy gradients. Subtracting a suitable state-dependent baseline centers the update signal and can reduce its variance. It is similar in spirit to centering data, although it is not automatically a normalization by scale.

<div class="explainer" data-explainer="rl-value"></div>

## Optimal values and policies

The objective requires a definition of “optimal.” For value functions, it means the largest value achievable across policies:

```math
V^*(s)=\max_\pi V^\pi(s),\qquad
Q^*(s,a)=\max_\pi Q^\pi(s,a).
```

An optimal policy is a policy that attains these values. In the usual finite discounted MDP setting, there is a policy that does so across all states:

```math
V^{\pi^*}(s)=V^*(s),\qquad Q^{\pi^*}(s,a)=Q^*(s,a).
```

The distinction between **max** and **argmax** matters. Max returns the largest value; argmax identifies the choice that produces it. Once optimal action values are known, an optimal action can be selected by:

```math
\pi^*(s)\in\operatorname*{arg\,max}_aQ^*(s,a).
```

The same distinction applies when optimizing over whole policies rather than individual actions:

```math
\pi^*\in\operatorname*{arg\,max}_\pi V^\pi(s),\qquad
\pi^*\in\operatorname*{arg\,max}_\pi Q^\pi(s,a).
```

Here the result of argmax is a policy, not a numerical value. An optimal policy in the finite discounted setting can attain the maxima simultaneously across states and state-action pairs.

The next step is to express these values recursively so that computing them becomes possible.


## Reference

Lilian Weng, [A (Long) Peek into Reinforcement Learning](https://lilianweng.github.io/posts/2018-02-19-rl-overview/).
