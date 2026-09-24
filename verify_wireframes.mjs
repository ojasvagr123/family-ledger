import { chromium } from 'playwright';

const file = 'file:///C:/Users/lenovo/.codex/visualizations/2026/09/10/01a08ba9-9a3a-7760-af3b-5502dd3f8c4b/wireframe-preview.html';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const results = [];
for (const width of [736, 360]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(file);
  await page.waitForTimeout(200);
  const frame = page.frameLocator('iframe');
  const options = await frame.locator('#fl-screen option').count();
  for (let i = 0; i < options; i++) {
    const value = await frame.locator('#fl-screen option').nth(i).getAttribute('value');
    for (const platform of ['ios', 'android']) {
      await frame.locator('#fl-screen').selectOption(value);
      await frame.locator('#fl-viewport').selectOption(platform);
      const audit = await frame.locator('#fl-wireframes').evaluate(el => ({
        rootWidth: el.getBoundingClientRect().width,
        rootScrollWidth: el.scrollWidth,
        deviceText: el.querySelector('#fl-device')?.textContent?.trim().length || 0,
        selects: el.querySelectorAll('select').length,
      }));
      results.push({ width, value, platform, ...audit });
    }
  }
  if (width === 736) {
    await frame.locator('#fl-screen').selectOption('home');
    await frame.locator('#fl-viewport').selectOption('ios');
    await page.screenshot({ path: 'C:/Users/lenovo/.codex/visualizations/2026/09/10/01a08ba9-9a3a-7760-af3b-5502dd3f8c4b/wireframe-ios-check.png', fullPage: true });
  } else {
    await frame.locator('#fl-screen').selectOption('monthly');
    await frame.locator('#fl-viewport').selectOption('android');
    await page.screenshot({ path: 'C:/Users/lenovo/.codex/visualizations/2026/09/10/01a08ba9-9a3a-7760-af3b-5502dd3f8c4b/wireframe-android-check.png', fullPage: true });
  }
  if (errors.length) throw new Error(`Page errors at ${width}: ${errors.join('; ')}`);
  await page.close();
}
await browser.close();
const failed = results.filter(r => r.deviceText < 30 || r.rootScrollWidth > r.rootWidth + 2);
console.log(JSON.stringify({ checks: results.length, failed: failed.slice(0, 10) }, null, 2));
if (failed.length) process.exitCode = 1;
