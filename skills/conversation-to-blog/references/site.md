# Jaehoon's blog conventions

Repository: `https://github.com/ShinyJay2/ShinyJay2.github.io`, default branch `main`.

Locate the checkout through the current workspace and verify its Git remote. In this repository, the site root contains `posts/`, `assets/`, `scripts/`, and `package.json`; the skill is under `skills/conversation-to-blog/`. Do not assume a machine-specific path. For another blog, adapt the paths and renderer to its existing conventions.

## Source format

- `posts/<lowercase-hyphenated-slug>.md`, YAML frontmatter with `title`, quoted ISO `date`, `category`, `description`, and `draft: false` for inclusion.
- Use `source_url` for migrated published content. Existing internal conversation identifiers are optional provenance metadata, not visible article copy.
- Current categories include `Unsupervised Learning`, `Reinforcement Learning`, and `Language Models`. Choose by subject, not by which conversation supplied it.
- `series` and numeric `part` group a series in reading order. Do not renumber or attach unrelated new articles to the completed eight-part RL series.
- Display math uses fenced `math` blocks. Inline math uses `\(...\)`. Convert the conversation's `\[...\]` blocks to fenced `math` without changing the TeX.
- Academic pseudocode uses fenced `algorithm` JSON: `title`, optional `inputs`, and `lines` as `[indentDepth, text]` pairs. These fields support Markdown emphasis and `$...$` math. JSON backslashes must be escaped. Executable Python remains a normal code block.
- Promote numbered bold section titles to headings while preserving their text. Keep generous section spacing and the existing font. Metadata is separated by layout spacing, never punctuation badges.

## Visualizations and build

`scripts/build.mjs` uses marked, gray-matter, and local KaTeX. `assets/site.css` supplies gray backgrounds, purple accents, and neutral blog titles. `assets/explainers.js` contains native SVG widgets, with math functions in `assets/explainer-math.js`.

Existing visual types: `l1`, `ema`, `latent`, `projection`, `circle`, `frequency`. RL-specific types in `assets/rl-explainers.js` are `rl-value`, `rl-bellman`, `rl-dp`, `rl-traces`, `rl-control`, `rl-dqn`, `rl-gradient`, and `rl-gae`; their calculations are in `assets/rl-math.js`. Place one with `<div class="explainer" data-explainer="TYPE"></div>`. Reuse only when it teaches the new article's subject; otherwise implement a suitably scoped widget.

Run `node scripts/build.mjs` from the checkout root. Generated `dist/` is ignored by Git. The preview script serves `dist/` at `http://127.0.0.1:4173`; do not start another server if that port already serves the correct checkout.

The GitHub Actions workflow `.github/workflows/pages.yml` (verify its actual filename) installs dependencies, builds, uploads `dist`, and deploys to GitHub Pages. Confirm Pages uses the workflow before claiming a successful deployment. Never put credentials or raw conversation snapshots in the repository.
