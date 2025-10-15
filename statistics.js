// statistics.js
// Funções para calcular estatísticas derivadas a partir da tabela `rankings`.
// Fonte dos dados: `getRanking(monthYear)` (cada registro: { name, kills, deaths, points }).
//
// Melhorias nesta versão:
// - Usa `kills + deaths` como "actions" (ações registradas) quando `games` não existe.
// - Calcula taxas normalizadas (percentuais quando faz sentido) e um índice composto `strength`.
// - Evita divisões por zero e documenta suposições.
//
// Principais métricas:
//  actionCount       = kills + deaths
//  activityRate      = actionCount (número absoluto de ações no mês)
//  expertRate        = kills / actionCount (0..1) → proporção de ações que são kills
//  killerRate        = (kills / actionCount) * 100 → kills por 100 ações (percent)
//  efficiencyRate    = points / max(1, actionCount) → pontos por ação
//  champRate         = points / max(1, kills) → pontos por kill (quando >0)
//  strength          = weighted composite: 2*kills + 1*points - 0.5*deaths
//
// Observação: sem um campo `games` real, as métricas "por jogo" não são possíveis; se
// você quiser métricas por jogo, devemos adicionar/registrar `games_played` no banco.

const { getRanking, getCurrentMonthYear } = require("./ranking");

function round(v, decimals = 2) {
  return Number(v.toFixed(decimals));
}

function calculateStats(player) {
  const kills = Number(player.kills || 0);
  const deaths = Number(player.deaths || 0);
  const points = Number(player.points || 0);

  const actionCount = kills + deaths; // total de ações observadas

  const activityRate = actionCount; // ações no mês (bruto)

  const expertRate = actionCount ? kills / actionCount : 0; // fração [0..1]

  const killerRate = actionCount ? (kills / actionCount) * 100 : 0; // kills por 100 ações (%)

  const efficiencyRate = actionCount ? points / actionCount : 0; // pontos por ação

  const champRate = kills ? points / kills : 0; // pontos por kill

  // Índice composto simples — combina volume (kills), valor (points) e penaliza mortes
  // Fórmula escolhida para ser intuitiva: mais kills e pontos aumentam força; mortes reduzem.
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

function getAllPlayerStats(monthYear = getCurrentMonthYear(), search = "", limit = 500) {
  // Agora aceita um parâmetro `search` que é repassado para getRanking,
  // permitindo filtrar jogadores pelo nome (como no /ranking).
  const ranking = getRanking(monthYear, search || "", limit, 0);
  return ranking.map(calculateStats);
}

// Função auxiliar que descreve cada métrica (útil para documentação/UI)
function describeMetrics() {
  return {
    ActivityRate: "Total de ações registradas (kills + deaths) no mês.",
    ExpertRate: "Proporção de ações que são kills (0..1). Quanto mais próximo de 1, melhor).",
    KillerRate: "Kills por 100 ações (percentual).",
    EfficiencyRate: "Pontos por ação (points / (kills+deaths)).",
    ChampRate: "Pontos por kill (points / kills).",
    Strength:
      "Índice composto: 2*kills + points - 0.5*deaths (valor arbitrário para ranking).",
  };
}

module.exports = {
  calculateStats,
  getAllPlayerStats,
  describeMetrics,
};
