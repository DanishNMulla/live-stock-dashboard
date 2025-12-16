// public/app.js
// Frontend logic for Glass UI dashboard

const SUPPORTED = [
  "GOOG","TSLA","AMZN","META","NVDA",
  "MSFT","AAPL","NFLX","IBM","ORCL"
];

let ws = null;
let myEmail = null;
let mySubs = new Set();
let livePrices = {};
let priceHistory = {}; // {SYM: [p1,p2,...]}
let mainChart = null;

// UI elements
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
  // Render supported list
  SUPPORTED.forEach(sym => {
    const li = document.createElement("li");
    li.className = "supported-item";
    li.innerHTML = `
      <div class="sym">${sym}</div>
      <button class="btn subscribe" data-sym="${sym}">Subscribe</button>
    `;
    supportedList.appendChild(li);
  });

  // Events
  loginBtn.addEventListener("click", login);
  logoutBtn.addEventListener("click", logout);

  supportedList.addEventListener("click", onSupportedClick);
  subTableBody.addEventListener("click", onSubTableClick);

  searchInput.addEventListener("input", handleSearch);
  searchResults.addEventListener("click", onSearchResultClick);

  graphSelector.addEventListener("change", updateMainChart);

  setupMainChart();

  // show default status
  statusMsg.textContent = "";
}

/* ---------- AUTH ---------- */
function showError(msg) {
  emailError.textContent = msg;
}
function clearError() {
  emailError.textContent = "";
}

function login() {
  const email = emailInput.value.trim();
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

  if (!email) return showError("Email is required.");
  if (!gmailRegex.test(email)) return showError("Use a valid Gmail address (example@gmail.com).");

  clearError();
  myEmail = email;
  userEmailEl.textContent = myEmail;

  loginView.style.display = "none";
  dashboardView.style.display = "grid";

  connectWebSocket();
}

function logout() {
  if (ws) ws.close();
  ws = null;

  mySubs.clear();
  livePrices = {};
  priceHistory = {};
  userEmailEl.textContent = "—";

  dashboardView.style.display = "none";
  loginView.style.display = "block";
  // clear UI lists
  renderSubscribed();
  graphSelector.innerHTML = "";
}

/* ---------- SEARCH ---------- */
function handleSearch() {
  const q = searchInput.value.trim().toUpperCase();
  searchResults.innerHTML = "";
  if (!q) { searchResults.style.display = "none"; return; }

  const matched = SUPPORTED.filter(s => s.includes(q));
  if (matched.length === 0) { searchResults.style.display = "none"; return; }

  matched.forEach(sym => {
    const li = document.createElement("li");
    li.className = "search-item";
    li.innerHTML = `<span>${sym}</span><button class="btn small subscribe" data-sym="${sym}">Subscribe</button>`;
    searchResults.appendChild(li);
  });

  searchResults.style.display = "block";
}
function onSearchResultClick(e) {
  const btn = e.target.closest("button[data-sym]");
  if (!btn) return;
  const sym = btn.dataset.sym;
  mySubs.add(sym);
  sendSubs();
  renderSubscribed();
  searchResults.style.display = "none";
  searchInput.value = "";
}

/* ---------- SUPPORTED / SUBSCRIBE HANDLERS ---------- */
function onSupportedClick(e) {
  const btn = e.target.closest("button[data-sym]");
  if (!btn) return;
  const sym = btn.dataset.sym;
  if (mySubs.has(sym)) mySubs.delete(sym);
  else mySubs.add(sym);
  sendSubs();
  renderSubscribed();
}

function onSubTableClick(e) {
  const btn = e.target.closest("button[data-sym]");
  if (!btn) return;
  const sym = btn.dataset.sym;
  mySubs.delete(sym);
  sendSubs();
  renderSubscribed();
}

