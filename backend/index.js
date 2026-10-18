import express from "express";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import parseRawHeaders from "./utils/parseRawHeaders.js";
import cors from "cors";
import multer from "multer";
const app = express();
const port = 3000;

// Webhook payloads (GitHub, Shopify, …) regularly exceed the 100 kB default.
const BODY_LIMIT = "10mb";
// Binary bodies are forwarded to the inspector only up to this size.
const MAX_FORWARDED_BINARY = 1024 * 1024;
const HEARTBEAT_MS = 30_000;

// Parse JSON (including `application/*+json`, e.g. CloudEvents), but keep
// malformed JSON bodies as raw text instead of rejecting the request, so the
// inspector can show what was actually sent.
const jsonParser = express.json({
  limit: BODY_LIMIT,
  type: ["application/json", "application/*+json"],
});
app.use((req, res, next) => {
  jsonParser(req, res, (err) => {
    if (err && err.type === "entity.parse.failed") {
      req.body = err.body;
      return next();
    }
    next(err);
  });
});
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use(
  express.text({
    limit: BODY_LIMIT,
    type: ["text/*", "application/yaml", "application/x-yaml"],
  }),
);
// Everything else (XML, octet-stream, images, PDFs, protobuf…) is kept as raw
// bytes. Multipart is left to multer in the webhook route.
app.use(
  express.raw({
    limit: BODY_LIMIT,
    type: (req) => !req.is("multipart/*") && !!req.headers["content-type"],
  }),
);
app.use(cors());

const upload = multer();
const wss = new WebSocketServer({ noServer: true });

// webhookId -> every open inspector socket for it (several tabs may watch the
// same webhook, and a reconnecting tab briefly has two sockets).
const clients = new Map();

const addClient = (webhookId, ws) => {
  if (!clients.has(webhookId)) clients.set(webhookId, new Set());
  clients.get(webhookId).add(ws);
};

const removeClient = (webhookId, ws) => {
  const sockets = clients.get(webhookId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) clients.delete(webhookId);
};

const broadcast = (webhookId, message) => {
  const sockets = clients.get(webhookId);
  if (!sockets) return;
  const data = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
};

wss.on("connection", (ws, request) => {
  const webhookId = new URL(request.url ?? "", "http://localhost").pathname
    .split("/")
    .filter(Boolean)
    .pop();

  if (!webhookId) {
    console.error("WebSocket connection without a webhook id");
    ws.close(1008, "Missing webhook id");
    return;
  }

  addClient(webhookId, ws);
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("close", () => removeClient(webhookId, ws));

  ws.on("error", (err) => {
    console.error(`WebSocket error for ${webhookId}:`, err.message);
    removeClient(webhookId, ws);
  });
});

// Proxies drop idle connections silently; ping every socket and drop the ones
// that stopped answering, so neither side keeps a dead connection around.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// ───────── Custom responses ─────────
// Kept in memory only: a restart clears them, and the inspector (which keeps
// its own copy in the browser) can push them back with POST /responses/:id.
// webhookId -> Map("METHOD /path/{param}" -> rule)
const customResponses = new Map();

const isParam = (segment) => /^\{[^/{}]+\}$/.test(segment);
const splitPath = (path) => path.split("/").filter(Boolean);
const normalisePath = (path) => "/" + splitPath(path || "/").join("/");

const CONTENT_TYPES = {
  json: "application/json",
  xml: "application/xml",
  text: "text/plain",
  html: "text/html",
  yaml: "application/yaml",
  "form-urlencoded": "application/x-www-form-urlencoded",
};

