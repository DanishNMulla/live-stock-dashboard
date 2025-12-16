// server.js
const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

// 10 supported stocks
const SUPPORTED_STOCKS = [
  "GOOG", "TSLA", "AMZN", "META", "NVDA",
  "MSFT", "AAPL", "NFLX", "IBM", "ORCL"
];

// Initialize random prices
const prices = {};
SUPPORTED_STOCKS.forEach(s => (prices[s] = randomPrice()));

function randomPrice() {
  // base between 100 and 1500
  return Number((100 + Math.random() * 1400).toFixed(2));
}

// Maps
const subscriptions = new Map(); // email -> Set(sym)
const clientEmail = new Map();   // ws -> email

wss.on("connection", ws => {
  console.log("Client connected");

  ws.on("message", message => {
    try {
      const data = JSON.parse(message);

      if (data.type === "login") {
        clientEmail.set(ws, data.email);
        subscriptions.set(data.email, new Set());
        console.log("Logged in:", data.email);
      }

      if (data.type === "subscribe") {
        const email = clientEmail.get(ws);
        if (!email) return;

        const allowed = (data.stocks || []).filter(s => SUPPORTED_STOCKS.includes(s));
        subscriptions.set(email, new Set(allowed));

        // send immediate prices for ack
        const payload = {};
        allowed.forEach(sym => payload[sym] = prices[sym]);
        ws.send(JSON.stringify({ type: "prices", prices: payload }));
      }
    } catch (err) {
      console.warn("Invalid message:", err);
    }
  });

  ws.on("close", () => {
    const email = clientEmail.get(ws);
    console.log("Client disconnected:", email);
    clientEmail.delete(ws);
  });
});

// Update prices and broadcast every second
setInterval(() => {
  // Random walk for each stock
  SUPPORTED_STOCKS.forEach(sym => {
    const change = (Math.random() - 0.5) * 10; // -5..+5 approx
    prices[sym] = Number(Math.max(1, prices[sym] + change).toFixed(2));
  });

  // Send to each connected client only the stocks they subscribed to
  wss.clients.forEach(ws => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const email = clientEmail.get(ws);
    if (!email) return;

    const subs = subscriptions.get(email);
    if (!subs || subs.size === 0) return;

    const payload = {};
    subs.forEach(sym => {
      if (prices[sym] !== undefined) payload[sym] = prices[sym];
    });

    // Only send if payload has keys
    if (Object.keys(payload).length > 0) {
      ws.send(JSON.stringify({ type: "prices", prices: payload }));
    }
  });
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Supported stocks:", SUPPORTED_STOCKS.join(", "));
});
