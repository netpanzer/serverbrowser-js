class Hall {
    constructor(db) {
      this.db = db;
    }
  
    async getTopPlayersHtml() {
      const topPlayers = await this.getTopPlayers();
      
      let html = `
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Top 10 Players Hall</title>
            <style>
              body {
                font-family: 'Arial', sans-serif;
                margin: 20px;
              }
  
              h1 {
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
            </style>
          </head>
          <body>
            <h1>Top 10 Players Hall</h1>
            <table>
              <tr>
                <th>Player</th>
                <th>Kills</th>
                <th>Deaths</th>
                <th>Month/Year</th>
              </tr>`;
  
      topPlayers.forEach(player => {
        html += `
          <tr>
            <td>${player.player_name}</td>
            <td>${player.kills}</td>
            <td>${player.deaths}</td>
            <td>${player.month_year}</td>
          </tr>`;
      });
  
      html += `
            </table>
          </body>
        </html>`;
  
      return html;
    }
  
    async getTopPlayers() {
      try {
        const topPlayers = await this.db.any(`
          SELECT player_name, kills, deaths, month_year
          FROM ranking
          ORDER BY kills DESC
          LIMIT 10
        `);
  
        return topPlayers;
      } catch (error) {
        console.error('Error fetching top players:', error.message || error);
        return [];
      }
    }
  }
  
  module.exports = Hall;