function toRule(method, path, response) {
  if (!response || typeof response !== "object") {
    throw new Error("Invalid custom response format");
  }
  if (typeof method !== "string" || !/^[a-z]+$/i.test(method)) {
    throw new Error("Invalid method");
  }
  const statusCode = Number(response.statusCode);
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    throw new Error("Invalid status code. Must be an integer between 100 and 599.");
  }
  const endpoint = normalisePath(path);
  const segments = splitPath(endpoint);
  return {
    method: method.toUpperCase(),
    endpoint,
    statusCode,
    headers: response.headers && typeof response.headers === "object" ? response.headers : {},
    body: response.body ?? "",
    bodyFormat: response.bodyFormat || "json",
    segments,
    // Literal segments win over parameters: /customers/search before /customers/{id}.
    specificity: segments.filter((s) => !isParam(s)).length,
  };
}

const ruleKey = (rule) => `${rule.method} ${rule.endpoint}`;

function setRule(webhookId, rule) {
  if (!customResponses.has(webhookId)) customResponses.set(webhookId, new Map());
  customResponses.get(webhookId).set(ruleKey(rule), rule);
}

function findRule(webhookId, method, path) {
  const rules = customResponses.get(webhookId);
  if (!rules) return null;
  let requestSegments;
  try {
    requestSegments = splitPath(path).map(decodeURIComponent);
  } catch {
    requestSegments = splitPath(path);
  }
  let best = null;
  for (const rule of rules.values()) {
    if (rule.method !== method || rule.segments.length !== requestSegments.length) continue;
    const ok = rule.segments.every((s, i) => isParam(s) || s === requestSegments[i]);
    if (ok && (!best || rule.specificity > best.specificity)) best = rule;
  }
  return best;
}

const summarise = (rule) => ({
  method: rule.method,
  endpoint: rule.endpoint,
  statusCode: rule.statusCode,
});

