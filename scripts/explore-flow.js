import { chromium } from 'playwright';

const toolUrl = process.env.TOOL_URL;

if (!toolUrl) {
  throw new Error('Set TOOL_URL to the DB A.I. Watermark Compositor URL before running exploration.');
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

await page.goto(toolUrl, { waitUntil: 'domcontentloaded' });

const snapshot = await page.evaluate(() => {
  const visibleText = (element) => element.innerText || element.getAttribute('aria-label') || element.value || '';

  return {
    title: document.title,
    fileInputs: [...document.querySelectorAll('input[type="file"]')].map((input, index) => ({
      index,
      accept: input.getAttribute('accept'),
      name: input.getAttribute('name'),
      id: input.id
    })),
    buttons: [...document.querySelectorAll('button, [role="button"]')].map((button, index) => ({
      index,
      text: visibleText(button).trim(),
      id: button.id,
      className: button.className
    })),
    selects: [...document.querySelectorAll('select')].map((select, index) => ({
      index,
      name: select.getAttribute('name'),
      id: select.id,
      options: [...select.options].map((option) => ({ value: option.value, label: option.label || option.text }))
    }))
  };
});

console.log(JSON.stringify(snapshot, null, 2));
console.log('Browser is open for manual inspection. Press Ctrl+C when done.');

await new Promise(() => {});
