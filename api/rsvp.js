const { mkdir, appendFile } = require("node:fs/promises");
const path = require("node:path");

const allowedStatuses = new Set(["unavailable", "available", "preferred"]);

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function cleanText(value, maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function parseAvailability(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      id: cleanText(item && item.id, 40),
      label: cleanText(item && item.label, 80),
      detail: cleanText(item && item.detail, 120),
      status: cleanText(item && item.status, 40)
    }))
    .filter((item) => item.id && item.label && allowedStatuses.has(item.status));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed." });
  }

  let payload;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    return json(res, 400, { error: "Invalid JSON body." });
  }

  const name = cleanText(payload.name, 120);
  const email = cleanText(payload.email, 180).toLowerCase();
  const eventName = cleanText(payload.eventName, 160);
  const eventNameId = cleanText(payload.eventNameId, 80);
  const themeSeen = cleanText(payload.themeSeen, 40);
  const planningSuggestion = cleanText(payload.planningSuggestion, 1200);
  const scoreLow = Number(payload.scoreRange && payload.scoreRange.low);
  const scoreHigh = Number(payload.scoreRange && payload.scoreRange.high);
  const handicapEstimateLow = Number(payload.scoreRange && payload.scoreRange.handicapEstimateLow);
  const handicapEstimateHigh = Number(payload.scoreRange && payload.scoreRange.handicapEstimateHigh);
  const availability = parseAvailability(payload.availability);

  if (name.length < 2) {
    return json(res, 400, { error: "Name is required." });
  }

  if (!isValidEmail(email)) {
    return json(res, 400, { error: "A valid email is required." });
  }

  if (!Number.isFinite(scoreLow) || !Number.isFinite(scoreHigh) || scoreLow < 50 || scoreHigh > 160 || scoreLow > scoreHigh) {
    return json(res, 400, { error: "Score range is invalid." });
  }

  if (availability.length === 0) {
    return json(res, 400, { error: "Availability is required." });
  }

  const hasOpenWeekend = availability.some((item) => item.status === "available" || item.status === "preferred");

  if (!hasOpenWeekend) {
    return json(res, 400, { error: "Please leave at least one weekend available or preferred." });
  }

  const record = {
    event_name: eventName,
    event_name_id: eventNameId,
    theme_seen: themeSeen,
    planning_suggestion: planningSuggestion || null,
    name,
    email,
    score_low: scoreLow,
    score_high: scoreHigh,
    handicap_estimate_low: Number.isFinite(handicapEstimateLow) ? handicapEstimateLow : null,
    handicap_estimate_high: Number.isFinite(handicapEstimateHigh) ? handicapEstimateHigh : null,
    availability,
    submitted_at: new Date().toISOString(),
    user_agent: req.headers["user-agent"] || null
  };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tableName = process.env.SUPABASE_TABLE || "golf_rsvps";

  if (supabaseUrl && supabaseServiceRoleKey) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(tableName)}`, {
      method: "POST",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(record)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Supabase insert failed", response.status, detail);
      return json(res, 500, { error: "Could not save response. Please try again." });
    }

    return json(res, 200, { message: "You're in. Your availability was recorded privately." });
  }

  if (process.env.NODE_ENV !== "production") {
    const directory = path.join(process.cwd(), ".local-submissions");
    await mkdir(directory, { recursive: true });
    await appendFile(path.join(directory, "rsvps.jsonl"), `${JSON.stringify(record)}\n`, "utf8");
    return json(res, 200, { message: "Saved locally for development. Configure Supabase before deploying." });
  }

  return json(res, 503, {
    error: "Storage is not configured yet. Add Supabase environment variables in Vercel before sharing the link."
  });
};
