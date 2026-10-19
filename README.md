# Jaehoon Jang — personal website

An English academic website and native Markdown blog for https://shinyjay2.github.io. Neutral gray backgrounds, purple links, light-weight Roboto headings and body text distinguish the academic layout. The Blog preview precedes Publications; the full blog has its own /blog/ page. This is an independently implemented static site, not an al-folio installation.

## Local preview

Use Node.js 22 or later and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run dev
```

Open http://127.0.0.1:4173. Rebuild after editing; refresh the browser.

## Write a post

Create `posts/short-english-slug.md`:

```yaml
---
title: "Your title"
date: "2026-10-20"
category: "Machine Learning"
description: "A concise description."
draft: true
---
```

Write Markdown below the frontmatter. Use `draft: false` to include the post in the build. Published articles have their own `/blog/slug/` page and appear in the blog, home page, RSS, and sitemap. Store images in `assets/` and reference them as `/assets/filename.png`. The renderer supports tables, fenced code, and display equations in fenced `math` blocks using locally bundled KaTeX. Syntax highlighting is not configured. Use `series: "Reinforcement Learning"` and a numeric `part` to include an article in the RL series navigation. Markdown is trusted author content; do not ingest unreviewed HTML.

## GitHub Pages

The included workflow builds and deploys `dist/` on pushes to `main`. In the GitHub repository, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**. Deployment requires repository access; a successful workflow run confirms publication.

Alternatively, the contents of `dist/` are a complete static website suitable for branch-based Pages hosting. Do not copy just the source files into an existing branch-based deployment and expect a build.

## Content decisions

- Biography, employment, education, award, and publication derive from the existing site.
- Conflicting master’s degree dates are omitted pending confirmation.
- The Qwen LoRA experiment retains its original publication date of March 5, 2026, verified against Tistory post 75. Twelve other selected Tistory articles are included in English with their original publication dates: RL parts 1–8, DeepSeek-R1, Unsupervised Learning, SimCLR, and MoCo. Deterministic vs Stochastic Policy and the ECCV 2016 jigsaw article are excluded. Preserve original publication dates when migrating existing posts.
- No invented publication, study post, benchmark, or credential has been added.
- The personal `conversation-to-blog` Codex skill is installed separately from this public repository. It requires interactive visualizations that explain difficult or confusing concepts while preserving the conversation content.

The original root `index.html`, `style.css`, `script.js`, and `images/` are retained in the working checkout for comparison. The new build uses `scripts/build.mjs`, `assets/`, and `posts/`; deploy only `dist/`.

## Editorial style

Use professional, impersonal prose in blog articles. Describe the experiment, method, and evidence directly; avoid first-person narration. Do not use middle-dot separators in site copy or metadata. Separate metadata fields through layout spacing. Preserve generous spacing between article sections.

Give visualizations descriptive titles directly. Do not add generic introductory badges above them.


## Source fidelity and algorithms

For migrated articles, preserve the original explanation sequence, motivation, worked examples, and intermediate derivations. Translate closely rather than rewriting from the topic or compressing to a summary. Professional tone does not justify removing explanatory steps. Personal asides may be recast impersonally; factual and mathematical corrections should remain narrowly scoped.

Fenced `algorithm` blocks contain JSON with `title`, optional `inputs`, and `lines` as `[indentDepth, text]` pairs. They render as paper-style algorithms with rules, captions, numbered lines, bold control keywords, and inline KaTeX between dollar signs. Use these for pseudocode; ordinary executable code still uses normal code fences.

Article section gaps are 128 px before h2 and 80 px before h3 on desktop, 96 px and 64 px on small screens. Consecutive h2/h3 headings use a smaller gap to keep the heading group together.

## Conversation articles and interactive illustrations

The L1/EMA article preserves the full English answer from the requested JEPA conversation, with formatting changes only. SIGReg follows all eleven sections of the Korean answer in English, preserving examples, equations, symbol definitions, tensor shapes, caveats, and links. Visuals are additive. These posts are filed under Unsupervised Learning.

Use `\(...\)` for inline KaTeX. Visual placeholders use `<div class="explainer" data-explainer="NAME"></div>` with `l1`, `ema`, `latent`, `projection`, `circle`, or `frequency`. The self-contained SVG illustrations use local JavaScript and require no plotting service. Their numeric functions live in `assets/explainer-math.js`. Sample plots use fixed seeds for reproducibility; they are illustrations, not experimental results. The full article remains readable without JavaScript.

The blog index groups each series at its most recent publication date and orders its chapters by `part`. RSS remains chronological. RL articles include previous/next chapter links and a complete contents list.
