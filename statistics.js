// statistics.js
// Functions to compute derived statistics from the `rankings` table.
// Data source: `getRanking(monthYear)` (each record: { name, kills, deaths, points }).
//
// Improvements in this version:
// - Uses `kills + deaths` as "actions" when `games` is not available.
// - Calculates normalized rates (percentiles where appropriate) and a composite `strength` index.
// - Avoids division-by-zero and documents assumptions.
//
// Main metrics:
//  actionCount       = kills + deaths
//  activityRate      = actionCount (absolute number of actions in the month)
//  expertRate        = kills / actionCount (0..1) → proportion of actions that are kills
//  killerRate        = (kills / actionCount) * 100 → kills per 100 actions (%)
//  efficiencyRate    = points / max(1, actionCount) → points per action
//  champRate         = points / max(1, kills) → points per kill (when >0)
//  strength          = weighted composite: 2*kills + 1*points - 0.5*deaths
//
// Note: without a real `games` field, per-game metrics are not possible; to get per-game stats
// you should record `games_played` in the DB.

const { getRanking, getCurrentMonthYear } = require("./ranking");

function round(v, decimals = 2) {
  return Number(v.toFixed(decimals));
}

function calculateStats(player) {
  const kills = Number(player.kills || 0);
  const deaths = Number(player.deaths || 0);
  const points = Number(player.points || 0);

  const actionCount = kills + deaths; // total observed actions

  const activityRate = actionCount; // actions in the month (raw count)

  const expertRate = actionCount ? kills / actionCount : 0; // fraction [0..1]

  const killerRate = actionCount ? (kills / actionCount) * 100 : 0; // kills per 100 actions (%)

  const efficiencyRate = actionCount ? points / actionCount : 0; // points per action

  const champRate = kills ? points / kills : 0; // points per kill

  // Simple composite index — combines volume (kills), value (points), and penalizes deaths
  // Formula chosen to be intuitive: more kills and points increase strength; deaths reduce it.
  const strength = 2 * kills + 1 * points - 0.5 * deaths;

  return {
    name: player.name,
    kills,
    deaths,
    points,
    actionCount,
    activityRate: round(activityRate, 0),
    expertRate: round(expertRate, 3),
    killerRate: round(killerRate, 2),
    efficiencyRate: round(efficiencyRate, 2),
    champRate: round(champRate, 2),
    strength: round(strength, 2),
  };
}

function getAllPlayerStats(monthYear = getCurrentMonthYear(), limit = 500) {
  const ranking = getRanking(monthYear, "", limit, 0);
  return ranking.map(calculateStats);
}

// Helper function that describes each metric (useful for documentation/UI)
function describeMetrics() {
  return {
    activityRate: "Total actions recorded (kills + deaths) in the month.",
    expertRate: "Proportion of actions that are kills (0..1). Closer to 1 is better.",
    killerRate: "Kills per 100 actions (percentage).",
    efficiencyRate: "Points per action (points / (kills + deaths)).",
    champRate: "Points per kill (points / kills).",
    strength:
      "Composite index: 2*kills + points - 0.5*deaths (arbitrary scoring for ranking).",
  };
}

module.exports = {
  calculateStats,
  getAllPlayerStats,
  describeMetrics,
};
