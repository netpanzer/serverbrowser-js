const dgram = require('dgram');
const net = require('net');
const https = require('https'); // Importando o módulo https
const fs = require('fs');
const path = require('path');

class GamesNetPanzerBrowser {
  constructor() {
    this.masterservers = [
      { host: 'netpanzer.io', port: 28900 },
      // Adicione outros servidores mestres, se necessário
    ];
    this.visitedmasters = {};
    this.mastersstack = [...this.masterservers];
    this.gameservers = {};
    this.timeout = 2000; // Tempo limite em milissegundos
    this.refreshInterval = 15000; // Intervalo de atualização em milissegundos (15 segundos)
    this.monthlyStats = {}; // Armazenar estatísticas mensais
    this.currentMonth = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    // Inicie o processo de atualização dos servidores
    this.startServerRefresh();

    // Inicie o servidor HTTP para exibir informações dos servidores e o ranking
    this.startHTTPServer();
  }

  start() {
    this.browseMasters();
  }

  browseMasters() {
    if (this.mastersstack.length === 0) {
      console.log('Finished browsing masters.');
      this.getGameServersStatus();
      return;
    }

    const master = this.mastersstack.pop();
    this.visitedmasters[`${master.host}:${master.port}`] = master;

    const client = new net.Socket();
    client.connect(master.port, master.host, () => {
      console.log(`Connected to ${master.host}:${master.port}`);
      client.write('\\list\\gamename\\netpanzer\\final\\');
    });

    client.on('data', (data) => {
      console.log(`Received from ${master.host}:${master.port}: ${data}`);
      const serverList = this.parseServerList(data.toString(), master);
      this.addGameServers(serverList);
      client.destroy();
      this.browseMasters(); // Continue com o próximo servidor mestre
    });

    client.on('close', () => {
      console.log(`Connection closed to ${master.host}:${master.port}`);
    });

    client.on('error', (err) => {
      console.error(`Error connecting to ${master.host}:${master.port}: ${err}`);
      this.browseMasters(); // Continue com o próximo servidor mestre em caso de erro
    });
  }

  parseServerList(data, master) {
    const servers = [];
    const tokens = data.split('\\');
    for (let i = 1; i < tokens.length - 1; i += 2) {
      if (tokens[i] === 'ip' && tokens[i + 2] === 'port') {
        const serverInfo = {
          ip: tokens[i + 1],
          port: tokens[i + 3],
          masterserver: master,
          numplayers: 0, // Inicialmente, define o número de jogadores como 0
        };
        servers.push(serverInfo);
      }
    }
    return servers;
  }

  addGameServers(serverList) {
    serverList.forEach((server) => {
      const serverKey = `${server.ip}:${server.port}`;
      if (!this.gameservers[serverKey]) {
        this.gameservers[serverKey] = server;
      }
    });
  }

  getGameServersStatus() {
    console.log('Getting game servers status...');

    Object.values(this.gameservers).forEach((server) => {
      this.queryServerStatus(server);
    });
  }

  queryServerStatus(server) {
    const udpClient = dgram.createSocket('udp4');
    udpClient.send(Buffer.from('\\status\\final\\'), server.port, server.ip, (err) => {
      if (err) {
        console.error(`Error sending UDP request to ${server.ip}:${server.port}: ${err}`);
        udpClient.close();
      }
    });

    udpClient.on('message', (data, remote) => {
      console.log(`Received status from ${server.ip}:${server.port}: ${data}`);
      const serverInfo = this.parseServerStatus(data.toString());
      this.updateServerInfo(server, serverInfo);
      udpClient.close();
    });

    udpClient.on('error', (err) => {
      console.error(`Error receiving UDP response from ${server.ip}:${server.port}: ${err}`);
      udpClient.close();
    });
  }

  parseServerStatus(data) {
    const serverInfo = {};
    const tokens = data.split('\\');
    serverInfo.players = [];

    for (let i = 0; i < tokens.length - 1; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];

      if (key.startsWith('player_')) {
        const playerIndex = parseInt(key.split('_')[1], 10);
        serverInfo.players[playerIndex] = serverInfo.players[playerIndex] || {};
        serverInfo.players[playerIndex].name = value;
      } else if (key.startsWith('kills_') || key.startsWith('deaths_')) {
        const playerIndex = parseInt(key.split('_')[1], 10);
        const statType = key.split('_')[0]; // 'kills' ou 'deaths'
        serverInfo.players[playerIndex][statType] = value;
      } else {
        serverInfo[key] = value;
      }
    }

