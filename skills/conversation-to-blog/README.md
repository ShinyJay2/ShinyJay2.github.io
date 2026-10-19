# Conversation to Blog

A Codex skill for turning selected conversation explanations into faithful English blog posts, with interactive visualizations focused on the hard or confusing parts.

It preserves the explanation sequence, worked examples, equations, derivation steps, code, and qualifications. It retrieves the actual conversation instead of generating an article from its topic alone. Every article includes useful interactive visuals unless the user explicitly requests otherwise.

## Install

Copy this complete `conversation-to-blog` directory into your Codex skills directory:

- `$CODEX_HOME/skills/conversation-to-blog` when `CODEX_HOME` is configured.
- Otherwise, `~/.codex/skills/conversation-to-blog`.

Keep `SKILL.md`, `agents/`, and `references/` together. The skill uses standard Codex conversation tools when available. If your environment cannot retrieve a conversation, provide the selected text or an export instead. No third-party service or API key is required by the skill itself.

## Use

> Use $conversation-to-blog to turn the explanations about eligibility traces in my “Reinforcement Learning” conversation into a blog post. Keep the examples and derivation steps, and add interactive visuals that clarify the confusing parts.

Tell Codex which blog repository to use. The [site reference](references/site.md) describes the static Markdown/KaTeX/HTML implementation in this repository, but the editorial workflow works with other blog generators. Adapt the content paths, renderer, and build instructions to that blog.

English is the default output language. Explicit user preferences take precedence. Deployment requires user authorization; drafting a post alone does not authorize publishing it. A previously authorized deployment does not require repeated confirmation.

## License and privacy

The files in **this skill directory** are available under the [MIT license](LICENSE). This license does not relicense the surrounding blog articles, photographs, third-party figures, or other repository assets.

The skill contains no conversation transcripts, credentials, or machine-specific paths. Retrieved source conversations should remain in private working files outside the public repository; publish only the selected article content.
