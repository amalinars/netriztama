import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 3030);
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_URL = 'https://www.netflix.com/';

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'playwright-netflix-service' });
});

app.post('/open-netflix', async (req, res) => {
  const targetUrl = String(req.body?.url || DEFAULT_URL);
  const timeoutMs = Number(req.body?.timeoutMs || 45000);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 15000) }).catch(() => {});

    const title = await page.title().catch(() => '');
    const finalUrl = page.url();

    res.json({
      ok: true,
      step: 'opened-netflix-page',
      requestedUrl: targetUrl,
      finalUrl,
      title,
      visibleTextSample: (await page.locator('body').innerText().catch(() => '')).slice(0, 500),
    });

    await context.close();
    await browser.close();
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({
      ok: false,
      step: 'opened-netflix-page',
      requestedUrl: targetUrl,
      error: error?.message || String(error),
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`playwright-netflix-service listening on http://${HOST}:${PORT}`);
});