    return serverInfo;
  }

  updateServerInfo(server, serverInfo) {
    // Atualize as informações do servidor com os dados reais
    server.cache = serverInfo;

    // Verifique o mês atual
    const currentMonth = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    // Se o mês mudou, crie um novo arquivo JSON para as estatísticas do mês anterior
    if (currentMonth !== this.currentMonth) {
      this.currentMonth = currentMonth;
      this.monthlyStats = {};
    }

    serverInfo.players.forEach((player) => {
      const playerName = player.name || 'Unknown';

      // Inicialize as estatísticas do jogador se ele ainda não existir nas estatísticas mensais
      if (!this.monthlyStats[playerName]) {
        this.monthlyStats[playerName] = { kills: 0, deaths: 0, lastSessionKills: 0, lastSessionDeaths: 0 };
      }

      const newKills = parseInt(player.kills || 0, 10);
      const newDeaths = parseInt(player.deaths || 0, 10);

      // Verifica se o jogador está entrando novamente com estatísticas zeradas
      if (newKills === 0 && newDeaths === 0) {
        // Se o jogador já tem estatísticas acumuladas, mantenha-as
        if (this.monthlyStats[playerName].kills > 0 || this.monthlyStats[playerName].deaths > 0) {
          this.monthlyStats[playerName].lastSessionKills = 0;
          this.monthlyStats[playerName].lastSessionDeaths = 0;
        }
      } else {
        // Adiciona as novas kills e deaths às estatísticas acumuladas
        this.monthlyStats[playerName].kills += newKills - this.monthlyStats[playerName].lastSessionKills;
        this.monthlyStats[playerName].deaths += newDeaths - this.monthlyStats[playerName].lastSessionDeaths;
        this.monthlyStats[playerName].lastSessionKills = newKills;
        this.monthlyStats[playerName].lastSessionDeaths = newDeaths;
      }
    });

    // Salve as estatísticas mensais em um arquivo JSON
    const monthlyStatsFilePath = path.join(__dirname, 'ranking', `${currentMonth}.json`);
    fs.writeFileSync(monthlyStatsFilePath, JSON.stringify(this.monthlyStats, null, 2));

    // Atualize o ranking após cada atualização
    this.updateRanking();
  }



  // Método para criar e atualizar o ranking de jogadores
  updateRanking() {
    let players = Object.keys(this.monthlyStats).map(playerName => ({
      name: playerName,
      kills: this.monthlyStats[playerName].kills || 0,
      deaths: this.monthlyStats[playerName].deaths || 0,
    }));

    // Classifique os jogadores pelo número de kills em ordem decrescente
    players.sort((a, b) => b.kills - a.kills);

    // Limitar a lista aos top 100 jogadores
    players = players.slice(0, 10);

    // Adicione classificações aos jogadores
    players.forEach((player, index) => {
      player.rank = index + 1;
    });

    // Atualize o arquivo HTML do ranking
    const rankingHTML = this.createRankingHTML(players);
    const rankingHTMLFilePath = path.join(__dirname, 'ranking', 'ranking.html');
    fs.writeFileSync(rankingHTMLFilePath, rankingHTML);

    console.log(`Updated ranking: ${rankingHTMLFilePath}`);
  }


  // Crie a tabela HTML para exibir o ranking de jogadores
  createRankingHTML(players) {
    let html = `<html><head><title>Ranking TOP 10 Jogadores</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${this.getCSS()}</style></head><body>`;
    html += '<h1>Ranking TOP 10 Jogadores</h1>';
    html += '<table>';
    html += '<tr><th>Classificação</th><th>Jogador</th><th>Kills</th><th>Deaths</th></tr>';
    players.forEach((player) => {
        html += `<tr>
                    <td data-label="Classificação">${player.rank}</td>
                    <td data-label="Jogador">${player.name}</td>
                    <td data-label="Kills">${player.kills}</td>
                    <td data-label="Deaths">${player.deaths}</td>
                 </tr>`;
    });
    html += '</table></body></html>';
    return html;
}



  // Inicia um servidor HTTP para exibir informações dos servidores e o ranking
  startHTTPServer() {
    const options = {
      key: fs.readFileSync('/etc/letsencrypt/live/servers.netpanzer.com.br/privkey.pem'), // Substitua com o caminho da sua chave privada
      cert: fs.readFileSync('/etc/letsencrypt/live/servers.netpanzer.com.br/fullchain.pem'), // Substitua com o caminho do seu certificado
    };

    // Cria um servidor HTTPS com as opções de certificado
    const server = https.createServer(options, (req, res) => {
      if (req.url === '/ranking') {
        // Página de ranking de jogadores
        const rankingHTMLFilePath = path.join(__dirname, 'ranking', 'ranking.html');
        const rankingHTML = fs.readFileSync(rankingHTMLFilePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(rankingHTML);
      } else {
        // Página principal com informações dos servidores
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.createHTMLTable());
      }
    });

    server.listen(8080, () => { // Ouça na porta 8080
      console.log('HTTPS server is running on port 8080');
    });
  }

  // Crie a tabela HTML para exibir informações dos servidores
  createHTMLTable() {
    let html = `<html><head><title>Game Servers</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${this.getCSS()}</style></head><body>`;
    html += '<table>';
    html += '<tr><th>Porta</th><th>Servidor</th><th>Map</th><th>Estilo de Jogo</th><th>Players</th><th>Info Players</th></tr>';
    Object.values(this.gameservers).forEach(server => {
        const cache = server.cache || {};
        let playersData = '';

        cache.players.forEach((player, index) => {
            playersData += `<div class="player-stats">
                ${player.name || 'Unknown'}: Kills: ${player.kills || '0'}, Deaths: ${player.deaths || '0'}, Score: ${player.score || '0'}, Points: ${player.points || '0'}, Flags: ${player.flag || '0'}<br>
            </div>`;
        });

        html += `
            <tr>
                <td data-label="Porta">${server.port}</td>
                <td data-label="Servidor">${cache.hostname || 'N/A'}</td>
                <td data-label="Map">${cache.mapname || 'N/A'}</td>
                <td data-label="Estilo de Jogo">${cache.gamestyle || 'N/A'}</td>
                <td data-label="Players">${cache.numplayers || '0'}</td>
                <td data-label="Info Players">${playersData}</td>
            </tr>
        `;
    });

    html += '</table></body></html>';
    return html;
}


