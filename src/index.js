import "dotenv/config";
import http from "node:http";

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

async function callApi(url, username, password, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: buildAuthHeader(username, password),
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      `Request failed with status ${response.status} ${response.statusText}`
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.url === "/call-api") {
    try {
      assertEnv();
      const data = await callApi(API_URL, API_USERNAME, API_PASSWORD, {
        method: "GET",
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error("API call failed:", err.message);
      res.writeHead(err.status || 500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: err.message,
          body: err.body || null,
        })
      );
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Try GET /call-api" }));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
