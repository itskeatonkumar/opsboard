import formidable from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = formidable({ maxFileSize: 25 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "Failed to parse upload" });

    const file = files.audio?.[0] || files.audio;
    if (!file) return res.status(400).json({ error: "No audio file" });

    try {
      const fd = new FormData();
      fd.append("file", fs.createReadStream(file.filepath), {
        filename: "audio.webm",
        contentType: file.mimetype || "audio/webm",
      });
      fd.append("model", "whisper-1");
      fd.append("language", "en");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...fd.getHeaders(),
        },
        body: fd,
      });

      const data = await response.json();
      if (data.error) return res.status(500).json({ error: data.error.message });
      res.status(200).json({ text: data.text });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
