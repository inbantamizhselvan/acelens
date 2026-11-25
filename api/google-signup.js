// AceLens website: "Continue with Google" before a download. The page sends the Google
// sign-in token here; this checks with Google that the token is genuine and meant for
// AceLens's site, then adds the sign-up row (name, verified email, the optional answers)
// through AceLens's own service, exactly like the typed-in form. The download never waits
// on the sheet: a slow or failed save still answers ok.

// The site's Google sign-in Client ID (public by design; from Google Cloud → Google Auth
// Platform → Clients). Empty = Google sign-in switched off (the page hides the button).
const CLIENT_ID = "";
const SVC = "https://script.google.com/macros/s/AKfycbzvOi7xddEQ1ECrXSBmoXx7d9Rv5idyovLTZeQcwBP0VLbN0Iab5a_BrmdRgjEM4cTr/exec";

const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const send = (code, obj) => {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };
  if (req.method !== "POST") return send(405, { ok: false, error: "POST only." });
  if (!CLIENT_ID) return send(503, { ok: false, error: "Google sign-in isn't switched on yet." });

  let b = req.body;
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch (e) { b = {}; }
  }
  b = b || {};
  const cred = String(b.credential || "");
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(cred) || cred.length > 4096) return send(400, { ok: false, error: "No Google sign-in came through." });

  // Google's own check of the token: signature, expiry — and it returns the claims
  let t;
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(cred));
    if (!r.ok) return send(401, { ok: false, error: "Google didn't confirm this sign-in. Please try again." });
    t = await r.json();
  } catch (e) {
    return send(502, { ok: false, error: "Couldn't reach Google just now." });
  }
  const issOk = t.iss === "accounts.google.com" || t.iss === "https://accounts.google.com";
  const fresh = Number(t.exp) * 1000 > Date.now();
  const verified = String(t.email_verified) === "true";
  if (t.aud !== CLIENT_ID || !issOk || !fresh || !verified || !t.email) {
    return send(401, { ok: false, error: "Google didn't confirm this sign-in. Please try again." });
  }

  const email = clip(t.email, 120).toLowerCase();
  const name = clip(t.name || [t.given_name, t.family_name].filter(Boolean).join(" ") || email.split("@")[0], 80);
  const row = {
    action: "signup",
    name,
    email,
    role: clip(b.role, 40),
    age: clip(b.age, 20),
    state: clip(b.state, 30),
    heard: clip(b.heard, 60),
    consent: !!b.consent,
    os: b.os === "macOS" ? "macOS" : "Windows",
    page: "acelens.vercel.app · Google",
  };
  try {
    await Promise.race([
      fetch(SVC, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(row) }),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
  } catch (e) {
    // the sheet is best-effort; the download goes ahead
  }
  return send(200, { ok: true, first: name.split(" ")[0] });
};
