# Server Browser NetPanzer / Guia (PT-BR / EN)

Este repositório contém um server browser, ranking e páginas de estatísticas para NetPanzer. Ele coleta informações dos master servers, consulta servidores via UDP, agrega deltas por jogador e persiste estatísticas mensais em SQLite.

----

PT-BR (como executar)

Pré-requisitos
- Node.js (14+ recomendado)
- npm
- WSL recomendado em Windows para facilitar uso de ferramentas nativas e compilação de `better-sqlite3`.

Instalação
```bash
# no WSL
cd ~
git clone <repo-url>
cd serverbrowser_np
npm install
```

Executando localmente (HTTP)
```bash
# iniciar servidor (porta 3000)
node server_browser.js
```

Executando com HTTPS
- Defina `SSL_KEY_PATH` e `SSL_CERT_PATH` para os arquivos de chave/certificado.
- Ou rode com `DISABLE_HTTPS=1` para evitar a tentativa de HTTPS.

Exemplos (WSL):
```bash
# somente HTTP
DISABLE_HTTPS=1 node server_browser.js

# com HTTPS (ajuste paths)
SSL_KEY_PATH=/caminho/privkey.pem SSL_CERT_PATH=/caminho/fullchain.pem node server_browser.js
```

Páginas e como testar idiomas
- `/` — Lista de servidores (UI)
- `/ranking` — Ranking mensal (paginado)
- `/statistics` — Estatísticas avançadas

Para ver as páginas em inglês, adicione `?language=english` na URL. Exemplos:
```
http://localhost:3000/?language=english
http://localhost:3000/ranking?language=english
http://localhost:3000/statistics?language=english
```

Para forçar português (pt-BR):
```
http://localhost:3000/?language=pt
http://localhost:3000/ranking?language=pt
http://localhost:3000/statistics?language=pt
```

Observações:
- Os formulários e links de paginação preservam `language`, então a navegação mantém o idioma selecionado.
- Se a descrição de alguma métrica ainda aparecer em português quando `language=english` for passado, isso significa que aquela descrição não foi traduzida no catálogo `i18n/en.json` (há fallback para `statistics.js`). Podemos completar as traduções se desejar.

----

EN (how to run)

Requirements
- Node.js (14+ recommended)
- npm

Installation
```bash
# in WSL or Linux
git clone <repo-url>
cd serverbrowser_np
npm install
```

Run locally (HTTP)
```bash
node server_browser.js
```

Run with HTTPS
- Set `SSL_KEY_PATH` and `SSL_CERT_PATH` environment variables, or set `DISABLE_HTTPS=1` to disable HTTPS.

Pages and language testing
- `/` — Servers list
- `/ranking` — Monthly ranking
- `/statistics` — Advanced statistics

To view pages in English, append `?language=english` to the URLs:
```
http://localhost:3000/?language=english
http://localhost:3000/ranking?language=english
http://localhost:3000/statistics?language=english
```

To force Portuguese:
```
http://localhost:3000/?language=pt
http://localhost:3000/ranking?language=pt
http://localhost:3000/statistics?language=pt
```

Notes
- The UI preserves the `language` query param across searches and pagination.
- Metric descriptions fall back to `statistics.js` if a translation is missing; I can fully externalize all metric descriptions to `i18n` on request.

----

Files principais
- `server_browser.js` — servidor principal, rotas e renderização HTML.
- `ranking.js` — persistência e queries SQLite.
- `statistics.js` — cálculo de métricas derivadas.
- `i18n/` — catálogo de traduções (en.json, pt.json) e helper `i18n/index.js`.

Contributing
- Pull requests e issues são bem-vindos (sugestões: adicionar script `start` em package.json, completar catálogo i18n, adicionar testes).

License: GLP 3
