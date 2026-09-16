import "dotenv/config";

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
        "Copy .env.example to .env and fill in the values."
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

async function main() {
  assertEnv();

  try {
    const data = await callApi(API_URL, API_USERNAME, API_PASSWORD, {
      method: "GET",
    });

    console.log("Response:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("API call failed:", err.message);
    if (err.body) {
      console.error("Response body:", err.body);
    }
    process.exitCode = 1;
  }
}

main();
