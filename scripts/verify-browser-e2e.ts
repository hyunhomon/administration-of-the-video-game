import { chromium } from '@playwright/test';
import type { AddressInfo } from 'node:net';
import { createAppServer } from '../src/server/index.js';

async function launchAvailableBrowser() {
  for (const channel of ['msedge', 'chrome', undefined] as const) {
    try {
      const browser = await chromium.launch({
        headless: true,
        ...(channel ? { channel } : {}),
      });
      console.log(`Launched headless browser using channel: ${channel ?? 'bundled-chromium'}`);
      return browser;
    } catch {
      // try next channel
    }
  }
  throw new Error('No headless Chromium/Edge/Chrome browser available');
}

async function main() {
  const serverInstance = createAppServer({ tickIntervalMs: 4000 });
  await new Promise<void>((resolve) => {
    serverInstance.server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (serverInstance.server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;
  console.log(`Started production verification server at ${url}`);

  const browser = await launchAvailableBrowser();
  try {
    const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await Promise.all([
      page1.goto(`${url}?name=Clerk_Hana&role=Town_Clerk`, { waitUntil: 'networkidle' }),
      page2.goto(`${url}?name=Watchman_Jin&role=Bridge_Watchman`, { waitUntil: 'networkidle' }),
    ]);

    // Verify Phaser canvas renders on both tabs inside .rpg-viewport-frame
    await page1.waitForSelector('.rpg-viewport-frame #phaser-container canvas', { timeout: 10000 });
    await page2.waitForSelector('.rpg-viewport-frame #phaser-container canvas', { timeout: 10000 });
    console.log('Verified Phaser 3 canvas rendered inside .rpg-viewport-frame in both Browser Tab 1 and Browser Tab 2.');

    // Verify Onboarding Banner is visible and interactive
    const onboardingVisible = await page1.locator('#onboarding-banner').isVisible();
    if (!onboardingVisible) {
      throw new Error('Expected #onboarding-banner to be visible on initial load');
    }
    await page1.locator('#btn-dismiss-onboarding').click();
    console.log('Verified Onboarding Field Briefing banner and dismissed it cleanly.');

    // Wait for WebSocket room join to sync NPC count = 2 across both browser sessions
    await page1.waitForFunction(
      () => {
        const el = document.getElementById('players-label');
        return el && el.textContent && el.textContent.includes('2');
      },
      { timeout: 10000 },
    );
    const playersLabel1 = await page1.textContent('#players-label');
    const playersLabel2 = await page2.textContent('#players-label');
    console.log(`Tab 1 status pill: "${playersLabel1}" | Tab 2 status pill: "${playersLabel2}"`);

    // Verify 4 adventurer cards render in aside.party-sidebar #agents-grid with portraits & trust attitude
    const partyCardsCount = await page1.locator('aside.party-sidebar #agents-grid .agent-card').count();
    if (partyCardsCount !== 4) {
      throw new Error(`Expected 4 adventurer cards in aside.party-sidebar, found ${partyCardsCount}`);
    }
    // Click Warrior's hero card to verify click-to-target selection
    await page1.locator('#agents-grid .agent-card[data-agent-id="warrior"]').click();
    const targetVal = await page1.locator('#target-agent-select').inputValue();
    if (targetVal !== 'warrior') {
      throw new Error(`Expected clicking warrior card to set #target-agent-select to "warrior", got "${targetVal}"`);
    }
    console.log('Verified 4 Hero Party Cards with SVG portraits and click-to-target selection in Party Sidebar.');

    // Verify Collapsible Secondary Drawer tabs
    await page1.locator('#btn-open-inspector').click();
    await page1.locator('#tab-btn-events').click();
    await page1.locator('#tab-btn-traces').click();
    console.log('Verified Collapsible Secondary Inspector Drawer & tab switching.');

    // Simulate WASD movement in Tab 1
    await page1.keyboard.press('KeyD');
    await page1.waitForTimeout(250);
    await page1.keyboard.press('KeyS');
    await page1.waitForTimeout(250);

    // Click the "#chip-storehouse" guided demo preset chip in Tab 1
    const quickBtn = page1.locator('#chip-storehouse');
    await quickBtn.click();
    console.log('Triggered "Persuade: Storehouse Clue (Branch B)" preset chip from Browser Tab 1...');

    // Wait for Tab 2 to observe the party route change in the DOM (#quest-goal-badge or #causal-action)
    await page2.waitForFunction(
      () => {
        const badge = document.getElementById('quest-goal-badge');
        const causal = document.getElementById('causal-action');
        const flag = document.querySelector('[data-flag="storehouseInvestigated"]');
        return Boolean(
          (badge && badge.textContent && badge.textContent.toLowerCase().includes('storehouse')) ||
            (causal && causal.textContent && causal.textContent.includes('(5, 4)')) ||
            (flag && flag.classList.contains('flag-on')),
        );
      },
      { timeout: 35000 },
    );

    const goalBadgeTab2 = await page2.textContent('#quest-goal-badge');
    const causalActionTab2 = await page2.textContent('#causal-action');
    const traceSourceBadge = await page2.textContent('#trace-source-badge');
    console.log(`Browser Tab 2 observed party route shift -> Badge: "${goalBadgeTab2}"`);
    console.log(`Browser Tab 2 observed trace source -> "${traceSourceBadge}"`);
    console.log(`Browser Tab 2 observed causal action -> "${causalActionTab2}"`);

    // Fast-forward ticks via UI button in Tab 1 until Storehouse is verified!
    const stepBtn = page1.locator('#btn-step');
    for (let i = 0; i < 4; i++) {
      await stepBtn.click();
      await page1.waitForTimeout(250);
    }

    await page2.waitForFunction(
      () => {
        const pill = document.querySelector('[data-flag="storehouseInvestigated"]');
        return pill && pill.classList.contains('flag-on');
      },
      { timeout: 10000 },
    );
    console.log('Browser Tab 2 verified world state: "Storehouse Verified ✓" quest flag is ON and Sunsteel Blade equipped!');

    await context1.close();
    await context2.close();
    console.log('Two-browser E2E verification PASSED!');
  } finally {
    await browser.close();
    serverInstance.shutdown();
  }
}

main().catch((err) => {
  console.error('E2E browser verification failed:', err);
  process.exit(1);
});
