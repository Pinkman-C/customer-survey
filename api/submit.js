// Vercel serverless function — POST /api/submit
// Validates the survey payload and forwards it to the n8n webhook (which
// then writes to Google Sheets). Never blocks the respondent's experience:
// if n8n is unreachable or slow, we still return { success: true } and log
// the failure server-side for follow-up.

const REQUIRED_FIELDS = ["timestamp", "lang", "survey_type", "segment", "nps"];
const N8N_TIMEOUT_MS = 5000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
  }

  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Missing payload" });
  }

  const missing = REQUIRED_FIELDS.filter((field) => {
    const val = body[field];
    return val === undefined || val === null || val === "";
  });

  if (missing.length > 0) {
    return res.status(400).json({ error: `Champs obligatoires manquants: ${missing.join(", ")}` });
  }

  if (body.survey_type !== "vendeurs" && body.survey_type !== "acheteurs") {
    return res.status(400).json({ error: "survey_type invalide" });
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("[api/submit] N8N_WEBHOOK_URL is not configured");
    return res.status(200).json({ success: true });
  }

  try {
    await forwardToN8n(webhookUrl, body);
  } catch (err) {
    console.error("[api/submit] Failed to forward to n8n:", err.message || err);
  }

  return res.status(200).json({ success: true });
};

function forwardToN8n(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`n8n webhook returned HTTP ${response.status}`);
      }
      return response;
    })
    .finally(() => clearTimeout(timeout));
}
