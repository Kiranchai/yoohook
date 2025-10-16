import express from "express";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import parseRawHeaders from "./utils/parseRawHeaders.js";
import cors from "cors";
import multer from "multer";
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  express.raw({
    type: ["application/octet-stream", "application/xml", "text/xml"],
  })
);
app.use(express.text());
app.use(cors());

const upload = multer();
const wss = new WebSocketServer({ noServer: true });

const clients = {};

const customResponses = {};

wss.on("connection", (ws, request) => {
  const userId = request.url?.split("/").pop();

  if (!userId) {
    console.error("Invalid userId");
    ws.close();
    return;
  }

  clients[userId] = ws;

  ws.on("close", () => {
    delete clients[userId];
  });
});

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

    const customResponse = {
      body: response.body,
      statusCode: Number(response.statusCode),
      headers: response.headers,
      bodyFormat: response.bodyFormat || "json",
    };

    const fullPath = req.params[0].length === 0 ? "/" : req.params[0];

    if (!customResponse) {
      return res.status(400).json({ error: "No custom response provided" });
    }

    if (!customResponses[webhookId]) {
      customResponses[webhookId] = {};
    }
    if (!customResponses[webhookId][fullPath]) {
      customResponses[webhookId][fullPath] = {};
    }

    customResponses[webhookId][fullPath][method] = customResponse;

    console.log(
      `Custom response set for ${method} ${fullPath} (format: ${customResponse.bodyFormat})`
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

app.all("/:webhookId*", upload.any(), function (req, res, next) {
  let body = req.body;

  if (req.is("application/xml") || req.is("text/xml")) {
    body = Buffer.from(req.body, "utf-8").toString();
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

    //Check for Basic auth
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Basic ")
    ) {
      const base64Credentials = req.headers.authorization.split(" ")[1];
      const credentials = Buffer.from(base64Credentials, "base64").toString(
        "ascii"
      );
      const [username, password] = credentials.split(":");
      payload["headers"] = {
        ...payload["headers"],
        base64username: username,
        base64password: password,
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

    // Send data to connected WebSocket client if available
    if (clients[webhookId]) {
      clients[webhookId].send(JSON.stringify(payload));
    }

    let fullPath = path;

    if (!fullPath.startsWith("/")) {
      fullPath = "/" + fullPath;
    }

    console.log(
      `Looking for custom response: ${webhookId} -> ${fullPath} -> ${method}`
    );
    console.log("Available webhookIds:", Object.keys(customResponses));
    if (customResponses[webhookId]) {
      console.log(
        "Available paths for webhookId:",
        Object.keys(customResponses[webhookId])
      );
      if (customResponses[webhookId][fullPath]) {
        console.log(
          "Available methods for path:",
          Object.keys(customResponses[webhookId][fullPath])
        );
      }
    }

    if (customResponses[webhookId]?.[fullPath]?.[method]) {
      const customResponse = customResponses[webhookId][fullPath][method];

      console.log(
        `FOUND custom response for ${method} ${fullPath} (format: ${
          customResponse.bodyFormat || "json"
        })`
      );
      console.log("Sending custom body:", customResponse.body);

      res.set(customResponse.headers);

      if (customResponse.bodyFormat === "xml") {
        if (
          !customResponse.headers["Content-Type"] &&
          !customResponse.headers["content-type"]
        ) {
          res.set("Content-Type", "application/xml");
        }
        console.log("Sending XML response");
        return res.status(customResponse.statusCode).send(customResponse.body);
      } else {
        if (
          !customResponse.headers["Content-Type"] &&
          !customResponse.headers["content-type"]
        ) {
          res.set("Content-Type", "application/json");
        }
        console.log("Sending JSON response");
        return res.status(customResponse.statusCode).json(customResponse.body);
      }
    } else {
      console.log(`NO custom response found for ${method} ${fullPath}`);
    }

    res.json({ status: "Webhook received", payload });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "An error occurred" });
  }
});
