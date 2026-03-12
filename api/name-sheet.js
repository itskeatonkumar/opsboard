// api/name-sheet.js
// Fetches plan image server-side (no CORS) → sends to Anthropic as base64
// Client only sends the URL — tiny request body, bypasses Vercel 4.5MB limit entirely

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    // 1. Fetch image from Supabase server-side — no CORS restrictions
    const imgRes = await fetch(url);
    if (!imgRes.ok) return res.status(400).json({ error: `Image fetch failed: ${imgRes.status}` });

    const arrayBuf = await imgRes.arrayBuffer();
    const b64 = Buffer.from(arrayBuf).toString('base64');

    // Detect media type
    const ct = imgRes.headers.get('content-type') || 'image/png';
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mediaType = validTypes.includes(ct) ? ct : (ct.includes('jpeg') || ct.includes('jpg') ? 'image/jpeg' : 'image/png');

    // 2. Send to Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: 'This is a construction drawing sheet. Find the title block (usually bottom-right corner) and extract the sheet number and sheet title. Reply with ONLY: SHEET_NUMBER - SHEET_TITLE\nExample: C3.60 - PIPE CHART\nIf no title block is visible, reply: UNKNOWN' }
          ]
        }]
      })
    });

    const data = await anthropicRes.json();
    const raw = (data?.content?.find(b => b.type === 'text')?.text || '').trim();
    if (!raw || raw.toUpperCase().includes('UNKNOWN') || raw.length < 3) {
      return res.status(200).json({ name: null });
    }
    return res.status(200).json({ name: raw.replace(/^["'`*\s]+|["'`*\s]+$/g, '').trim() });

  } catch (err) {
    console.error('name-sheet error:', err);
    return res.status(500).json({ error: err.message });
  }
}
