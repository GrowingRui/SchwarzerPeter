// Usage: node screenshot.mjs <url> [label] [width]
// Saves to ./temporary screenshots/screenshot-N[-label].png (auto-incremented).
// Uses puppeteer-core with the locally installed Chrome or Edge.
import puppeteer from 'puppeteer-core';
import { mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = BROWSERS.find(existsSync);
if (!executablePath) { console.error('No Chrome or Edge found. Set CHROME_PATH.'); process.exit(1); }

const [url = 'http://localhost:3000', label, width = '1440'] = process.argv.slice(2);
const outDir = join(fileURLToPath(new URL('.', import.meta.url)), 'temporary screenshots');
await mkdir(outDir, { recursive: true });
const nums = (await readdir(outDir)).map(f => Number(f.match(/^screenshot-(\d+)/)?.[1])).filter(Boolean);
const n = (nums.length ? Math.max(...nums) : 0) + 1;
const file = join(outDir, `screenshot-${n}${label ? '-' + label : ''}.png`);

const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: Number(width), height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: file, fullPage: true });
await browser.close();
console.log(file);
