import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(morgan('dev'));

const PORT = process.env.PORT || 8080;
const ROUTE_CONFIG = process.env.ROUTE_CONFIG || path.join(__dirname, 'route-config.json');

const configRaw = fs.readFileSync(ROUTE_CONFIG, 'utf-8');
const config = JSON.parse(configRaw);

for (const r of config.routes) {
  app.use(
    r.path,
    createProxyMiddleware({
      target: r.target,
      changeOrigin: true,
      pathRewrite: (pathReq) => {
        const mount = r.path.endsWith('/') ? r.path.slice(0, -1) : r.path
        // Express strips the mount path from req.url; re-prepend it for the upstream
        return `${mount}${pathReq}`
      },
      logLevel: 'warn',
    })
  );
  console.log(`Proxy ${r.path} -> ${r.target}`);
}

app.get('/health', (req, res) => {
  res.json({ ok: true, routes: config.routes });
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on http://0.0.0.0:${PORT}`);
});


