// AceLens website: the download buttons. Follows GitHub's release redirects here, then
// sends the browser straight to GitHub's file server (its address carries no account
// name). Always the latest release.
const FILES = { windows: "AceLens-Setup.exe", mac: "AceLens-mac.dmg" };
const REPO = "https://github.com/inbantamizhselvan/acelens/releases/latest/download/";

module.exports = async (req, res) => {
  const os = String((req.query && req.query.os) || "windows").toLowerCase() === "mac" ? "mac" : "windows";
  let url = REPO + FILES[os];
  try {
    for (let i = 0; i < 4; i++) {
      const r = await fetch(url, { method: "HEAD", redirect: "manual" });
      const loc = r.headers.get("location");
      if (!loc || r.status < 300 || r.status >= 400) break;
      url = new URL(loc, url).toString();
      if (!/(^|\.)github\.com$/i.test(new URL(url).hostname)) break; // reached the file server
    }
  } catch (e) {
    // GitHub unreachable from here: fall back to the plain link
  }
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
};