/* ---------- WebSocket ---------- */
function connectWebSocket() {
  ws = new WebSocket(`ws://${location.host}`);

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify({ type: "login", email: myEmail }));
    // send any current subs
    sendSubs();
    statusMsg.textContent = "Connected";
  });

  ws.addEventListener("message", (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === "prices" && msg.prices) {
        // update livePrices
        Object.assign(livePrices, msg.prices);
        // update history
        updateHistory(msg.prices);
        // re-render UI and charts
        renderSubscribed();
        updateMainChart();
      }
    } catch (err) {
      console.warn("Bad message", err);
    }
  });

  ws.addEventListener("close", () => {
    statusMsg.textContent = "Disconnected";
  });

  ws.addEventListener("error", () => {
    statusMsg.textContent = "Connection error";
  });
}

function sendSubs() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "subscribe", stocks: Array.from(mySubs) }));
}

/* ---------- Maintain price history ---------- */
function updateHistory(prices) {
  // prices is an object {SYM: price}
  // record history only for subscribed stocks for lightness
  Object.keys(prices).forEach(sym => {
    if (!priceHistory[sym]) priceHistory[sym] = [];
    priceHistory[sym].push(prices[sym]);
    if (priceHistory[sym].length > 60) priceHistory[sym].shift(); // keep last 60
  });
}

/* ---------- Render subscriptions & sparklines ---------- */
function renderSubscribed() {
  // update graph selector while keeping selection if possible
  const prev = graphSelector.value || "";
  graphSelector.innerHTML = `<option value="">Select Stock</option>`;
  mySubs.forEach(sym => {
    const opt = document.createElement("option");
    opt.value = sym;
    opt.textContent = sym;
    graphSelector.appendChild(opt);
  });
  // restore selection if still present
  if (prev && Array.from(graphSelector.options).some(o => o.value === prev)) {
    graphSelector.value = prev;
  } else {
    // if prev removed, clear chart
    if (!graphSelector.value) {
      clearMainChart();
    }
  }

  // render table rows
  subTableBody.innerHTML = "";
  if (mySubs.size === 0) {
    subTableBody.innerHTML = `<tr><td colspan="4" class="empty">No subscriptions</td></tr>`;
    return;
  }

  mySubs.forEach(sym => {
    const price = (livePrices[sym] !== undefined) ? livePrices[sym].toFixed(2) : "--";
    const canvasId = `spark-${sym}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="td-sym">${sym}</td>
      <td class="td-price">${price}</td>
      <td><canvas id="${canvasId}" class="sparkline"></canvas></td>
      <td><button class="btn small danger" data-sym="${sym}">Unsubscribe</button></td>
    `;
    subTableBody.appendChild(tr);

    // draw sparkline (destroy existing chart if present)
    drawSparkline(canvasId, priceHistory[sym] || []);
  });
}

/* ---------- Main Chart ---------- */
function setupMainChart() {
  const ctx = document.getElementById("priceChart").getContext("2d");
  mainChart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [{ label: "Price", data: [], borderColor: "#8be9fd", borderWidth: 2, tension: 0.25 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { x: { display: true }, y: { beginAtZero: false } }
    }
  });
}

function updateMainChart() {
  const selected = graphSelector.value;
  if (!selected) {
    // clear chart
    mainChart.data.labels = [];
    mainChart.data.datasets[0].data = [];
    mainChart.update();
    return;
  }

  const arr = priceHistory[selected] || [];
  mainChart.data.labels = arr.map((_, i) => i);
  mainChart.data.datasets[0].data = arr;
  mainChart.data.datasets[0].label = `${selected} Price`;
  mainChart.update();
}

function clearMainChart() {
  if (!mainChart) return;
  mainChart.data.labels = [];
  mainChart.data.datasets[0].data = [];
  mainChart.update();
}

/* ---------- Sparkline util ---------- */
function drawSparkline(canvasId, data) {
  // destroy existing chart on the same canvas id
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  // Keep small sample if too long
  const arr = (data || []).slice(-40);

  new Chart(ctx, {
    type: "line",
    data: { labels: arr.map((_, i) => i), datasets: [{ data: arr, borderColor: "#7bed9f", borderWidth: 1.2, tension: 0.3, pointRadius: 0 }] },
    options: { responsive: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
  });
}
