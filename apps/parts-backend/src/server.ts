import { createServer } from 'node:http';
import { loadConfig } from './config.ts';
import { pool } from './db.ts';
import { checkHealth } from './health.ts';

const config = loadConfig();

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    checkHealth({ pool, meiliUrl: config.meiliUrl }).then((result) => {
      res.writeHead(result.ok ? 200 : 503, {
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(result));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(config.port, () => {
  console.log(`parts-backend listening on :${config.port}`);
});
