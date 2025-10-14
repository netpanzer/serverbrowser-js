// server_browser.js
const dgram = require("dgram");
const fs = require("fs");
const path = require("path");
const https = require("https");
const net = require("net");
const http = require("http");

const {
  getCurrentMonthYear,
  updatePlayerStats,
  getRanking,
  countPlayers,
} = require("./ranking");

// =============================
// ======= SERVER BROWSER ======
// =============================

class GamesNetPanzerBrowser {
  constructor() {
    this.masterservers = [{ host: "netpanzer.io", port: 28900 }];
    this.mastersstack = [...this.masterservers];
    this.gameservers = {};
    this.refreshInterval = 15000;
    this.currentMonthYear = getCurrentMonthYear();

  // used to aggregate updates (prevents duplication when multiple responses arrive)
    this.pendingDeltas = {};
    this.flushTimer = null;

    this.startServerRefresh();
    this.startHybridServer();
  }

  // Apply all aggregated deltas to the DB (runs updatePlayerStats per player)
  flushPendingDeltas() {
    const names = Object.keys(this.pendingDeltas);
    if (names.length === 0) return;
    try {
      for (const name of names) {
        const d = this.pendingDeltas[name];
        if (!d) continue;
        try {
          // update once with the aggregated deltas
          updatePlayerStats(name, d.kills || 0, d.deaths || 0, d.points || 0, this.currentMonthYear);
        } catch (e) {
          console.error('Error applying aggregated delta for', name, e);
        }
      }
    } finally {
      // limpa o buffer
      this.pendingDeltas = {};
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
    }
  }

  start() {
    this.browseMasters();
  }

  browseMasters() {
    if (this.mastersstack.length === 0) {
      this.getGameServersStatus();
      return;
    }

  const master = this.mastersstack.pop();
  console.log(`🌐 Connecting to master ${master.host}:${master.port}`);

    const client = new net.Socket();
    client.connect(master.port, master.host, () =>
      client.write("\\list\\gamename\\netpanzer\\final\\")
    );

    client.on("data", (data) => {
      this.addGameServers(this.parseServerList(data.toString(), master));
      client.destroy();
      this.browseMasters();
    });

    client.on("error", (err) => {
      console.error("❌ Error connecting to master:", err.message);
      this.browseMasters();
    });
  }

  parseServerList(data, master) {
    const servers = [];
    const tokens = data.split("\\");
    for (let i = 1; i < tokens.length - 1; i += 2) {
      if (tokens[i] === "ip" && tokens[i + 2] === "port") {
        servers.push({
          ip: tokens[i + 1],
          port: parseInt(tokens[i + 3], 10),
          masterserver: master,
          cache: { players: [] },
        });
      }
    }
    return servers;
  }

  addGameServers(serverList) {
    serverList.forEach((s) => {
      const key = `${s.ip}:${s.port}`;
      if (!this.gameservers[key]) {
        console.log("🆕 Server added:", key);
        // initialize cache and load last persisted stats (if any)
        s.cache = s.cache || { players: [] };
        try {
          const { getLastStatsForServer } = require("./ranking");
          const persisted = getLastStatsForServer(key, this.currentMonthYear);
          s.cache.lastStats = persisted || {};
        } catch (err) {
          console.warn('⚠️ Could not load persisted lastStats for', key, err.message || err);
          s.cache.lastStats = {};
        }
        this.gameservers[key] = s;
      }
    });
  }

  getGameServersStatus() {
    Object.values(this.gameservers).forEach((s) => this.queryServerStatus(s));
  }

