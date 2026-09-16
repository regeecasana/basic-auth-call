# Basic Auth API Client

A minimal Node.js script that calls an API using HTTP Basic Authentication.

## Requirements

- Node.js 18+ (uses the built-in `fetch`)

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your API URL and credentials:

```
API_URL=https://api.example.com/endpoint
API_USERNAME=your_username
API_PASSWORD=your_password
```

## Usage

```bash
npm start
```

## How it works

The script builds the `Authorization: Basic <base64(username:password)>` header manually and passes it to `fetch`. See `src/index.js` — `callApi()` is reusable for GET/POST/PUT/etc. by passing a `method` and `body` via the `options` argument.

## Project structure

```
.
├── src/
│   └── index.js       # main script
├── .env.example        # template for required env vars
├── .gitignore
├── package.json
└── README.md
```

## Notes

- Credentials are read from environment variables, never hardcoded.
- `.env` is gitignored — only `.env.example` should be committed.
