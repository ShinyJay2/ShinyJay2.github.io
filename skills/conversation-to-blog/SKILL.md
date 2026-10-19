---
name: conversation-to-blog
description: Turn selected Codex conversation explanations into faithful English blog articles, preserving examples and derivations and including interactive visualizations that explain difficult concepts in every post.
---

# Conversation to blog

Write articles for the user's chosen blog from conversations they identify. Preserve the teaching content, including the intermediate explanations that made the conversation useful. Read [the site conventions](references/site.md) for the reference GitHub Pages implementation. When using another blog, inspect its content format and build workflow and adapt those implementation details without weakening the content-preservation and visualization requirements.

## Recover the actual source

- For a named Codex chat, discover it with `list_threads`, use its exact title, and retrieve the relevant turns with `read_thread`. Follow pagination and inspect truncation flags. A title or retrieval summary is not the article source. Do not message the source chat merely to retrieve its content.
- Select the requested topic or topics, including follow-up explanations, examples, corrections, and derivations. Separate distinct topics into articles when that matches the request. Ask only if the intended chat or passages remain ambiguous.
- Save a private working snapshot of the selected messages and their turn identifiers outside the public site. Do not publish the raw conversation, tool traces, or unrelated personal context. If retrieval is unavailable, request the relevant text rather than reconstructing it from subject knowledge.

## Preserve the explanation

- Use English throughout. Preserve existing English wording when exact content is requested. Translate Korean passage by passage, retaining the original order, intuitive analogies, numeric examples, symbol definitions, equations, derivation steps, code, qualifications, and citations. Exact wording takes precedence over stylistic rewriting when the user requests it.
- Do not condense the content into a topic summary. A professional tone does not justify dropping steps. Otherwise use professional, impersonal prose and preserve the original approachable explanations.
- Do not introduce migration or adaptation commentary in the article. Avoid first-person experiment narratives unless the user explicitly wants original wording that contains them.
- Preserve source publication dates for migrated posts. For a new conversation article, use an explicit user date or the current user-local date. Do not replace an old post's date with the import date. If the original date is unclear, resolve it from the source or ask.
- Correct a demonstrably inaccurate equation or claim narrowly. Keep a private record of what changed and why; explain consequential corrections to the user. Do not silently invent experimental results or expand the topic using outside material.
- Never use Unicode U+00B7 as a separator. Do not use the prohibited label "Interactive illustration". Use descriptive visualization titles directly, without generic badges.

## Add visuals without replacing text

- Every article created with this skill must include useful interactive visualizations, unless the user explicitly requests otherwise. Do not wait for a separate visualization request or treat them as an optional enhancement. Choose at least one meaningful interactive explanation per article, and cover additional central concepts when they benefit from separate visuals. A decorative animation or static image does not satisfy this requirement.
- Target the hard or confusing parts of the explanation. Use the user's questions and follow-ups to identify where intuition broke down: unfamiliar symbols, geometric meaning, intermediate derivation steps, tensor axes, or the effect of a parameter. Design each visualization around that specific learning obstacle and show what changes when the reader manipulates a control. Do not choose an easy but tangential concept merely to fulfill the visualization requirement.
- Put visualizations next to the explanation they support. Preserve the complete source explanation underneath or around them. Use the site's native HTML/SVG and local JavaScript for interactive diagrams; the static generator already produces HTML pages.
- Choose controls that teach the actual concept, such as projection direction, frequency, or EMA momentum. Label axes, reference distributions, units, and sample-versus-population distinctions. Use fixed seeds for sample illustrations. Do not present synthetic plots as experiments.
- Keep controls keyboard accessible, honor light/dark colors, and contain wide equations or algorithms without forcing page-wide overflow. The prose must remain useful without JavaScript.
- Validate the mathematics independently of the drawing code. For example, a unit projection of a standard isotropic Gaussian has population variance one; a finite sample need not. A mean of unit-circle arrows usually lies inside the circle.

## Verify and deliver

- Compare every selected source section with the finished article. Track explanations, examples, equations, and code in a private coverage checklist, not just heading or word counts. For unchanged English, compare the full text after removing only formatting transformations and additive visuals. For translation, compare each source passage and all equations, numbers, and links.
- Build from the site root and check the article, category listing, chapter order when relevant, math rendering, local links, and visual controls. Inspect the browser when available; report any blocked visual verification accurately.
- A request to write an article authorizes preparing it in the local site. Deploy only when the user also authorizes deployment, including authorization already given in the current task. Do not add an approval step if deployment is already authorized. Verify authentication, inspect repository changes, and use the repository's existing Pages workflow. Report the live URL only after deployment succeeds.
- Private conversation snapshots always remain outside the public repository unless the user explicitly requests their publication. The skill itself is public, MIT-licensed material and can be included in a repository when requested.
