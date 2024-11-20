import express from "express";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
const app = express();
const port = 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "application/octet-stream" }));
app.use(express.text());
app.use(cors());

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
    const reqBody = JSON.parse(req.body);
    const customResponse = {
      body: JSON.parse(reqBody.body),
      statusCode: Number(reqBody.statusCode),
      headers: JSON.parse(reqBody.headers),
    };

    const fullPath = req.params[0].length === 0 ? "/" : req.params[0];

    if (!customResponse) {
      return res.status(400).json({ error: "No custom response provided" });
    }

    if (!customResponses[webhookId]) {
      customResponses[webhookId] = {};
    }
    if (!customResponses[webhookId][[fullPath]]) {
      customResponses[webhookId][fullPath] = {};
    }

    customResponses[webhookId][fullPath][method] = customResponse;

    res.json({
      message: "Custom response set successfully",
      path: fullPath,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "An error occurred" });
  }
});

app.all("/:webhookId*", function (req, res, next) {
  try {
    const { webhookId } = req.params;
    const path = req.params[0];
    const method = req.method;

    const payload = {
      headers: req.headers,
      body: req.body,
      host: req.hostname,
      protocol: req.protocol,
      fullPath: req.path,
      path: req.path.split("/").slice(2).join("/"),
      queryParams: req.query,
      method: req.method,
      time: Date.now(),
      id: uuidv4(),
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

    // Send data to connected WebSocket client if available
    if (clients[webhookId]) {
      clients[webhookId].send(JSON.stringify(payload));
    }

    const fullPath = "/" + path;

    if (customResponses[webhookId]?.[fullPath]?.[method]) {
      const customResponse = customResponses[webhookId][fullPath][method];
      res.set(customResponse.headers);
      return res.status(customResponse.statusCode).json(customResponse.body);
    }

    res.json({ status: "Webhook received", payload });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "An error occurred" });
  }
});
