// ranking.js
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Garante a pasta onde o banco será salvo
const rankingFolder = path.join(__dirname, "ranking_data");
if (!fs.existsSync(rankingFolder)) fs.mkdirSync(rankingFolder);

// Cria / abre o banco de dados
const dbPath = path.join(rankingFolder, "ranking.db");
const db = new Database(dbPath);

// Cria tabela se não existir
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

// Tabela para armazenar o último estado conhecido por servidor+jogador, persistente entre reinícios
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
// ======= FUNÇÕES ÚTEIS =======
// =============================

function getCurrentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Atualiza ou insere estatísticas
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

// Pega ranking de um mês
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

  // Ordenação: prioriza pontos (pontuação/score), depois kills, e por fim menos deaths
  sql += ` ORDER BY points DESC, kills DESC, deaths ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

// Conta quantos jogadores existem (para paginação)
function countPlayers(monthYear, search = "") {
  let sql = `SELECT COUNT(*) AS total FROM rankings WHERE month_year = ?`;
  const params = [monthYear];

  if (search) {
    sql += ` AND name LIKE ?`;
    params.push(`%${search}%`);
  }

  return db.prepare(sql).get(...params).total;
}

// Retorna o último estado conhecido (kills,deaths,points) para um jogador em um servidor
function getLastStats(server, name, monthYear) {
  const row = db
    .prepare(
      `SELECT kills, deaths, points FROM last_stats WHERE server = ? AND name = ? AND month_year = ?`
    )
    .get(server, name, monthYear);
  if (!row) return { kills: 0, deaths: 0, points: 0 };
  return { kills: row.kills || 0, deaths: row.deaths || 0, points: row.points || 0 };
}

// Retorna um mapa { name -> {kills,deaths,points} } com todos os players conhecidos para um servidor no mês
function getLastStatsForServer(server, monthYear) {
  const rows = db
    .prepare(`SELECT name, kills, deaths, points FROM last_stats WHERE server = ? AND month_year = ?`)
    .all(server, monthYear);
  const map = {};
  for (const r of rows) map[r.name] = { kills: r.kills || 0, deaths: r.deaths || 0, points: r.points || 0 };
  return map;
}

// Insere ou atualiza o último estado conhecido para um jogador em um servidor
function upsertLastStats(server, name, kills, deaths, points, monthYear) {
  const stmt = db.prepare(
    `INSERT INTO last_stats (server, name, kills, deaths, points, month_year) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(server, name, month_year) DO UPDATE SET kills = excluded.kills, deaths = excluded.deaths, points = excluded.points`
  );
  stmt.run(server, name, kills, deaths, points, monthYear);
}

module.exports = {
  getCurrentMonthYear,
  updatePlayerStats,
  getRanking,
  countPlayers,
  // helpers de persistência de last-stats
  getLastStats,
  getLastStatsForServer,
  upsertLastStats,
};

