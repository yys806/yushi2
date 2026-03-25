import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8787);

const routes = {
  "POST /api/users/signup": "signup-user",
  "POST /api/admin/dashboard": "admin-dashboard",
  "POST /api/applications/review": "review-application",
  "POST /api/notices/publish": "publish-notice",
  "POST /api/notices/update": "update-notice",
  "POST /api/grade-probabilities/update": "update-grade-probabilities",
  "POST /api/claims/claim-reward": "claim-reward",
  "POST /api/claims/claim-s-grade-reward": "claim-s-grade-reward",
  "POST /api/museum/items/publish": "publish-museum-item",
  "POST /api/museum/items/update": "update-museum-item",
  "POST /api/admin/adjust-user-quota": "adjust-user-quota",
  "POST /api/users/delete": "admin-delete-user",
  "POST /api/notices/delete": "admin-delete-notice",
  "POST /api/museum/items/delete": "admin-delete-museum-item",
  "POST /api/orders/create": "create-order",
  "POST /api/works/generate": "generate-work",
  "POST /api/works/rate": "rate-work",
};

function writeJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = req.url || "/";

  if (method === "OPTIONS") {
    writeJson(res, 204, {});
    return;
  }

  if (method === "GET" && url === "/healthz") {
    writeJson(res, 200, { ok: true, service: "yushi-selfhost-api", uptime: process.uptime() });
    return;
  }

  if (method === "GET" && url === "/api/_inventory") {
    writeJson(res, 200, {
      ok: true,
      message: "API route inventory for Supabase-to-selfhost migration",
      routes,
    });
    return;
  }

  const key = `${method} ${url}`;
  if (routes[key]) {
    writeJson(res, 501, {
      ok: false,
      code: "NOT_IMPLEMENTED",
      route: key,
      mapping: routes[key],
      message: "Route scaffolded. Implement business logic using server-side DB/auth.",
    });
    return;
  }

  writeJson(res, 404, { ok: false, code: "NOT_FOUND", message: "Unknown route" });
});

server.listen(PORT, () => {
  console.log(`[server] yushi selfhost API scaffold listening on :${PORT}`);
});
