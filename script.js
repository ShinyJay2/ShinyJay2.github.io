// =============================================
//  Dynamic content: GitHub repos & Blog posts
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    fetchGitHubRepos();
    fetchBlogPosts();
});

// ---------- GitHub Repositories ----------
async function fetchGitHubRepos() {
    const container = document.getElementById('github-projects');
    const GITHUB_USER = 'ShinyJay2';
    const EXCLUDE = ['ShinyJay2']; // exclude profile repo

    try {
        const res = await fetch(
            `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=30`
        );
        if (!res.ok) throw new Error('GitHub API error');
        const repos = await res.json();

        const filtered = repos
            .filter(r => !r.fork && !EXCLUDE.includes(r.name))
            .slice(0, 6);

        if (filtered.length === 0) {
            container.innerHTML = '<p class="loading-text">No repositories found.</p>';
            return;
        }

        container.innerHTML = filtered.map(repo => {
            const lang = repo.language || '';
            const langClass = lang.toLowerCase().replace(/\s+/g, '-') || 'default';
            const desc = repo.description || 'No description.';
            const stars = repo.stargazers_count > 0
                ? `<span class="project-tags"> &#9733; ${repo.stargazers_count}</span>`
                : '';

            return `
                <div class="project">
                    ${lang ? `<span class="project-lang lang-${langClass}">${lang}</span>` : ''}
                    <h3><a href="${repo.html_url}" target="_blank">${formatRepoName(repo.name)}</a></h3>
                    <p>${escapeHtml(desc)}</p>
                    ${stars}
                </div>
            `;
        }).join('');

    } catch (err) {
        // Fallback to static content
        container.innerHTML = `
            <div class="project">
                <h3><a href="https://github.com/ShinyJay2/qwen3.5-korean-lora-finetune" target="_blank">Qwen3.5 Korean LoRA Fine-tune</a></h3>
                <p>LoRA fine-tuning of Qwen3.5-0.8B on Korean instruction data with KoBEST benchmark evaluation.</p>
                <span class="project-tags">LLM &middot; LoRA &middot; Korean NLP</span>
            </div>
            <div class="project">
                <h3><a href="https://github.com/ShinyJay2/Qwen3-14B-Quantization-NVIDIA-L40S-48-GB-VRAM-" target="_blank">Qwen3-14B Quantization Benchmark</a></h3>
                <p>QLoRA quantization benchmark: BF16 vs NF4 4-bit vs QLoRA on Qwen3-14B.</p>
                <span class="project-tags">Quantization &middot; QLoRA &middot; Benchmark</span>
            </div>
            <div class="project">
                <h3><a href="https://github.com/ShinyJay2/Deep_learning_Paper_implementations" target="_blank">Deep Learning Paper Implementations</a></h3>
                <p>PyTorch implementations: ResNet, SimCLR, Transformer, VAE, DQN, PPO, RepVGG.</p>
                <span class="project-tags">PyTorch &middot; ResNet &middot; SimCLR &middot; PPO</span>
            </div>
            <div class="project">
                <h3><a href="https://github.com/ShinyJay2/To_The_Transformer" target="_blank">To The Transformer</a></h3>
                <p>Full Transformer implementation for Korean-English translation from scratch.</p>
                <span class="project-tags">Transformer &middot; NLP &middot; Translation</span>
            </div>
            <div class="project">
                <h3><a href="https://github.com/ShinyJay2/Explainable-AI" target="_blank">Explainable AI</a></h3>
                <p>Implementations of various XAI methods for neural network interpretability.</p>
                <span class="project-tags">XAI &middot; Interpretability</span>
            </div>
            <div class="project">
                <h3><a href="https://github.com/ShinyJay2/financial-agent" target="_blank">Financial Agent</a></h3>
                <p>AI agent for financial analysis, Mirae Asset Securities AI Festival.</p>
                <span class="project-tags">AI Agent &middot; Finance</span>
            </div>
        `;
    }
}

// ---------- Blog Posts (RSS via proxy) ----------
async function fetchBlogPosts() {
    const container = document.getElementById('blog-posts');
    const BLOG_RSS = 'https://jaehoonstudy.tistory.com/rss';

    try {
        // Use allorigins as CORS proxy
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(BLOG_RSS)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('RSS fetch failed');
        const text = await res.text();

        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        const items = xml.querySelectorAll('item');

        if (items.length === 0) throw new Error('No items');

        const posts = Array.from(items).slice(0, 8).map(item => {
            const title = item.querySelector('title')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';
            const date = pubDate ? formatDate(new Date(pubDate)) : '';
            return { title, link, date };
        });

        container.innerHTML = posts.map(post => `
            <div class="blog-post">
                <span class="blog-date">${post.date}</span>
                <a href="${post.link}" target="_blank">${escapeHtml(post.title)}</a>
            </div>
        `).join('');

    } catch (err) {
        // Fallback to static content
        container.innerHTML = `
            <div class="blog-post">
                <span class="blog-date">Mar 2026</span>
                <a href="https://jaehoonstudy.tistory.com/" target="_blank">Qwen3.5 0.8B Korean Fine-tuning with LoRA</a>
            </div>
            <div class="blog-post">
                <span class="blog-date">Feb 2026</span>
                <a href="https://jaehoonstudy.tistory.com/" target="_blank">Everything about Transformers</a>
            </div>
            <div class="blog-post">
                <span class="blog-date">Feb 2026</span>
                <a href="https://jaehoonstudy.tistory.com/" target="_blank">Learning Nonlinear Operators via DeepONet</a>
            </div>
            <div class="blog-post">
                <span class="blog-date">Feb 2026</span>
                <a href="https://jaehoonstudy.tistory.com/" target="_blank">Physics Informed Deep Learning (Part I)</a>
            </div>
            <div class="blog-post">
                <span class="blog-date">Jan 2026</span>
                <a href="https://jaehoonstudy.tistory.com/" target="_blank">DeepSeek-R1: Incentivizing Reasoning Capability in LLMs</a>
            </div>
        `;
    }
}

// ---------- Helpers ----------
function formatRepoName(name) {
    return name
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(date) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
