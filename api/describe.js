export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "Missing url" });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not set in Vercel" });
  }

  try {

    const baseUrl = new URL(url).origin;

    const pagesToTry = [
      url,
      `${baseUrl}/about`,
      `${baseUrl}/about-us`,
      `${baseUrl}/company`,
      `${baseUrl}/who-we-are`
    ];

    let collectedText = "";
    let metaDescription = null;

    for (const page of pagesToTry) {
      try {

        const response = await fetch(page, {
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: 8000
        });

        if (!response.ok) continue;

        const html = await response.text();

        // Extract meta description
        if (!metaDescription) {
          const metaMatch = html.match(
            /<meta\s+name=["']description["']\s+content=["']([^"]+)["']/i
          );

          if (metaMatch && metaMatch[1]) {
            metaDescription = metaMatch[1];
          }
        }

        const cleaned = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 4000);

        collectedText += cleaned + "\n";

      } catch (e) {
        continue;
      }
    }

    // If meta description is good, return immediately
    if (metaDescription && metaDescription.length > 50) {
      return res.status(200).json({
        description: metaDescription
      });
    }

    collectedText = collectedText.slice(0, 12000);

    const prompt = `
You are writing a company description.

Using the website text below, write a clear 2–3 sentence business description that explains:
• what the company does
• who their customers are
• their main value proposition

Return only the description text.

Website content:
${collectedText}
`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      return res.status(aiResponse.status).json({
        error: data.error?.message || "Gemini API error"
      });
    }

    const description =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({
      description: description.trim()
    });

  } catch (err) {

    console.error("Describe API error:", err);

    return res.status(500).json({
      error: err.message
    });

  }
}