getCSS() {
  return `
      body {
          background-color: #4b5320; /* Cor verde oliva, comum em uniformes militares */
          color: white;
          font-family: 'Courier New', monospace; /* Fonte estilo máquina de escrever */
      }
      h1 {
          border-bottom: 2px solid #fff;
          padding-bottom: 10px;
      }
      table {
          border-collapse: collapse;
          width: 100%;
          margin-top: 20px;
      }
      th, td {
          border: 1px solid #fff;
          padding: 8px;
          text-align: left;
      }
      th {
          background-color: #6b8e23; /* Cor verde mais clara para cabeçalhos da tabela */
      }
      tr:nth-child(even) {
          background-color: #576d4e; /* Alternar cores das linhas para melhor leitura */
      }
      a {
          color: #f8f8ff;
          text-decoration: none;
      }
      a:hover {
          text-decoration: underline;
      }

      /* Responsividade */
      @media screen and (max-width: 768px) {
          body {
              font-size: 14px;
          }
          table, thead, tbody, th, td, tr {
              display: block;
          }
          thead tr {
              position: absolute;
              top: -9999px;
              left: -9999px;
          }
          tr { border: 1px solid #ccc; }
          td {
              border: none;
              position: relative;
              padding-left: 50%;
          }
          td:before {
              position: absolute;
              top: 6px;
              left: 6px;
              width: 45%;
              padding-right: 10px;
              white-space: nowrap;
              content: attr(data-label);
          }
          button {
              padding: 12px 24px;
              font-size: 16px;
          }
      }

      /* Outras regras de estilização responsivas podem ser adicionadas aqui */
  `;
}


  // Inicia o processo de atualização dos servidores
  startServerRefresh() {
    setInterval(() => {
      Object.values(this.gameservers).forEach((server) => {
        this.queryServerStatus(server);
      });
    }, this.refreshInterval);
  }
}

// Uso do navegador de jogos
const browser = new GamesNetPanzerBrowser();
browser.start();
