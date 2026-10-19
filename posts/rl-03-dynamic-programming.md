---
title: "Reinforcement Learning 3: Dynamic Programming"
date: "2025-05-22"
category: "Reinforcement Learning"
description: "Policy evaluation, policy iteration, and value iteration when the environment model is known."
draft: false
source_url: "https://jaehoonstudy.tistory.com/62"
series: "Reinforcement Learning"
part: 3
---

The preceding articles introduced the basic concepts, the MDP formulation, and Bellman equations. The next question is how to use them in an algorithm.

The progression begins with **a known environment**, where dynamic programming can use its transition probabilities and rewards directly. It then moves to **an unknown environment**, where the agent must learn from experience. Finally, when the state or action space becomes too large for tables, neural networks can approximate values or policies.

## Classifying the algorithms

The distinction between model-based and model-free methods provides an initial map:

| Setting | Available information | Representative methods |
| --- | --- | --- |
| Model-based planning | Transition probabilities and rewards | Policy iteration, value iteration |
| Model-free prediction and control | Sampled experience | Monte Carlo, TD, SARSA, Q-learning |
| Function approximation | Large spaces represented through learned functions | DQN, policy gradients, actor-critic methods |

The last row concerns how quantities are represented rather than a mutually exclusive model category. Neural networks can be used in both model-based and model-free systems.

Within model-free methods, prediction includes Monte Carlo, one-step TD, and n-step TD; control includes Monte Carlo control, on-policy SARSA, and off-policy Q-learning. With neural function approximation, value-based methods include DQN, policy-based methods include REINFORCE, and actor-critic methods include Q actor-critic, advantage actor-critic, and TD actor-critic. These branches explain the reading order of this series.

Small state-action spaces can store values explicitly in a table. Large spaces motivate function approximation. In the known-model branch, iterative policy evaluation handles prediction, while policy iteration and value iteration handle control. In the DQN branch, the central combination is a neural Q-function, experience replay, and a separate target network.

The backup diagrams in the classification can be read as three different ways of looking ahead:

| Backup | Which branches are used? | What supplies the continuation? |
| --- | --- | --- |
| Dynamic programming | All possible next outcomes, weighted by their model probabilities | An estimated next-state value |
| Monte Carlo | One sampled path followed to termination | The observed complete return |
| Temporal difference | One sampled transition in the one-step version | An estimated value after that transition |