  queryServerStatus(server) {
    try {
      const udpClient = dgram.createSocket("udp4");
      udpClient.send(Buffer.from("\\status\\final\\"), server.port, server.ip);

      udpClient.on("message", (data) => {
        try {
          const info = this.parseServerStatus(data.toString());
          const newPlayers = (info.players || []).map((p) => ({
            name: p.name || "Unknown",
            kills: Number(p.kills || 0),
            deaths: Number(p.deaths || 0),
            points: Number(p.points || 0),
          }));
          // calculate deltas relative to last known state to avoid duplication
          server.cache.lastStats = server.cache.lastStats || {};
          for (const p of newPlayers) {
            const name = p.name;
            // last can come from in-memory cache or the persisted table loaded in addGameServers
            const last = server.cache.lastStats[name] || { kills: 0, deaths: 0, points: 0 };
            let dk = p.kills - (last.kills || 0);
            let dd = p.deaths - (last.deaths || 0);
            let dp = p.points - (last.points || 0);
            if (dk < 0) dk = p.kills;
            if (dd < 0) dd = p.deaths;

            // accumulate in the global deltas buffer to apply in batch
            if (name) {
              const cur = this.pendingDeltas[name] || { kills: 0, deaths: 0, points: 0 };
              cur.kills = (cur.kills || 0) + (dk || 0);
              cur.deaths = (cur.deaths || 0) + (dd || 0);
              cur.points = (cur.points || 0) + (dp || 0);
              this.pendingDeltas[name] = cur;
              // schedule flush shortly (debounce)
              if (!this.flushTimer) {
                this.flushTimer = setTimeout(() => this.flushPendingDeltas(), 500);
              }
            }

            // update local cache with the absolute state
            server.cache.lastStats[name] = { kills: p.kills, deaths: p.deaths, points: p.points };
            // persist the last state for this server+player to survive restarts
            try {
              const { upsertLastStats } = require("./ranking");
              upsertLastStats(`${server.ip}:${server.port}`, name, p.kills, p.deaths, p.points, this.currentMonthYear);
            } catch (err) {
              console.warn('⚠️ Failed to persist lastStats for', name, err.message || err);
            }
          }
          server.cache.players = newPlayers;
          server.cache.hostname = info.hostname || "N/A";
          server.cache.mapname = info.mapname || "N/A";
          server.cache.gamestyle = info.gamestyle || "N/A";
          server.cache.numplayers = info.players ? info.players.length : 0;
          
        } catch (err) {
          console.error("⚠️ Error processing UDP response:", err);
        } finally {
          udpClient.close();
        }
      });

      udpClient.on("error", (err) => {
        console.error("⚠️ UDP error:", err.message);
        udpClient.close();
      });
    } catch (err) {
      console.error("❌ General failure in queryServerStatus:", err);
    }
  }

  parseServerStatus(data) {
    const info = { players: [] };
    const tokens = data.split("\\");
    for (let i = 0; i < tokens.length - 1; i += 2) {
      const key = tokens[i],
        val = tokens[i + 1];
      if (key.startsWith("player_")) {
        const idx = parseInt(key.split("_")[1], 10);
        info.players[idx] = info.players[idx] || {};
        info.players[idx].name = val;
      } else if (key.startsWith("kills_")) {
        const idx = parseInt(key.split("_")[1], 10);
        info.players[idx] = info.players[idx] || {};
        info.players[idx].kills = Number(val);
      } else if (key.startsWith("deaths_")) {
        const idx = parseInt(key.split("_")[1], 10);
        info.players[idx] = info.players[idx] || {};
        info.players[idx].deaths = Number(val);
      } else if (key.startsWith("points_")) {
        const idx = parseInt(key.split("_")[1], 10);
        info.players[idx] = info.players[idx] || {};
        info.players[idx].points = Number(val);
      } else info[key] = val;
    }
    return info;
  }

