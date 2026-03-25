const baseUrl = process.env.TARGET_SUPABASE_URL || "";
const anonKey = process.env.TARGET_SUPABASE_ANON_KEY || "";
const email = process.env.SMOKE_TEST_EMAIL || "";
const password = process.env.SMOKE_TEST_PASSWORD || "";

function fail(message) {
  console.error(`[selfhost-smoke] ${message}`);
  process.exit(1);
}

async function parseJsonSafe(resp) {
  const raw = await resp.text();
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

if (!baseUrl || !anonKey) {
  fail("Missing TARGET_SUPABASE_URL or TARGET_SUPABASE_ANON_KEY");
}

if (!email || !password) {
  fail("Missing SMOKE_TEST_EMAIL or SMOKE_TEST_PASSWORD");
}

const tokenUrl = `${baseUrl}/auth/v1/token?grant_type=password`;

const tokenResp = await fetch(tokenUrl, {
  method: "POST",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password }),
});

const tokenBody = await parseJsonSafe(tokenResp);

if (!tokenResp.ok || !tokenBody?.access_token) {
  const message = tokenBody?.msg || tokenBody?.error_description || tokenBody?.message || tokenBody?.raw || "token endpoint failed";
  fail(`Auth token failed (${tokenResp.status}): ${message}`);
}

const accessToken = tokenBody.access_token;

const userResp = await fetch(`${baseUrl}/auth/v1/user`, {
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  },
});

const userBody = await parseJsonSafe(userResp);
if (!userResp.ok || !userBody?.id) {
  const message = userBody?.msg || userBody?.error_description || userBody?.message || userBody?.raw || "user endpoint failed";
  fail(`Auth user failed (${userResp.status}): ${message}`);
}

const dashboardResp = await fetch(`${baseUrl}/functions/v1/admin-dashboard`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});

const dashboardBody = await parseJsonSafe(dashboardResp);
if (!dashboardResp.ok) {
  const message = dashboardBody?.message || dashboardBody?.error || dashboardBody?.raw || "admin-dashboard failed";
  fail(`Edge function check failed (${dashboardResp.status}): ${message}`);
}

console.log("[selfhost-smoke] OK");
console.log(`[selfhost-smoke] user: ${userBody.email || userBody.id}`);
console.log(`[selfhost-smoke] users in dashboard: ${Array.isArray(dashboardBody?.users) ? dashboardBody.users.length : "n/a"}`);
