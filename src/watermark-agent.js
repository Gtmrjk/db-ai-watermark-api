import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const LANGUAGES = new Map([
  ['english', 'English'],
  ['hindi', 'Hindi'],
  ['marathi', 'Marathi'],
  ['gujarati', 'Gujarati']
]);

const DEFAULT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 120000);

export function normalizeLanguage(language) {
  const key = String(language || '').trim().toLowerCase();
  const normalized = LANGUAGES.get(key);

  if (!normalized) {
    throw new Error('Unsupported language. Use English, Hindi, Marathi, or Gujarati.');
  }

  return normalized;
}

export async function createWatermarkedJpg({ imagePath, language, toolUrl = process.env.TOOL_URL }) {
  if (!toolUrl) {
    throw new Error('TOOL_URL is required. Set it to the DB A.I. Watermark Compositor URL.');
  }

  const selectedLanguage = normalizeLanguage(language);
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
    await page.goto(toolUrl, { waitUntil: 'domcontentloaded' });

    await uploadCoverImage(page, imagePath);
    await selectLanguage(page, selectedLanguage);

    const download = await triggerJpgDownload(page);
    const downloadedPath = await download.path();

    if (!downloadedPath) {
      throw new Error('The browser download did not produce a readable file.');
    }

    const buffer = await readFile(downloadedPath);
    const suggestedFilename = download.suggestedFilename() || 'watermarked.jpg';

    return {
      buffer,
      filename: suggestedFilename.toLowerCase().endsWith('.jpg') || suggestedFilename.toLowerCase().endsWith('.jpeg')
        ? suggestedFilename
        : 'watermarked.jpg'
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function uploadCoverImage(page, imagePath) {
  const fileInputs = page.locator('input[type="file"]');

  if (await fileInputs.count()) {
    await fileInputs.first().setInputFiles(imagePath);
    return;
  }

  const fileChooserPromise = page.waitForEvent('filechooser');
  await clickFirst([
    page.getByRole('button', { name: /cover/i }),
    page.getByText(/cover/i),
    page.getByRole('button', { name: /upload|choose|select/i })
  ], 'Cover upload button');

  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(imagePath);
}

async function selectLanguage(page, language) {
  const nativeSelect = page.locator('select').first();

  if (await nativeSelect.count()) {
    await selectNativeLanguage(nativeSelect, language);
    return;
  }

  const combo = page.getByRole('combobox').first();

  if (await combo.count()) {
    await combo.click();
    await page.getByRole('option', { name: new RegExp(`^${escapeRegExp(language)}$`, 'i') }).click();
    return;
  }

  await clickFirst([
    page.getByText(/english|hindi|marathi|gujarati/i),
    page.getByRole('button', { name: /english|hindi|marathi|gujarati|language/i })
  ], 'language dropdown');

  await clickFirst([
    page.getByRole('option', { name: new RegExp(`^${escapeRegExp(language)}$`, 'i') }),
    page.getByText(new RegExp(`^${escapeRegExp(language)}$`, 'i'))
  ], `${language} option`);
}

async function triggerJpgDownload(page) {
  const downloadControl = await firstExistingLocator([
    page.getByRole('button', { name: /download\s*jpg/i }),
    page.getByRole('link', { name: /download\s*jpg/i }),
    page.getByText(/download\s*jpg/i)
  ], 'Download JPG button');

  await downloadControl.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT_MS });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: DEFAULT_TIMEOUT_MS }),
    downloadControl.click()
  ]);

  return download;
}

async function clickFirst(locators, label) {
  const locator = await firstExistingLocator(locators, label);
  await locator.click();
}

async function firstExistingLocator(locators, label) {
  for (const locator of locators) {
    if (await locator.count().catch(() => 0)) {
      return locator.first();
    }
  }

  throw new Error(`Could not find ${label}.`);
}

function languageIndex(language) {
  return [...LANGUAGES.values()].indexOf(language);
}

async function selectNativeLanguage(select, language) {
  const attempts = [
    { label: language },
    { value: language },
    { value: language.toLowerCase() },
    { index: languageIndex(language) }
  ];

  for (const option of attempts) {
    try {
      await select.selectOption(option);
      return;
    } catch {
      // Try the next common way this UI may have encoded the language option.
    }
  }

  throw new Error(`Could not select language ${language}.`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