  getCSS() {
    return `
    /* Base */
    :root{--bg:#0f172a;--card:#0b1220;--muted:#94a3b8;--accent:#06b6d4;--glass:rgba(255,255,255,0.04)}
    body{font-family:Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background:linear-gradient(180deg,#0b1220 0%, #071027 100%);color:#e6eef8;margin:0;padding:28px}
    .container{max-width:1200px;margin:0 auto}
    h1{font-weight:600;margin:0 0 8px 0;color:#fff}
    .card{background:var(--card);border-radius:12px;padding:14px;box-shadow:0 8px 24px rgba(2,6,23,0.6);margin-bottom:18px}
    table{width:100%;border-collapse:collapse;margin-top:10px;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border-radius:8px;overflow:hidden}
    thead th{padding:12px 14px;background:linear-gradient(90deg,var(--bg),#07122a);color:#fff;text-align:left;position:relative}
    tbody td{padding:12px 14px;border-top:1px solid rgba(255,255,255,0.03)}
    tbody tr:hover td{background:linear-gradient(90deg, rgba(255,255,255,0.01), rgba(255,255,255,0.02))}
    .muted{color:var(--muted);font-size:13px}
    .badge{display:inline-block;padding:6px 10px;border-radius:999px;background:var(--glass);color:#e6eef8;font-weight:600}
    .search{display:flex;gap:8px;align-items:center}
    input[type=text]{padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit}
    a.button{display:inline-block;padding:8px 12px;border-radius:8px;background:linear-gradient(90deg,#06b6d4,#3b82f6);color:#061024;text-decoration:none;font-weight:600}
    .trophy{font-size:18px;margin-right:6px}
    @media (max-width:760px){body{padding:12px}.container{padding:0 8px}}
    `;
  }

  generateRankingHTML(search = "", page = 1, perPage = 20) {
    const total = countPlayers(this.currentMonthYear, search);
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;
    const ranking = getRanking(this.currentMonthYear, search, perPage, offset);

    const trophy = (rank) => {
      if (rank === 1) return '🏆';
      if (rank === 2) return '🥈';
      if (rank === 3) return '🥉';
      return '';
    };

  let html = `<html><head><title>Monthly Ranking</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${this.getCSS()}</style></head><body><div class="container">`;
  html += `<div class="card"><header style="display:flex;justify-content:space-between;align-items:center"><div><h1>Monthly Ranking - ${this.currentMonthYear}</h1><div class="muted">Total: ${total} players</div></div><div><form method="GET" style="display:flex;gap:8px"><input type="text" name="search" placeholder="Search player" value="${search}"><button class="button" type="submit">Search</button></form></div></header></div>`;

  html += `<div class="card"><table class="ranking-table"><thead><tr><th>Rank</th><th>Player</th><th>Kills</th><th>Deaths</th><th>Points</th></tr></thead><tbody>`;

    ranking.forEach((p, i) => {
      const rank = offset + i + 1;
      const trophyEmoji = trophy(rank);
      html += `<tr><td>${rank} ${trophyEmoji ? `<span class="trophy">${trophyEmoji}</span>` : ''}</td><td>${p.name}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.points}</td></tr>`;
    });

    html += `</tbody></table></div><div style="text-align:center;margin-top:12px">`;
    for (let i = 1; i <= totalPages; i++) {
      if (i === page) html += `<span class="badge">${i}</span> `;
      else
        html += `<a href="/ranking?page=${i}&search=${encodeURIComponent(search)}" class="badge" style="opacity:0.85">${i}</a> `;
    }

    html += `</div></div></body></html>`;
    return html;
  }

  createHTMLTable() {
    let html = `<html><head><title>NetPanzer Servers</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${this.getCSS()}</style></head><body><div class="container"><div class="card"><h1>NetPanzer Servers</h1><div class="muted">Servers listed: ${Object.keys(this.gameservers).length}</div></div><div class="card"><table class="servers-table"><thead><tr><th>Port</th><th>Server</th><th>Map</th><th>Style</th><th>Players</th><th>Details</th></tr></thead><tbody>`;
    Object.values(this.gameservers).forEach((s) => {
      const c = s.cache || { players: [] };
      html += `<tr><td>${s.port}</td><td>${c.hostname || "N/A"}</td><td>${c.mapname || "N/A"}</td><td>${c.gamestyle || "N/A"}</td><td>${c.numplayers || 0}</td><td>${
        c.players
          .map(
            (p) =>
              `${p.name} <span class="muted">(K:${p.kills} D:${p.deaths} P:${p.points})</span>`
          )
          .join("<br>") || "<span class='muted'>No players</span>"
      }</td></tr>`;
    });
    html += `</tbody></table></div></div></body></html>`;
    return html;
  }

