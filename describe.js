export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const { url } = req.body || {};
    if (!url) { res.status(400).json({ error: 'Missing url' }); return; }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' }); return; }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-beta': 'web-search-2025-03-05'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                tools: [{ type: 'web_search_20250305', name: 'web_search' }],
                messages: [{
                    role: 'user',
                    content: 'Search for information about the company at ' + url + '. Write a concise 2-3 sentence business description: what they do, who their customers are, and their key value proposition. Return only the description text with no headers, labels, or markdown.'
                }]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
            return;
        }

        // Extract all text blocks (web search may produce multiple content blocks)
        let text = '';
        if (Array.isArray(data.content)) {
            for (const block of data.content) {
                if (block.type === 'text') text += block.text;
            }
        }

        res.status(200).json({ description: text.trim() });

    } catch (err) {
        console.error('API proxy error:', err);
        res.status(500).json({ error: err.message });
    }
}