The classification follows the [algorithm map cited in the original notes](https://ai-sinq.tistory.com/entry/%EA%B0%95%ED%99%94%ED%95%99%EC%8A%B5-Planning-by-Dynamic-Programming).

### Planning and learning

When the model is known, the agent can plan using it. When it is unknown, the agent must interact with the environment and learn from what happens.

**Dynamic programming assumes that P and R are known and uses Bellman equations to solve the value problem.** P describes state transitions, and R describes expected rewards. Knowing them allows the effects of candidate actions to be calculated instead of discovered only through trial.

Many practical tasks do not supply that information. The later methods relax this assumption, but the known-model case provides a clear starting point.

## Dynamic programming

Two main methods are policy iteration and value iteration. Policy iteration evaluates a policy with the Bellman expectation equation, then improves it. Value iteration uses the Bellman optimality equation to combine these operations.

### Prediction and control

Two tasks recur throughout reinforcement learning:

1. **Prediction:** determine the value of following a particular policy.
2. **Control:** use value information to find a better policy.

The current policy need not be optimal. First estimate how good it is, then use those estimates to choose better actions. Repeating this evaluation-and-improvement process leads toward an optimal policy.

Both policy iteration and value iteration have this underlying structure. The difference is whether evaluation is carried out separately before improvement or the two are combined within the backup.

## Policy iteration

### Policy evaluation

For a fixed policy, repeatedly apply the Bellman expectation equation:

```math
V_{k+1}(s)=\sum_a\pi(a\mid s)
\left[R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V_k(s')\right].
```

The subscript k indexes successive estimates: V₀, V₁, V₂, and so on. In a synchronous sweep, every Vₖ₊₁ is computed from the previous set of values Vₖ. The policy remains fixed during this evaluation.

### Policy improvement

Once the policy has been evaluated, improve it greedily:

```math
\pi_{\mathrm{new}}(s)\in\operatorname*{arg\,max}_a
\left[R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V^\pi(s')\right].
```

“Greedy” means selecting the action with the largest calculated value. P and R are known, and evaluation has supplied V, so each action can be compared. The action attaining the maximum becomes the updated policy's choice.

Standard policy iteration evaluates the current policy to convergence before improving it. A version that improves after a limited number of sweeps is called modified policy iteration. The short example below uses one evaluation sweep per improvement so that the intermediate calculations remain visible.

## Understanding the process with a grid

Consider a 3 by 3 grid. The upper-left cell (0, 0) and lower-right cell (2, 2) are terminal, with value zero. Entering a terminal cell gives reward zero. Every other transition from a nonterminal cell gives −1. A move into a wall leaves the agent in the same cell.

The continuing negative reward encourages the agent to reach a terminal cell by a short route. Set gamma to 0.9 and initially assign probability 1/4 to each of up, down, left, and right.

### Initialization

```math
V_0(s)=0,\qquad
\pi_0(a\mid s)=\frac14\quad\text{for each available direction}.
```

| | Column 1 | Column 2 | Column 3 |
| --- | --- | --- | --- |
| Row 1 | Terminal | 0 | 0 |
| Row 2 | 0 | 0 | 0 |
| Row 3 | 0 | 0 | Terminal |

These zeros initialize the **value estimates**, not the environment's rewards. The reward rule remains fixed throughout the calculation.

The model is known, so the calculation does not have to follow one sampled route from one starting cell. It can evaluate every cell and every possible action in a sweep.

### First evaluation sweep

Because all next-state estimates are zero, the first sweep averages only immediate rewards. At (0, 1), moving left enters a terminal cell and gives zero. The other three actions give −1:

```math
V_1(0,1)=\frac14[0+(-1)+(-1)+(-1)]=-0.75.
```

The same result holds for every cell adjacent to a terminal. At the center, no action terminates immediately, so:

```math
V_1(1,1)=\frac14[(-1)+(-1)+(-1)+(-1)]=-1.
```

| | Column 1 | Column 2 | Column 3 |
| --- | --- | --- | --- |
| Row 1 | Terminal | −0.75 | −1.00 |
| Row 2 | −0.75 | −1.00 | −0.75 |
| Row 3 | −1.00 | −0.75 | Terminal |

### First policy improvement

At a cell beside a terminal, entering it has value zero. Any alternative incurs −1 and a nonpositive continuation value, so termination is preferred.

At a cell two steps away, an action toward a terminal-adjacent cell has value:

```math
-1+0.9(-0.75)=-1.675.
```

An action that remains in a cell valued at −1 has value −1.9. The former is better. One valid greedy policy, resolving ties consistently, is:

| | Column 1 | Column 2 | Column 3 |
| --- | --- | --- | --- |
| Row 1 | Terminal | Left | Left |
| Row 2 | Up | Up | Down |
| Row 3 | Up | Right | Terminal |

### Second sweep and improvement

Now evaluate one step under this improved policy, using V₁ for the continuation. Terminal-adjacent states choose termination, so their values become zero. States two moves away receive −1 and then bootstrap from −0.75, giving −1.675.

| | Column 1 | Column 2 | Column 3 |
| --- | --- | --- | --- |
| Row 1 | Terminal | 0 | −1.675 |
| Row 2 | 0 | −1.675 | 0 |
| Row 3 | −1.675 | 0 | Terminal |

Improvement still selects a shortest route. One more evaluation sweep gives −1 for the states two moves away: their first transition costs −1, and their next action terminates with zero reward. The terminal-adjacent values remain zero.

These calculations all use the stated zero-reward terminal-entry convention. Giving −1 on terminal entry instead would produce different numerical values even though short paths remain desirable.

## Value iteration

Value iteration combines evaluation and improvement. Its guiding idea is to keep updating toward the largest available value, then extract the actions that realize those values.

### Value update

```math
V_{k+1}(s)=\max_a\left[R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V_k(s')\right].
```

Unlike the expectation backup, this does not average actions under a fixed policy. It selects the best action inside every backup.

### Value convergence

Under the finite discounted assumptions from the previous article, the updates converge to the unique optimal value function:

```math
V_k\longrightarrow V^*,\qquad V^*=T^*V^*.
```

### Policy extraction

Once the values are available, select the action that gives the maximum:

```math
\pi^*(s)\in\operatorname*{arg\,max}_a
\left[R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)V^*(s')\right].
```

The result is an action, which is exactly what a deterministic policy must provide for each state. The same process can be written directly with Q-values:

```math
Q_{k+1}(s,a)=R(s,a)+\gamma\sum_{s'}P(s'\mid s,a)\max_{a'}Q_k(s',a'),
```

```math
\pi^*(s)\in\operatorname*{arg\,max}_aQ^*(s,a).
```

<div class="explainer" data-explainer="rl-dp"></div>

## From full backups to sampled backups

Dynamic programming uses **full-width backups**: for the state being updated, it calculates an expectation across all possible successor states. In the grid example, full sweeps also update every nonterminal state. These are two separate choices: the width of a backup and the schedule of state updates.

The intuition is that a known model allows every possible branch to be examined rather than following only the route an agent happened to experience. This can be expensive when there are many states or possible transitions.

A **sample backup** instead uses an observed transition. The agent explores one state at a time, learning from the outcomes encountered along the way, like checking stepping stones as it crosses rather than knowing the whole crossing in advance.

This reduces the work per update and makes model-free learning possible. The next article develops methods that estimate values without complete knowledge of P and R.


## Reference

Lilian Weng, [A (Long) Peek into Reinforcement Learning](https://lilianweng.github.io/posts/2018-02-19-rl-overview/).