app.post("/set-response/:webhookId/:method*", (req, res) => {
  try {
    const rule = toRule(req.params.method, req.params[0], req.body);
    setRule(req.params.webhookId, rule);
    console.log(`Custom response set: ${req.params.webhookId} ${ruleKey(rule)} -> ${rule.statusCode}`);
    res.json({ message: "Custom response set successfully", path: rule.endpoint });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Active custom responses, so the inspector can tell whether they survived a restart.
app.get("/responses/:webhookId", (req, res) => {
  const rules = customResponses.get(req.params.webhookId);
  res.json({ responses: rules ? Array.from(rules.values(), summarise) : [] });
});

function parseRules(list) {
  if (!Array.isArray(list)) throw new Error("Expected { responses: [...] }");
  return list.map((item, i) => {
    try {
      return toRule(item?.method, item?.endpoint, item);
    } catch (err) {
      throw new Error(`responses[${i}]: ${err.message}`);
    }
  });
}

// Add or update many custom responses at once (OpenAPI import, restore after a restart).
app.post("/responses/:webhookId", (req, res) => {
  try {
    const rules = parseRules(req.body?.responses);
    rules.forEach((rule) => setRule(req.params.webhookId, rule));
    console.log(`Custom responses set: ${req.params.webhookId} (+${rules.length})`);
    res.json({ message: "Custom responses set", count: rules.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Replace every custom response of a webhook.
app.put("/responses/:webhookId", (req, res) => {
  try {
    const rules = parseRules(req.body?.responses);
    customResponses.delete(req.params.webhookId);
    rules.forEach((rule) => setRule(req.params.webhookId, rule));
    console.log(`Custom responses replaced: ${req.params.webhookId} (${rules.length})`);
    res.json({ message: "Custom responses set", count: rules.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/delete-response/:webhookId/:method*", (req, res) => {
  const { webhookId, method } = req.params;
  const rules = customResponses.get(webhookId);
  const key = `${method.toUpperCase()} ${normalisePath(req.params[0])}`;
  if (!rules?.delete(key)) {
    return res.status(404).json({ error: "Custom response not found" });
  }
  if (rules.size === 0) customResponses.delete(webhookId);
  res.json({ message: "Custom response deleted", path: normalisePath(req.params[0]) });
});

app.delete("/delete-responses/:webhookId", (req, res) => {
  customResponses.delete(req.params.webhookId);
  res.json({ message: "All custom responses deleted" });
});

const toHeaderCase = (name) =>
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");

app.all("/:webhookId*", upload.any(), function (req, res, next) {
  const startedAt = Date.now();
  let body = req.body;

  if (Buffer.isBuffer(body)) {
    if (req.is(["application/xml", "text/xml", "application/*+xml"])) {
      body = body.toString("utf-8");
    } else {
      // Serialises like a Buffer ({ type, data }) plus the real size, capped
      // so a large upload can't flood the WebSocket or the browser's storage.
      body = {
        type: "Buffer",
        data: Array.from(body.subarray(0, MAX_FORWARDED_BINARY)),
        size: body.length,
        truncated: body.length > MAX_FORWARDED_BINARY,
      };
    }
  }

  try {
    const { webhookId } = req.params;
    const path = req.params[0];
    const method = req.method;

    const payload = {
      headers: parseRawHeaders(req.rawHeaders),
      body: body,
      host: req.hostname,
      protocol: req.protocol,
      fullPath: req.path,
      path: req.path.split("/").slice(2).join("/"),
      queryParams: req.query,
      method: req.method,
      time: Date.now(),
      id: uuidv4(),
      formData: {},
    };

    // Decode Basic auth into its own field, so the headers stay exactly as sent.
    const authorization = req.headers.authorization;
    if (authorization && /^Basic /i.test(authorization)) {
      const credentials = Buffer.from(
        authorization.slice(6).trim(),
        "base64",
      ).toString("utf-8");
      const separator = credentials.indexOf(":");
      payload.basicAuth =
        separator === -1
          ? { username: credentials, password: "" }
          : {
              username: credentials.slice(0, separator),
              password: credentials.slice(separator + 1),
            };
    }

    if (req.is("multipart/form-data")) {
      req.files.forEach((file) => {
        payload.formData[file.fieldname] = {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer.toString("base64"),
        };
      });

      Object.keys(req.body).forEach((key) => {
        payload.formData[key] = req.body[key];
      });
    }

    // What we answered with; filled in below and sent to the inspector together
    // with the request once the response has been written.
    const responseInfo = {
      custom: false,
      echo: true,
      body: null,
      bodyFormat: "json",
    };

    res.on("finish", () => {
      payload.response = {
        status: res.statusCode,
        headers: Object.fromEntries(
          Object.entries(res.getHeaders()).map(([key, value]) => [
            toHeaderCase(key),
            Array.isArray(value) ? value.join(", ") : String(value),
          ]),
        ),
        ...responseInfo,
        durationMs: Date.now() - startedAt,
      };

      broadcast(webhookId, payload);
    });

    const rule = findRule(webhookId, method, path || "/");

    if (rule) {
      res.set(rule.headers);

      const bodyFormat = rule.bodyFormat;
      const hasContentType = Object.keys(rule.headers).some(
        (h) => h.toLowerCase() === "content-type",
      );
      if (bodyFormat !== "raw" && CONTENT_TYPES[bodyFormat] && !hasContentType) {
        res.set("Content-Type", CONTENT_TYPES[bodyFormat]);
      }

      // Always send text: res.send(42) would be taken as a status code.
      const responseBody =
        typeof rule.body === "string" ? rule.body : JSON.stringify(rule.body);

      responseInfo.custom = true;
      responseInfo.echo = false;
      responseInfo.body = rule.body;
      responseInfo.bodyFormat = bodyFormat;
      responseInfo.endpoint = rule.endpoint;

      return res.status(rule.statusCode).send(responseBody);
    }

    res.json({ status: "Webhook received", payload });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "An error occurred" });
  }
});

// Body-parser errors (e.g. 413 for bodies over BODY_LIMIT) as JSON instead of
// Express's default HTML page with a stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error:
      status === 413
        ? `Payload too large. The limit is ${BODY_LIMIT}.`
        : status >= 500
          ? "An error occurred"
          : err.message,
  });
});