  // ==============================
  // === HYBRID SERVER HTTP + HTTPS
  // ==============================
  startHybridServer() {
    // --- HTTPS ---
    // Certificate paths can be configured via environment variables:
    // SSL_KEY_PATH and SSL_CERT_PATH. Set DISABLE_HTTPS=1 to disable.
    const disableHttps = process.env.DISABLE_HTTPS === '1' || process.env.DISABLE_HTTPS === 'true';
    if (!disableHttps) {
      const keyPath = process.env.SSL_KEY_PATH || "/etc/letsencrypt/live/server-browser.netpanzer.com.br/privkey.pem";
      const certPath = process.env.SSL_CERT_PATH || "/etc/letsencrypt/live/server-browser.netpanzer.com.br/fullchain.pem";
      try {
        console.log(`🔐 Attempting to start HTTPS with key=${keyPath} cert=${certPath}`);
        const sslOptions = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        };
        const httpsServer = https.createServer(sslOptions, (req, res) => this.handleRequest(req, res));
        httpsServer.listen(443, () => console.log("✅ HTTPS server running on port 443"));
      } catch (err) {
        console.warn("⚠️ HTTPS not started; check paths/certificates and permission to bind port 443.", err && err.message);
      }
    } else {
      console.log('ℹ️ HTTPS disabled by DISABLE_HTTPS variable');
    }

