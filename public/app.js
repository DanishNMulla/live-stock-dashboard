// public/app.js
// Frontend logic for Live Stock Dashboard (Glassmorphism UI)

const SUPPORTED = [
  "GOOG", "TSLA", "AMZN", "META", "NVDA",
  "MSFT", "AAPL", "NFLX", "IBM", "ORCL"
];

let ws = null;
let myEmail = null;
let mySubs = new Set();
let livePrices = {};
let priceHistory = {}; // { SYMBOL: [prices...] }
let mainChart = null;

// UI Elements
const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");

const emailInput = document.getElementById("emailInput");
const emailError = document.getElementById("emailError");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const supportedList = document.getElementById("supportedList");

const subTableBody = document.querySelector("#subTable tbody");
const userEmailEl = document.getElementById("userEmail");

const graphSelector = document.getElementById("graphSelector");
const statusMsg = document.getElementById("statusMsg");

window.addEventListener("load", init);

function init() {
  // Render supported stocks list
  SUPPORTED.forEach(sym => {
    const li = document.createElement("li");
    li.className = "supported-item";
    li.innerHTML = `
      <div class="sym">${sym}</div>
      <button class="btn subscribe" data-sym="${sym}">Subscribe</button>
    `;
    supportedList.appendChild(li);
  });

  loginBtn.onclick = login;
  logoutBtn.onclick = logout;

  supportedList.onclick = onSupportedClick;
  subTableBody.onclick = onSubTableClick;

  searchInput.oninput = handleSearch;
  searchResults.onclick = onSearchResultClick;
  graphSelector.onchange = updateMainChart;

  setupMainChart();
}

/* ---------------- LOGIN ---------------- */
function login() {
  const email = emailInput.value.trim();
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

  if (!email) return showError("Email is required");
  if (!gmailRegex.test(email)) return showError("Enter a valid Gmail address");

  clearError();
  myEmail = email;
  userEmailEl.textContent = email;

  loginView.style.display = "none";
  dashboardView.style.display = "grid";

  connectWebSocket();
}

function logout() {
  if (ws) ws.close();

  mySubs.clear();
  livePrices = {};
  priceHistory = {};

  dashboardView.style.display = "none";
  loginView.style.display = "block";
}

/* ---------------- ERRORS ---------------- */
function showError(msg) {
  emailError.textContent = msg;
}
function clearError() {
  emailError.textContent = "";
}

/* ---------------- SEARCH ---------------- */
function handleSearch() {
  const q = searchInput.value.trim().toUpperCase();
  searchResults.innerHTML = "";

  if (!q) {
    searchResults.style.display = "none";
    return;
  }

  const matches = SUPPORTED.filter(s => s.includes(q));
  if (matches.length === 0) {
    searchResults.style.display = "none";
    return;
  }

  matches.forEach(sym => {
    const li = document.createElement("li");
    li.className = "search-item";
    li.innerHTML = `
      <span>${sym}</span>
      <button class="btn small subscribe" data-sym="${sym}">Subscribe</button>
    `;
    searchResults.appendChild(li);
  });

  searchResults.style.display = "block";
}

function onSearchResultClick(e) {
  const btn = e.target.closest("button[data-sym]");
  if (!btn) return;

  mySubs.add(btn.dataset.sym);
  sendSubs();
  renderSubscribed();

  searchResults.style.display = "none";
  searchInput.value = "";
}

/* ---------------- SUBSCRIBE / UNSUBSCRIBE ---------------- */
function onSupportedClick(e) {
  const btn = e.target.closest("button[data-sym]");
  if (!btn) return;

  const sym = btn.dataset.sym;
  mySubs.has(sym) ? mySubs.delete(sym) : mySubs.add(sym);

  sendSubs();
  renderSubscribed();
}

function onSubTableClick(e) {
  const btn = e.target.closest("button[data-sym]");
  if (!btn) return;

  mySubs.delete(btn.dataset.sym);
  sendSubs();
  renderSubscribed();
}

/* ---------------- WEBSOCKET (FIXED) ---------------- */
function connectWebSocket() {
  // 🔥 IMPORTANT FIX: ws / wss auto-switch
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "login", email: myEmail }));
    sendSubs();
    if (statusMsg) statusMsg.textContent = "Connected";
  };

  ws.onmessage = evt => {
    const msg = JSON.parse(evt.data);
    if (msg.type === "prices") {
      Object.assign(livePrices, msg.prices);
      updateHistory(msg.prices);
      renderSubscribed();
      updateMainChart();
    }
  };

  ws.onclose = () => {
    if (statusMsg) statusMsg.textContent = "Disconnected";
  };
}

function sendSubs() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: "subscribe",
    stocks: Array.from(mySubs)
  }));
}

/* ---------------- HISTORY ---------------- */
function updateHistory(prices) {
  Object.keys(prices).forEach(sym => {
    if (!priceHistory[sym]) priceHistory[sym] = [];
    priceHistory[sym].push(prices[sym]);
    if (priceHistory[sym].length > 60) priceHistory[sym].shift();
  });
}

/* ---------------- RENDER SUBSCRIPTIONS ---------------- */
function renderSubscribed() {
  subTableBody.innerHTML = "";

  graphSelector.innerHTML = `<option value="">Select Stock</option>`;
  mySubs.forEach(sym => {
    const opt = document.createElement("option");
    opt.value = sym;
    opt.textContent = sym;
    graphSelector.appendChild(opt);
  });

  if (mySubs.size === 0) {
    subTableBody.innerHTML = `<tr><td colspan="4">No subscriptions</td></tr>`;
    return;
  }

  mySubs.forEach(sym => {
    const price = livePrices[sym] ?? "--";
    const canvasId = `spark-${sym}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${sym}</td>
      <td>${price}</td>
      <td><canvas id="${canvasId}" class="sparkline"></canvas></td>
      <td><button class="btn small danger" data-sym="${sym}">Unsubscribe</button></td>
    `;
    subTableBody.appendChild(tr);

    drawSparkline(canvasId, priceHistory[sym] || []);
  });
}

/* ---------------- MAIN GRAPH ---------------- */
function setupMainChart() {
  const ctx = document.getElementById("priceChart").getContext("2d");

  mainChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Price",
        data: [],
        borderColor: "#8be9fd",
        borderWidth: 2,
        tension: 0.3
      }]
    },
    options: {
      plugins: { legend: { display: true } },
      scales: { x: { display: false } }
    }
  });
}

function updateMainChart() {
  const selected = graphSelector.value;
  if (!selected) return;

  const data = priceHistory[selected] || [];
  mainChart.data.labels = data.map((_, i) => i);
  mainChart.data.datasets[0].data = data;
  mainChart.data.datasets[0].label = `${selected} Price`;
  mainChart.update();
}

/* ---------------- SPARKLINE ---------------- */
function drawSparkline(id, data) {
  const existing = Chart.getChart(id);
  if (existing) existing.destroy();

  const ctx = document.getElementById(id);
  if (!ctx) return;

  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: "#7bed9f",
        borderWidth: 1.2,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: {
      responsive: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } }
    }
  });
}
