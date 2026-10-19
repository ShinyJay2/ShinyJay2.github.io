---
title: "Fine-tuning Qwen3.5-0.8B for Korean with LoRA"
date: "2026-03-05"
source_url: "https://jaehoonstudy.tistory.com/75"
category: "Language Models"
description: "Training 0.085% of a model’s parameters: a Korean instruction-tuning experiment and what changed on KoBEST."
draft: false
---

This experiment evaluates the effect of LoRA fine-tuning on Qwen3.5-0.8B using Korean instruction-following data. Performance is measured by comparing the base model and the fine-tuned model on five KoBEST tasks under the same evaluation conditions.

The average accuracy increased from **53.82% to 55.65%**, a gain of **1.83 percentage points**. Only 638,976 parameters were trained—about 0.085% of the model. The gains were uneven: sentiment with negation improved the most, while sentence-continuation accuracy did not change.

## Low-rank adaptation

Full fine-tuning updates the base model’s weights. LoRA keeps those weights frozen and learns a low-rank update in selected layers. This makes the number of trainable parameters much smaller, although the base model still needs to be loaded and used during training.

The adapter targets the attention query and value projections, `q_proj` and `v_proj`, with rank 16. This configuration provides a compact baseline for measuring the effect of Korean instruction tuning.

## Data and formatting

The training dataset contains **49,620 samples** from `Bingsu/ko_alpaca_data`. Each sample contains an instruction, optional input, and a target output.

The instruction and any additional input were combined into a user message, with the target output as the assistant message. Messages were formatted with the model’s `apply_chat_template()` method. No system prompt was added.

This is general instruction-following data, rather than a dataset tailored to the five evaluation tasks. That distinction matters when interpreting what improved.

## Training setup

The run used Qwen3.5-0.8B in bfloat16 with an NVIDIA L40S GPU. The configuration was:

| Setting | Value |
| --- | --- |
| LoRA rank / alpha | 16 / 32 |
| Target modules | `q_proj`, `v_proj` |
| LoRA dropout | 0.05 |
| Trainable parameters | 638,976 |
| Epochs | 2 |
| Per-device batch size | 16 |
| Gradient accumulation | 2 steps |
| Effective batch size | 32 |
| Learning rate | 2 × 10⁻⁴ |
| Schedule | Cosine decay, 5% warmup |
| Maximum sequence length | 512 tokens |
| Optimizer | AdamW |

Training ran for **3,102 steps** and took **5,857 seconds**, approximately 1 hour 38 minutes. The reported training loss was 1.956. Training loss measures fit to the training objective. The benchmark comparison below evaluates performance on the selected Korean language tasks.

## Evaluating with KoBEST

Both models were evaluated with `lm-evaluation-harness`, using the Hugging Face backend and log-likelihood scoring in bfloat16 under the same evaluation conditions.

The five tasks cover different aspects of Korean language understanding:

- **BoolQ:** yes/no questions about a passage.
- **COPA:** choosing a plausible cause or effect.
- **HellaSwag:** selecting a plausible continuation.
- **SentiNeg:** sentiment classification involving negation.
- **WiC:** deciding whether a word has the same meaning in two contexts.

## Results

The table shows accuracy. “Change” is an absolute difference in percentage points, not a relative percentage improvement.

| Task | Base model | With LoRA | Change |
| --- | ---: | ---: | ---: |
| BoolQ | 59.33% | 61.11% | +1.78 pp |
| COPA | 52.40% | 54.00% | +1.60 pp |
| HellaSwag | 37.80% | 37.80% | 0.00 pp |
| SentiNeg | 70.78% | 76.07% | +5.29 pp |
| WiC | 48.81% | 49.29% | +0.48 pp |
| **Mean across tasks** | **53.82%** | **55.65%** | **+1.83 pp** |

Four of the five tasks improved in accuracy; HellaSwag was unchanged. The mean is an equal-weight average of the five task scores, not a pooled accuracy over all examples.

### SentiNeg: largest accuracy improvement

SentiNeg improved by 5.29 percentage points. One possible explanation is that Korean instruction data helped with language patterns relevant to sentiment and negation. The aggregate score alone does not establish that explanation; inspecting individual predictions would be the next step.

### WiC: accuracy and F1

WiC’s accuracy increased by only 0.48 percentage points, but its reported F1 score rose from **0.3280 to 0.4325**. Accuracy alone does not capture this change. A confusion matrix and class-level results would help explain which predictions changed.

### HellaSwag: unchanged accuracy, lower F1

HellaSwag accuracy remained at 37.80%, while its reported F1 decreased slightly, from **0.3763 to 0.3750**. The absence of an accuracy decrease on these five tasks does not establish that all model capabilities were preserved.

## Discussion and limitations

The small adapter and short training run produced a modest improvement in mean KoBEST accuracy. These results provide a baseline for Korean instruction tuning; broader gains in reasoning or language ability require additional evaluation.

The comparison also has limits. It is one training run on one benchmark suite, and small score differences may reflect evaluation or training variability. The results do not establish statistical significance, rule out forgetting on other tasks, or isolate which training examples caused the gains.

Further evaluation should compare multiple random seeds, inspect errors on SentiNeg and WiC, and vary the LoRA rank or target modules while keeping the evaluation setup fixed. These comparisons would help assess whether the observed gains are reproducible.

## Reproduction

The [code repository](https://github.com/ShinyJay2/qwen3.5-korean-lora-finetune) contains the training script, evaluation scripts, adapter, and result files. After following its environment setup instructions, the main sequence is:

```bash
python3 evaluate.py --mode baseline
python3 finetune.py
python3 evaluate.py --mode finetuned
python3 compare.py
```

Check the GPU selection in the scripts before running them on another machine. The configuration used for this experiment defaults to `CUDA_VISIBLE_DEVICES=2`.

## Resources

- [Experiment code and results](https://github.com/ShinyJay2/qwen3.5-korean-lora-finetune)
- [Qwen3.5-0.8B](https://huggingface.co/Qwen/Qwen3.5-0.8B)
- [Korean Alpaca instruction data](https://huggingface.co/datasets/Bingsu/ko_alpaca_data)
- [KoBEST](https://huggingface.co/datasets/skt/kobest_v1)
- [Language Model Evaluation Harness](https://github.com/EleutherAI/lm-evaluation-harness)
