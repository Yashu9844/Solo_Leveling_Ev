import { chromium, devices } from '@playwright/test';

const OUT = process.argv[2];
const W = Number(process.argv[3] || 390);

const b = await chromium.launch();
const ctx = await b.newContext({
  ...devices['Pixel 7'],
  viewport: { width: W, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await ctx.clock.install({ time: new Date('2026-09-05T10:00:00Z') });
const p = await ctx.newPage();

await p.goto('http://localhost:4178/');
await p.getByRole('button', { name: 'Begin your journey' }).click();
await p.getByPlaceholder('Your name').fill('Ada');
await p.getByRole('button', { name: 'Begin' }).click();
await p.getByRole('button', { name: 'Next' }).click();
await p.getByRole('button', { name: 'Next' }).click();
await p
  .getByPlaceholder('This is the only thing the app judges you against.')
  .fill('Ship a working agent and land an offer.');
await p.getByRole('button', { name: 'Next' }).click();
for (const [t, v] of [
  ['career-intention-place', 'my desk'],
  ['career-intention-action', 'open the job board'],
  ['dsa-intention-place', 'my desk'],
  ['dsa-intention-action', 'open the editor'],
  ['training-intention-place', 'the gym'],
  ['training-intention-action', 'change & start'],
]) {
  await p.getByTestId(t).fill(v);
}
await p.getByRole('button', { name: 'Next' }).click();
await p.getByRole('button', { name: 'Initialise system' }).click();
await p.waitForURL(/\/today$/);
await p.waitForTimeout(1200);

for (const tab of ['TODAY', 'PROGRESS', 'SKILLS', 'PROFILE']) {
  await p.getByRole('link', { name: tab }).click();
  await p.waitForTimeout(700);
  await p.screenshot({
    path: `${OUT}/${tab}-${W}.png`,
    clip: { x: 0, y: 0, width: W, height: 260 },
  });
}

await b.close();
console.log('shots done', W);
