// api/name-sheet.js
// Fetches plan image server-side (no CORS) → sends to Anthropic as base64
// Keep AI_MODEL in sync with App.jsx
const AI_MODEL = 'claude-sonnet-4-20250514';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    // Detect media type from URL extension first — more reliable than CDN content-type headers
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    const extMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
    let mediaType = extMap[ext] || null;

    // Fetch with retry — CDN may not have propagated immediately after upload
    let arrayBuf = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt));
      try {
        const imgRes = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
        if (!imgRes.ok) { lastErr = `HTTP ${imgRes.status}`; continue; }

        // Fall back to content-type header if extension didn't tell us
        if (!mediaType) {
          const ct = imgRes.headers.get('content-type') || '';
          const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          mediaType = validTypes.find(t => ct.includes(t)) || 'image/jpeg';
        }

        arrayBuf = await imgRes.arrayBuffer();
        if (arrayBuf.byteLength < 1000) { lastErr = `Too small (${arrayBuf.byteLength}B)`; arrayBuf = null; continue; }
        break; // success
      } catch (e) { lastErr = e.message; }
    }

    if (!arrayBuf) {
      console.error('name-sheet: image fetch failed after retries:', lastErr, url);
      return res.status(200).json({ name: null, error: lastErr });
    }

    const b64 = Buffer.from(arrayBuf).toString('base64');

    // Send to Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Haiku: faster + cheaper for this simple OCR task
        max_tokens: 60,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: 'Look at the title block of this construction drawing (usually bottom-right corner). Extract the sheet number and sheet title.\nReply with ONLY this format: SHEET_NUMBER - SHEET_TITLE\nExample: C3.01 - SITE PLAN\nExample: A-101 - FLOOR PLAN\nIf no title block is visible, reply: UNKNOWN' }
          ]
        }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('name-sheet: Anthropic error', anthropicRes.status, errText);
      return res.status(200).json({ name: null, error: `Anthropic ${anthropicRes.status}` });
    }

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
