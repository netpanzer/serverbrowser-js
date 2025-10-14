// ranking.js
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Ensure the folder where the DB will be saved
const rankingFolder = path.join(__dirname, "ranking_data");
if (!fs.existsSync(rankingFolder)) fs.mkdirSync(rankingFolder);

// Create / open the database
const dbPath = path.join(rankingFolder, "ranking.db");
const db = new Database(dbPath);

// Create table if it does not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS rankings (
    name TEXT NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    month_year TEXT NOT NULL,
    PRIMARY KEY (name, month_year)
  )
`);

// Table to store the last known state per server+player, persistent across restarts
db.exec(`
  CREATE TABLE IF NOT EXISTS last_stats (
    server TEXT NOT NULL,
    name TEXT NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    month_year TEXT NOT NULL,
    PRIMARY KEY (server, name, month_year)
  )
`);

// =============================
// ======= HELPER FUNCTIONS =======
// =============================

// Returns current month-year string in format YYYY-MM
function getCurrentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Update or insert player statistics for the month
function updatePlayerStats(name, kills, deaths, points, monthYear) {
  const stmt = db.prepare(`
    INSERT INTO rankings (name, kills, deaths, points, month_year)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name, month_year)
    DO UPDATE SET
      kills = kills + excluded.kills,
      deaths = deaths + excluded.deaths,
      points = points + excluded.points
  `);
  stmt.run(name, kills, deaths, points, monthYear);
}

// Get ranking for a specific month with optional search, pagination
function getRanking(monthYear, search = "", limit = 20, offset = 0) {
  let sql = `
    SELECT name, kills, deaths, points
    FROM rankings
    WHERE month_year = ?
  `;
  const params = [monthYear];

  if (search) {
    sql += ` AND name LIKE ?`;
    params.push(`%${search}%`);
  }

  // Order by points descending, then kills descending, then deaths ascending
  sql += ` ORDER BY points DESC, kills DESC, deaths ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

// Count total players for a month (useful for pagination)
function countPlayers(monthYear, search = "") {
  let sql = `SELECT COUNT(*) AS total FROM rankings WHERE month_year = ?`;
  const params = [monthYear];

  if (search) {
    sql += ` AND name LIKE ?`;
    params.push(`%${search}%`);
  }

  return db.prepare(sql).get(...params).total;
}

// Return the last known stats (kills, deaths, points) for a player on a server
function getLastStats(server, name, monthYear) {
  const row = db
    .prepare(
      `SELECT kills, deaths, points FROM last_stats WHERE server = ? AND name = ? AND month_year = ?`
    )
    .get(server, name, monthYear);
  if (!row) return { kills: 0, deaths: 0, points: 0 };
  return { kills: row.kills || 0, deaths: row.deaths || 0, points: row.points || 0 };
}

// Return a map { name -> {kills,deaths,points} } with all known players for a server in the month
function getLastStatsForServer(server, monthYear) {
  const rows = db
    .prepare(
      `SELECT name, kills, deaths, points FROM last_stats WHERE server = ? AND month_year = ?`
    )
    .all(server, monthYear);
  const map = {};
  for (const r of rows)
    map[r.name] = { kills: r.kills || 0, deaths: r.deaths || 0, points: r.points || 0 };
  return map;
}

// Insert or update the last known stats for a player on a server
function upsertLastStats(server, name, kills, deaths, points, monthYear) {
  const stmt = db.prepare(
    `INSERT INTO last_stats (server, name, kills, deaths, points, month_year)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(server, name, month_year)
     DO UPDATE SET kills = excluded.kills, deaths = excluded.deaths, points = excluded.points`
  );
  stmt.run(server, name, kills, deaths, points, monthYear);
}

module.exports = {
  getCurrentMonthYear,
  updatePlayerStats,
  getRanking,
  countPlayers,
  // helpers for persisting last-known server stats
  getLastStats,
  getLastStatsForServer,
  upsertLastStats,
};
