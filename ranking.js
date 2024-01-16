const path = require('path');
const fs = require('fs');

class RankingManager {
  constructor(monthlyStats, db) {
    this.monthlyStats = monthlyStats;
    this.db = db;
  }

  updateRanking() {
    // Obter o mês e ano correntes
    const currentMonthYear = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });

    // Consultar o banco de dados para obter os top 10 jogadores para o mês e ano correntes
    this.db.any(`
      SELECT * FROM ranking 
      WHERE month_year = $1
      ORDER BY kills DESC NULLS LAST, deaths ASC NULLS LAST LIMIT 10
    `, currentMonthYear)
      .then((rows) => {
        // Mapear os dados do ranking
        const rankingPlayers = rows.map((row, index) => {
          return {
            rank: index + 1,
            name: row.player_name || 'Unknown',
            kills: row.kills || 0,
            deaths: row.deaths || 0,
          };
        });

        // Atualizar o arquivo HTML do ranking
        const rankingHTMLFilePath = path.join(__dirname, 'ranking', 'ranking.html');
        fs.writeFileSync(rankingHTMLFilePath, this.createRankingHTML(rankingPlayers));

        console.log(`Updated ranking: ${rankingHTMLFilePath}`);
      })
      .catch(error => {
        console.error(`Error fetching ranking data from database: ${error}`);
      });
  }


  createRankingHTML(rankingPlayers) {
    let html = `<html><head><title>Ranking TOP 10 Jogadores</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${this.getCSS()}</style></head><body>`;
    html += '<h1>Ranking TOP 10 Jogadores</h1>';
    html += '<table>';
    html += '<tr><th>Classificação</th><th>Jogador</th><th>Kills</th><th>Deaths</th></tr>';
    rankingPlayers.forEach((player) => {
      html += `<tr>
                  <td data-label="Classificação">${player.rank}</td>
                  <td data-label="Jogador">${player.name || 'Unknown'}</td>
                  <td data-label="Kills">${player.kills}</td>
                  <td data-label="Deaths">${player.deaths}</td>
               </tr>`;
    });
    html += '</table></body></html>';
    return html;
  }

  getCSS() {
    // Implemente a lógica de obtenção do CSS conforme estava no código original
    return `
    body {
      background-color: #f4f4f4;
      color: #333;
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 0;
  }
  
  h1 {
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
      color: #3498db;
  }
  
  table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 20px;
  }
  
  th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
  }
  
  th {
      background-color: #3498db;
      color: #fff;
  }
  
  tr:nth-child(even) {
      background-color: #f2f2f2;
  }
  
  a {
      color: #3498db;
      text-decoration: none;
  }
  
  a:hover {
      text-decoration: underline;
  }
  
  /* Estilo para telas pequenas */
  @media screen and (max-width: 768px) {
      body {
          font-size: 14px;
      }
  
      td:not(:last-child)::before {
          display: block;
          content: attr(data-label) ":";
          font-weight: bold;
          margin-bottom: 5px;
      }
  
      td {
          border: none;
          position: relative;
          padding-top: 5px;
          padding-bottom: 5px;
          white-space: normal;
          text-align: left;
      }
  }
  `;
  }
}

module.exports = RankingManager;
