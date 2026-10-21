import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 4179;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
let serverLog = '';
server.stdout.on('data', b => { serverLog += b.toString(); });
server.stderr.on('data', b => { serverLog += b.toString(); });
let browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const url = 'http://127.0.0.1:' + port + '/';
const state = page => page.evaluate(() => window.__ET_TOUCH_TRIAL_READONLY__());

try {
  let reachable = false;
  for (let i = 0; i < 50; i++) {
    try { const response = await fetch(url); if (response.ok) { reachable = true; break; } }
    catch { /* server startup */ }
    await sleep(200);
  }
  assert.ok(reachable, 'Vite did not start: ' + serverLog);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(url, {waitUntil:'networkidle'});
  await page.waitForFunction(() => typeof window.__ET_TOUCH_TRIAL_READONLY__ === 'function');
  const gate = page.locator('#et-landscape-gate');
  assert.equal(await gate.isVisible(), true, 'portrait must display orientation gate');
  assert.equal(await page.locator('.wrap').getAttribute('inert'), '', 'portrait game must be inert');
  const frozen = await state(page);
  await sleep(300);
  assert.equal((await state(page)).time, frozen.time, 'portrait game clock must not advance');
  // Simulate hardware keyboard inputs while the orientation gate is active.
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await sleep(100);
  assert.equal((await state(page)).time, frozen.time, 'keyboard cannot bypass portrait freeze');
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(() => !matchMedia('(max-width:580px) and (orientation:portrait) and (pointer:coarse)').matches);
  assert.equal(await gate.isVisible(), false, 'landscape must hide gate');
  assert.equal(await page.locator('.wrap').getAttribute('inert'), null, 'landscape game must be interactive');
  await sleep(350);
  const live = await state(page);
  assert.ok(live.time > frozen.time, 'landscape clock must resume');
  const jump = page.locator('button[data-code="Space"]');
  assert.equal(await jump.isVisible(), true, 'jump button must be visible in landscape');
  await jump.dispatchEvent('pointerdown',{pointerId:31,pointerType:'touch',button:0});
  assert.ok((await state(page)).pressed.includes('Space'), 'jump pointer must register');
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(() => matchMedia('(max-width:580px) and (orientation:portrait) and (pointer:coarse)').matches);
  await sleep(50);
  assert.deepEqual((await state(page)).pressed, [], 'rotation must clear held touch controls');
  const paused = await state(page);
  await sleep(250);
  assert.equal((await state(page)).time, paused.time, 'rotated portrait game must remain frozen');
  await page.setViewportSize({width:844,height:390});
  await sleep(200);
  assert.ok((await state(page)).time > paused.time, 'game must resume after second rotation');
  assert.deepEqual(errors, [], 'no browser page errors');
  await page.screenshot({path:'mobile-landscape-smoke.png'});
  await context.close();

  const desktop = await browser.newContext({viewport:{width:1280,height:900}});
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(url, {waitUntil:'networkidle'});
  assert.equal(await desktopPage.locator('#et-landscape-gate').isVisible(), false, 'desktop must not show mobile gate');
  await desktop.close();
  console.log('Browser smoke PASS: portrait freeze, keyboard guard, landscape resume, touch clear, desktop');
} finally {
  await browser?.close();
  server.kill();
}
