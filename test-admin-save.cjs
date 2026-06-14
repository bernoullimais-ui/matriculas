const fetch = require("node-fetch");
const crypto = require("crypto");

const ADMIN_TOKEN_SECRET = "741e108c781ec05f333ac5eac37dfbadc3d30f3725d54d4fb9fe00913d2fe02f";
const payload = JSON.stringify({ user: "bmaia", exp: Date.now() + 8 * 60 * 60 * 1000 });
const payloadB64 = Buffer.from(payload).toString('base64url');
const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payloadB64).digest('hex');
const token = `${payloadB64}.${sig}`;

async function run() {
  const res = await fetch("https://www.sportforkids.com.br/api/admin/website-configs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      hero_carousel: [{ title: "Teste via script" }],
      header_logo_url: "https://example.com/logo.png"
    })
  });
  const data = await res.text();
  console.log("Status:", res.status);
  console.log("Data:", data);
}
run();
