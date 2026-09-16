import "dotenv/config";
import http from "node:http";
import os from "node:os";

const {
  API_URL,
  API_USERNAME,
  API_PASSWORD,
} = process.env;

function assertEnv() {
  const missing = ["API_URL", "API_USERNAME", "API_PASSWORD"].filter(
    (key) => !process.env[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Set these in your Render service's Environment tab."
    );
  }
}

function buildAuthHeader(username, password) {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

function headersToObject(headers) {
  const obj = {};
  for (const [key, value] of headers.entries()) {
    obj[key] = value;
  }
  return obj;
}

// Best local (non-internal) IPv4 address of this server process
function getServerLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

function getDeviceIp(req) {
  // Render (and most proxies) set x-forwarded-for: "client, proxy1, proxy2"
  const forwardedFor = req.headers["x-forwarded-for"];
  const deviceIp = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : req.socket.remoteAddress;

  return { deviceIp, forwardedFor: forwardedFor || null };
}

async function callApiWithMeta(url, username, password, options = {}) {
  const authHeader = buildAuthHeader(username, password);

  const requestMeta = {
    method: options.method || "GET",
    url,
    headers: {
      Authorization: "Basic ***redacted***",
      Accept: "application/json",
      ...(options.headers || {}),
    },
    sentAt: new Date().toISOString(),
  };

  const startedAt = Date.now();
  let response;
  let reached = false;
  let connectError = null;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    reached = true; // got an HTTP response, so the server was reachable
  } catch (err) {
    // fetch throws on network-level failures (DNS, connection refused, timeout, TLS, etc.)
    connectError = {
      message: err.message,
      code: err.cause?.code || null,
    };
  }

  const durationMs = Date.now() - startedAt;

  if (!reached) {
    const meta = {
      request: requestMeta,
      response: null,
      reached: false,
      connectError,
      durationMs,
    };
    console.log("callApi metadata:", JSON.stringify(meta, null, 2));
    const error = new Error(`Could not reach target server: ${connectError.message}`);
    error.meta = meta;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  const responseMeta = {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: headersToObject(response.headers),
    receivedAt: new Date().toISOString(),
  };

  const meta = {
    request: requestMeta,
    response: responseMeta,
    reached: true,
    durationMs,
  };

  console.log("callApi metadata:", JSON.stringify(meta, null, 2));

  if (!response.ok) {
    const error = new Error(
      `Request failed with status ${response.status} ${response.statusText}`
    );
    error.status = response.status;
    error.body = body;
    error.meta = meta;
    throw error;
  }

  return { data: body, meta };
}

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.url === "/metadata") {
    const { deviceIp, forwardedFor } = getDeviceIp(req);

    const metadata = {
      device: {
        ip: deviceIp,
        forwardedFor,
        userAgent: req.headers["user-agent"] || null,
        headers: req.headers,
      },
      server: {
        hostname: os.hostname(),
        localIp: getServerLocalIp(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptimeSeconds: process.uptime(),
        port: PORT,
      },
      auth: {
        scheme: "Basic",
        targetApiUrl: API_URL || null,
        username: API_USERNAME || null,
        passwordSet: Boolean(API_PASSWORD),
      },
      timestamp: new Date().toISOString(),
    };

    console.log("metadata:", JSON.stringify(metadata, null, 2));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(metadata, null, 2));
    return;
  }

  if (req.url === "/call-api") {
    try {
      assertEnv();
      const { data, meta } = await callApiWithMeta(API_URL, API_USERNAME, API_PASSWORD, {
        method: "POST",
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data, meta }, null, 2));
    } catch (err) {
      console.error("API call failed:", err.message);
      res.writeHead(err.status || 502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          {
            error: err.message,
            body: err.body || null,
            meta: err.meta || null,
          },
          null,
          2
        )
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Try GET /call-api, /metadata, or /health" }));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