    // --- HTTP for local testing ---
    const httpServer = http.createServer((req, res) => this.handleRequest(req, res));
    httpServer.listen(3000, () => console.log("✅ HTTP server running on http://localhost:3000"));
  }

  handleRequest(req, res) {
    try {
      const host = req.headers.host || "localhost";
      const protocol = req.connection.encrypted ? "https" : "http";
      const urlObj = new URL(req.url, `${protocol}://${host}`);

      if (urlObj.pathname === "/ranking") {
        const search = urlObj.searchParams.get("search") || "";
        const page = parseInt(urlObj.searchParams.get("page") || "1", 10);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(this.generateRankingHTML(search, page));
  } else if (urlObj.pathname === "/statistics") {
    // New route for advanced statistics (UI/visual only) - does not change data collection
    const { getAllPlayerStats, describeMetrics } = require("./statistics");
  let stats = getAllPlayerStats();
  // sort by strength to highlight top 3
  stats = stats.slice().sort((a,b)=> b.strength - a.strength);
    const metricsDesc = describeMetrics();

        const css = `
          body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial;background:linear-gradient(180deg,#071027, #041025);color:#e6eef8;margin:0;padding:22px}
          .container{max-width:1200px;margin:0 auto}
          .card{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));border-radius:12px;padding:14px;margin-bottom:14px}
          h1{margin:0 0 6px 0;color:#fff}
          .muted{color:#9aa6bd;font-size:13px}
          .controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
          input[type=text]{padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit}
          button{padding:8px 10px;border-radius:8px;border:none;background:linear-gradient(90deg,#06b6d4,#3b82f6);color:#061024;font-weight:700;cursor:pointer}
          .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
          .player{padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);}
          .player h3{margin:0 0 6px 0;font-size:16px}
          .small{font-size:13px;color:#9aa6bd}
          .bar{height:10px;background:rgba(255,255,255,0.04);border-radius:999px;overflow:hidden}
          .bar > i{display:block;height:100%;background:linear-gradient(90deg,#06b6d4,#3b82f6)}
          .trophy{font-size:18px;margin-right:6px}
          .topline{display:flex;justify-content:space-between;align-items:center}
        `;

  let html = `<!doctype html><html><head><meta charset="utf-8"><meta name='viewport' content='width=device-width, initial-scale=1'><title>Advanced Statistics</title><style>${this.getCSS()}${css}</style></head><body><div class="container"><div class="card topline"><div><h1>Advanced Statistics - ${this.currentMonthYear}</h1><div class="muted">Total players: ${stats.length}</div></div><div><div class="controls"><input id="search" type="text" placeholder="Search player..." /></div></div></div>`;

  // Top 3 highlighted with trophies
  html += `<div class="card"><h2 style="margin:0 0 8px 0">Top 3 by Strength</h2><div style="display:flex;gap:10px;flex-wrap:wrap">`;
        const top3 = stats.slice(0,3);
        const trophyFor = (i)=> i===0? '🏆' : i===1? '🥈' : '🥉';
        top3.forEach((p,i)=>{
          const expertWidth = Math.min(100, Math.max(0, p.expertRate * 100));
          const effWidth = Math.min(100, Math.max(0, p.efficiencyRate * 10));
          html += `<div class="player" style="flex:1 1 220px"><h3>${trophyFor(i)} ${p.name}</h3><div class="small">Strength: <strong>${p.strength}</strong> • K:${p.kills} D:${p.deaths} P:${p.points}</div><div style="margin-top:8px"><div class="small">Expert Rate</div><div class="bar" style="margin-top:6px"><i style="width:${expertWidth}%"></i></div></div><div style="margin-top:8px"><div class="small">Efficiency</div><div class="bar" style="margin-top:6px"><i style="width:${effWidth}%"></i></div></div></div>`;
        });
        html += `</div></div>`;

  // Players grid (cards)
  html += `<div class="card"><h2 style="margin:0 0 10px 0">Players</h2><div class="grid">`;
        stats.forEach((p, idx)=>{
          const expertWidth = Math.min(100, Math.max(0, p.expertRate * 100));
          const effWidth = Math.min(100, Math.max(0, p.efficiencyRate * 10));
          html += `<div class="player"><h3>${idx+1}. ${p.name}</h3><div class="small">K:${p.kills} • D:${p.deaths} • P:${p.points} • Strength:${p.strength}</div><div style="margin-top:8px"><div class="small">Expert Rate</div><div class="bar" style="margin-top:6px"><i style="width:${expertWidth}%"></i></div></div><div style="margin-top:8px"><div class="small">Efficiency</div><div class="bar" style="margin-top:6px"><i style="width:${effWidth}%"></i></div></div></div>`;
        });
        html += `</div></div>`;

  // metrics description
  html += `<div class="card"><strong>What does each metric mean?</strong><ul style="margin-top:8px">`;
  for (const k in metricsDesc) html += `<li><strong>${k}</strong>: ${metricsDesc[k]}</li>`;
  html += `</ul></div>`;

        // client-side JS: search (no CSV export)
        html += `<script>
          (function(){
            const search = document.getElementById('search');
            const players = Array.from(document.querySelectorAll('.player'));

            function filter(){
              const q = search.value.trim().toLowerCase();
              players.forEach(p => {
                const name = p.querySelector('h3').innerText.toLowerCase();
                p.style.display = q? (name.includes(q)? '' : 'none') : '';
              });
            }
            search.addEventListener('input', filter);
          })();
        </script>`;

        html += `</div></body></html>`;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      } else {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(this.createHTMLTable());
      }
    } catch (err) {
      console.error("❌ Request error:", err);
      res.writeHead(500);
      res.end("Internal server error.");
    }
  }

  startServerRefresh() {
    setInterval(() => {
      try {
        Object.values(this.gameservers).forEach((s) => this.queryServerStatus(s));
      } catch (err) {
        console.error("⚠️ Error in update loop:", err);
      }
    }, this.refreshInterval);
  }
}

// ==============================
// === GLOBAL ERROR HANDLING
// ==============================
process.on("uncaughtException", (err) => console.error("🔥 Uncaught exception:", err));
process.on("unhandledRejection", (reason) => console.error("⚡ Unhandled rejection:", reason));

// ==============================
// === EXECUTION
// ==============================
const browser = new GamesNetPanzerBrowser();
browser.start();
