const dgram = require('dgram');
const net = require('net');
const http = require('http');

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
        this.refreshInterval = 15000; // Intervalo de atualização em milissegundos (1 minuto)

        // Inicie o processo de atualização dos servidores
        this.startServerRefresh();
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
        
        // Inicie o servidor HTTP para exibir informações dos servidores
        this.startHTTPServer();

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
            } else if (key.startsWith('kills_') || key.startsWith('deaths_') || key.startsWith('score_') || key.startsWith('points_') || key.startsWith('flag_') || key.startsWith('flagu_')) {
                const playerIndex = parseInt(key.split('_')[1], 10);
                const statType = key.split('_')[0]; // 'kills', 'deaths', 'score', 'points', 'flag', 'flagu', etc.
                serverInfo.players[playerIndex][statType] = value;
            } else {
                serverInfo[key] = value;
            }
        }
    
        return serverInfo;
    }
    
    
    
    
    
    
    
    

    updateServerInfo(server, serverInfo) {
        // Atualize as informações do servidor com os dados reais aqui
        // Você pode adicionar lógica para exibir as informações em tempo real ou armazená-las em um formato específico
        // Neste exemplo, estamos apenas adicionando as informações a uma estrutura de cache
        server.cache = serverInfo;
    }

    // Inicia um servidor HTTP simples para exibir informações dos servidores
startHTTPServer() {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
            <head>
                <title>Game Servers</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        margin: 0;
                        padding: 20px;
                        color: #333;
                    }
                    h1 {
                        color: #0056b3;
                    }
                    .server-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .server-table th, .server-table td {
                        border: 1px solid #ddd;
                        padding: 10px;
                        text-align: left;
                    }
                    .server-table th {
                        background-color: #007bff;
                        color: white;
                    }
                    .server-table tr:nth-child(even) {
                        background-color: #f2f2f2;
                    }
                </style>
            </head>
            <body>
                <h1>Game Servers</h1>
                ${this.createHTMLTable()}
            </body>
            </html>
        `);
    });

    server.listen(8080, () => {
        console.log('HTTP server is running on port 8080');
    });
}

startHTTPServer() {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
            <head>
                <title>Game Servers</title>
                <meta http-equiv="refresh" content="30"> <!-- Adiciona refresh automático -->
                <style>
                body {
                    font-family: 'Courier New', monospace;
                    background-color: #f4f4f4;
                    color: #333;
                    margin: 0;
                    padding: 20px;
                }
                h1 {
                    color: #0056b3;
                }
                .server-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                .server-table th, .server-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                .server-table th {
                    background-color: #6B8E23;
                    color: white;
                }
                .server-table tr:nth-child(even) {
                    background-color: #f2f2f2;
                }
                .player-stats {
                    color: #8B4513; /* Cor de bronze */
                }
            </style>
            
            </head>
            <body>
                <h1>Game Servers</h1>
                ${this.createHTMLTable()}
            </body>
            </html>
        `);
    });

    server.listen(8080, () => {
        console.log('HTTP server is running on port 8080');
    });
}

createHTMLTable() {
    let html = '<table class="server-table">';
    html += '<tr><th>Port</th><th>Hostname</th><th>Map</th><th>Game Style</th><th>Players</th><th>Player Stats & Objectives</th></tr>';

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
                <td>${server.port}</td>
                <td>${cache.hostname || 'N/A'}</td>
                <td>${cache.mapname || 'N/A'}</td>
                <td>${cache.gamestyle || 'N/A'}</td>
                <td>${cache.numplayers || '0'}</td>
                <td>${playersData}</td>
            </tr>
        `;
    });

    html += '</table>';
    return html;
}











startServerRefresh() {
    setInterval(() => {
        Object.values(this.gameservers).forEach((server) => {
            this.queryServerStatus(server);
        });
    }, this.refreshInterval);
}

updateServerInfo(server, serverInfo) {
    server.cache = serverInfo;
}
}

// Uso do navegador de jogos
const browser = new GamesNetPanzerBrowser();
browser.start();
