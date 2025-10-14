# Server Browser NetPanzer

This project implements a server browser and monthly ranking system for NetPanzer.
It queries master servers, collects UDP responses from game servers, aggregates per-player deltas and persists monthly statistics in a SQLite database.

## Requirements

- Node.js (recommended 14+)
- npm (or yarn)
- Windows users can use WSL to simplify opening ports and using certificates. The project depends on `better-sqlite3`, which may require native build tools.

## Installation

1. Clone the repository:

```bash
# in WSL (e.g. wsl.exe)
cd ~
git clone <repo-url>
cd serverbrowser_np
```

2. Install dependencies:

```bash
npm install
```

Note: `better-sqlite3` includes native bindings and may require build tools (e.g. `build-essential` on Linux/WSL). If installation fails, ensure you have the necessary toolchain or use a Node installation that matches your platform.

## Main files

- `server_browser.js` — Main class `GamesNetPanzerBrowser`. Starts the master server polling loop, queries game servers via UDP and exposes an HTTP server (port 3000) and, optionally, HTTPS (port 443) with routes:
  - `/` — Server list (simple HTML UI)
  - `/ranking` — Monthly ranking (paginated)
    - `/statistics` — Advanced statistics page

- `ranking.js` — Persistence and query logic using SQLite (`ranking_data/ranking.db`). Exposes functions such as `updatePlayerStats`, `getRanking`, `countPlayers` and helpers for `last_stats` management.

- `statistics.js` — Functions that compute derived metrics from the `rankings` table (e.g. `strength`, `efficiencyRate`) and produce data for the statistics UI.

## How to run

Run the app locally (HTTP only):

```bash
# in WSL
npm start || node server_browser.js
```

Note: there is no `start` script in `package.json` by default — you can run the app directly with `node server_browser.js`.

### Running with HTTPS (production)

By default the app attempts to start an HTTPS server using commonly used Let's Encrypt paths. To run with HTTPS:

- Set the environment variables `SSL_KEY_PATH` and `SSL_CERT_PATH` to point to your private key and certificate files.
- Run the process with permission to bind to port 443, or place a reverse proxy (e.g. nginx) in front to handle HTTPS.

You can also disable HTTPS and use only HTTP by setting `DISABLE_HTTPS=1`.

Examples (WSL / Linux):

```bash
# run HTTP only
DISABLE_HTTPS=1 node server_browser.js

# run with HTTPS (assuming files exist)
SSL_KEY_PATH=/path/to/privkey.pem SSL_CERT_PATH=/path/to/fullchain.pem node server_browser.js
```

On Windows (cmd/PowerShell) environment variable syntax differs; in PowerShell:

```powershell
$env:SSL_KEY_PATH = 'C:\path\to\privkey.pem'
$env:SSL_CERT_PATH = 'C:\path\to\fullchain.pem'
node server_browser.js
```

## Database

SQLite is created automatically at `ranking_data/ranking.db` on first run. The project uses two tables: `rankings` and `last_stats`.

## Important environment variables

- `DISABLE_HTTPS` — if `1` or `true`, HTTPS will not be started.
- `SSL_KEY_PATH` — path to the private key file (when using HTTPS).
- `SSL_CERT_PATH` — path to the certificate file (when using HTTPS).

## Notes and tips

- The app queries UDP status endpoints for servers reported by the master server `netpanzer.io:28900`. If no servers appear, check UDP connectivity and firewall rules.
- `better-sqlite3` may require native build tools on your platform; install the appropriate toolchain if the package fails to build.
- For public HTTPS deployment, consider running the app behind a reverse proxy (nginx) to manage certificates and ports.

## Contributing

Feel free to open issues or pull requests. Ideas:

- Add a `start` script to `package.json`.
- Add unit tests for `ranking.js`.
- Record games played per player to enable per-game metrics.

## License

ISC
