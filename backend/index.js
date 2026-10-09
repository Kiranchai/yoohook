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

const customResponses = {};

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

app.post("/set-response/:webhookId/:method*", (req, res) => {
  try {
    const { webhookId, method } = req.params;
    const response = req.body;

    console.log("Received set-response request:", {
      webhookId,
      method,
      fullPath: req.params[0].length === 0 ? "/" : req.params[0],
      body: response,
    });

    if (
      !response ||
      response.body === undefined ||
      !response.statusCode ||
      !response.headers
    ) {
      console.log("Invalid request format:", { response });
      return res.status(400).json({ error: "Invalid custom response format" });
    }

    const statusCode = Number(response.statusCode);
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      return res
        .status(400)
        .json({
          error: "Invalid status code. Must be an integer between 100 and 599.",
        });
    }

    const customResponse = {
      body: response.body,
      statusCode,
      headers: response.headers,
      bodyFormat: response.bodyFormat || "json",
    };

    const fullPath = req.params[0].length === 0 ? "/" : req.params[0];

    if (!customResponses[webhookId]) {
      customResponses[webhookId] = {};
    }
    if (!customResponses[webhookId][fullPath]) {
      customResponses[webhookId][fullPath] = {};
    }

    customResponses[webhookId][fullPath][method] = customResponse;

    console.log(
      `Custom response set for ${method} ${fullPath} (format: ${customResponse.bodyFormat})`,
    );
    console.log("Stored custom response body:", customResponse.body);

    res.json({
      message: "Custom response set successfully",
      path: fullPath,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "An error occurred" });
  }
});

app.delete("/delete-response/:webhookId/:method*", (req, res) => {
  try {
    const { webhookId, method } = req.params;
    const fullPath = req.params[0].length === 0 ? "/" : req.params[0];

    if (customResponses[webhookId]?.[fullPath]?.[method]) {
      delete customResponses[webhookId][fullPath][method];
      if (Object.keys(customResponses[webhookId][fullPath]).length === 0) {
        delete customResponses[webhookId][fullPath];
      }
      if (Object.keys(customResponses[webhookId]).length === 0) {
        delete customResponses[webhookId];
      }
      console.log(`Deleted custom response for ${method} ${fullPath}`);
      return res.json({ message: "Custom response deleted", path: fullPath });
    }

    return res.status(404).json({ error: "Custom response not found" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "An error occurred" });
  }
});

app.delete("/delete-responses/:webhookId", (req, res) => {
  try {
    const { webhookId } = req.params;
    if (customResponses[webhookId]) {
      delete customResponses[webhookId];
      console.log(`Deleted all custom responses for ${webhookId}`);
    }
    return res.json({ message: "All custom responses deleted" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "An error occurred" });
  }
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
    const responseInfo = { custom: false, echo: true, body: null, bodyFormat: "json" };

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

    let fullPath = path;

    if (!fullPath.startsWith("/")) {
      fullPath = "/" + fullPath;
    }

    console.log(
      `Looking for custom response: ${webhookId} -> ${fullPath} -> ${method}`,
    );
    console.log("Available webhookIds:", Object.keys(customResponses));
    if (customResponses[webhookId]) {
      console.log(
        "Available paths for webhookId:",
        Object.keys(customResponses[webhookId]),
      );
      if (customResponses[webhookId][fullPath]) {
        console.log(
          "Available methods for path:",
          Object.keys(customResponses[webhookId][fullPath]),
        );
      }
    }

    if (customResponses[webhookId]?.[fullPath]?.[method]) {
      const customResponse = customResponses[webhookId][fullPath][method];

      console.log(
        `FOUND custom response for ${method} ${fullPath} (format: ${
          customResponse.bodyFormat || "json"
        })`,
      );
      console.log("Sending custom body:", customResponse.body);

      res.set(customResponse.headers);

      const contentTypeMap = {
        json: "application/json",
        xml: "application/xml",
        text: "text/plain",
        html: "text/html",
        yaml: "application/yaml",
        "form-urlencoded": "application/x-www-form-urlencoded",
      };

      const bodyFormat = customResponse.bodyFormat || "json";

      if (
        bodyFormat !== "raw" &&
        contentTypeMap[bodyFormat] &&
        !customResponse.headers["Content-Type"] &&
        !customResponse.headers["content-type"]
      ) {
        res.set("Content-Type", contentTypeMap[bodyFormat]);
      }

      console.log(`Sending ${bodyFormat} response`);

      const responseBody =
        bodyFormat === "json" && typeof customResponse.body === "object"
          ? JSON.stringify(customResponse.body)
          : customResponse.body;

      responseInfo.custom = true;
      responseInfo.echo = false;
      responseInfo.body = customResponse.body;
      responseInfo.bodyFormat = bodyFormat;

      return res.status(customResponse.statusCode).send(responseBody);
    } else {
      console.log(`NO custom response found for ${method} ${fullPath}`);
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
