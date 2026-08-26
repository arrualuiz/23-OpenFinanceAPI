import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './src/env.mjs';
import { sendJson, sendText, readJsonBody } from './src/http.mjs';
import { Store } from './src/store.mjs';
import { PluggyClient } from './src/pluggy.mjs';
import { buildFinancialSnapshot } from './src/normalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv(__dirname);

const publicDir = path.join(__dirname, 'public');
const store = new Store(__dirname);
const pluggy = new PluggyClient();
const port = Number(process.env.PORT || 3333);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = path.normalize(url.pathname === '/' ? '/index.html' : url.pathname);
  if (safePath.includes('..')) return sendText(res, 400, 'Caminho invalido');

  const filePath = path.join(publicDir, safePath);
  try {
    const content = await fs.readFile(filePath);
    sendText(res, 200, content, contentTypes[path.extname(filePath)] || 'application/octet-stream');
  } catch {
    sendText(res, 404, 'Nao encontrado');
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        hasPluggyKeys: Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET),
        hasGoogleSheetsConfig: Boolean(
          process.env.GOOGLE_SHEET_ID &&
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
            process.env.GOOGLE_PRIVATE_KEY,
        ),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/pluggy/connect-token') {
      const body = await readJsonBody(req);
      const data = await pluggy.createConnectToken({ itemId: body.itemId });
      return sendJson(res, 200, { accessToken: data.accessToken || data.connectToken || data.token });
    }

    if (req.method === 'POST' && url.pathname === '/api/pluggy/items') {
      const body = await readJsonBody(req);
      const saved = await store.saveItem(body.item || body);
      return sendJson(res, 200, saved);
    }

    if (req.method === 'GET' && url.pathname === '/api/items') {
      return sendJson(res, 200, { items: await store.listItems() });
    }

    if (req.method === 'POST' && url.pathname === '/api/sync') {
      const items = await store.listItems();
      const snapshot = await buildFinancialSnapshot({ pluggy, items });
      await store.saveSnapshot(snapshot);
      return sendJson(res, 200, snapshot);
    }

    if (req.method === 'GET' && url.pathname === '/api/snapshot') {
      return sendJson(res, 200, { snapshot: await store.latestSnapshot() });
    }

    return sendJson(res, 404, { error: 'Endpoint nao encontrado' });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Finance Automation rodando em http://localhost:${port}`);
});
