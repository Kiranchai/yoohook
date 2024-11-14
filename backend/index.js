import express from "express";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
const app = express();
const port = 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: "application/octet-stream" }));
app.use(express.text());

const wss = new WebSocketServer({ noServer: true });

const clients = {};

const customResponses = {};

wss.on("connection", (ws, request) => {
  const userId = request.url.split("/").pop();
  clients[userId] = ws;

  ws.on("close", () => {
    delete clients[userId];
  });
});

app.post("/set-response/:id", (req, res) => {
  const userId = req.params.id;
  const customResponse = req.body;
  if (!customResponse) {
    return res.status(400).json({ error: "No custom response provided" });
  }

  customResponses[userId] = customResponse;

  res.json({
    status: "Custom response set successfully",
    userId,
    customResponse,
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

app.all("/:id/*", function (req, res, next) {
  const userId = req.params.id;
  const payload = {
    headers: req.headers,
    body: req.body,
    host: req.hostname,
    protocol: req.protocol,
    path: req.path.split("/").slice(2).join("/"),
    queryParams: req.query,
    method: req.method,
    time: Date.now(),
    id: uuidv4(),
  };

  // Send data to connected WebSocket client if available
  if (clients[userId]) {
    clients[userId].send(JSON.stringify(payload));
  }

  res.json({ status: "Webhook received", payload });
});
