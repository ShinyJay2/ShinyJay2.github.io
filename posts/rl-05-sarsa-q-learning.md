---
title: "Reinforcement Learning 5: SARSA and Q-Learning"
date: "2025-05-30"
category: "Reinforcement Learning"
description: "On-policy and off-policy control through two closely related temporal-difference updates."
draft: false
source_url: "https://jaehoonstudy.tistory.com/64"
series: "Reinforcement Learning"
part: 5
---

The previous article addressed TD prediction: how to construct a target and update a state's value. The next question is control: how can those estimates improve the policy?

SARSA and Q-learning are two TD control methods. SARSA is on-policy; Q-learning is off-policy. Their difference becomes clear by examining which next action enters the update target.

## Model-free control

When the model was known, an action's value could be calculated from state values:

```math
Q^\pi(s,a)=R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V^\pi(s').
```

Policy improvement then chose the action attaining the largest value:

```math
\pi_{\mathrm{new}}(s)\in\operatorname*{arg\,max}_aQ^\pi(s,a).
```

In the model-free setting, P and R are unknown, so the first expression cannot simply be evaluated from the model. There is also a more direct reason to learn Q: improving a policy means deciding **which action to take in a state**. That requires comparing the estimated returns of different actions.

For these model-free value-based control methods, action values are learned directly from experience:

```math
Q^\pi(s,a)=\mathbb{E}_\pi[G_t\mid S_t=s,A_t=a].
```

A sampled state-action pair supplies information about its own return. Once these estimates are available, greedy improvement can compare actions without needing P and R explicitly. Other model-free families, such as policy gradients, will later take a different approach.

## SARSA: on-policy control

SARSA replaces the state-value estimate in TD(0) with an action-value estimate. Its one-step target is:

```math
y_t=R_{t+1}+\gamma Q(S_{t+1},A_{t+1}).
```

The update is:

```math
Q(S_t,A_t)\leftarrow Q(S_t,A_t)
+\alpha[y_t-Q(S_t,A_t)].
```

The sequence of quantities gives the method its name: **State, Action, Reward, State, Action**.

### Epsilon-greedy action selection

An epsilon-greedy policy chooses a best-known action with probability 1 − epsilon and samples uniformly from all actions with probability epsilon. These are exploitation and exploration respectively.

With one selected greedy action:

```math
\pi(a\mid s)=\frac{\epsilon}{|\mathcal{A}|}
+(1-\epsilon)\mathbf{1}[a=a_{\mathrm{greedy}}].
```

The greedy action can also be selected during the random branch. The formula accounts for both routes to choosing it.

### Which next action enters the target?

At Sₜ, the agent selects Aₜ from its current policy. The environment responds with Rₜ₊₁ and Sₜ₊₁. As soon as that next state is observed, **the next action Aₜ₊₁ is sampled from the current policy**.

That sampled action is used in the target, and the agent continues with it. The update therefore evaluates the same action-selection behavior that generates the experience. This is the central reason SARSA is on-policy.

```algorithm
{"title":"SARSA with epsilon-greedy control","inputs":"Learning rate $\u005calpha$, discount $\u005cgamma$, exploration probability $\u005cvarepsilon$.","lines":[[0,"Initialize $Q(s,a)$ for all state-action pairs."],[0,"**for each** episode **do**"],[1,"Observe $S$; sample $A$ from the epsilon-greedy policy derived from $Q$."],[1,"**repeat**"],[2,"Execute $A$; observe $R$, successor $S'$, and termination indicator $d$."],[2,"**if** $d=1$ **then** $y\u005cleftarrow R$."],[2,"**else** sample $A'$ from the current policy; $y\u005cleftarrow R+\u005cgamma Q(S',A')$."],[2,"$Q(S,A)\u005cleftarrow Q(S,A)+\u005calpha[y-Q(S,A)]$."],[2,"**if** $d=0$ **then** $(S,A)\u005cleftarrow(S',A')$."],[1,"**until** the episode terminates"],[0,"**end for**"]]}
```

## Q-learning: off-policy control

SARSA uses the next action selected by the current policy. Q-learning instead uses the largest estimated next-state action value:

```math
y_t=R_{t+1}+\gamma\max_{a'}Q(S_{t+1},a').
```

```math
Q(S_t,A_t)\leftarrow Q(S_t,A_t)
+\alpha\left[R_{t+1}+\gamma\max_{a'}Q(S_{t+1},a')-Q(S_t,A_t)\right].
```

The maximum is applied inside the one-step target. Regardless of which next action the exploratory policy selects, the update points toward the value of a greedy next action.

This does not mean that Q-learning ignores the action actually taken at the current state. Its observed transition and reward are still used. The independence concerns **the next action in the target**.

| Method | Next-state term | Policy relationship |
| --- | --- | --- |
| SARSA | Q of the next action sampled from the current policy | On-policy |
| Q-learning | Maximum Q over next actions | Off-policy |

The behavior policy can remain epsilon-greedy in both methods. SARSA's target includes that exploratory behavior; Q-learning's target follows a greedy policy even when the behavior does not.

<div class="explainer" data-explainer="rl-control"></div>

At a terminal state, both targets reduce to the received reward because no future action value remains. The next article replaces Q-learning's table with a neural function approximator.


## Reference

Lilian Weng, [A (Long) Peek into Reinforcement Learning](https://lilianweng.github.io/posts/2018-02-19-rl-overview/).
