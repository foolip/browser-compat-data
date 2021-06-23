const fs = require('fs/promises');

const puppeteer = require('puppeteer');

const bcd = require('.');
const { visit } = utils = require('./utils');

const entryPoints = [
  'api',
  //'browsers',
  'css',
  'html',
  'http',
  'javascript',
  'mathml',
  'svg',
  // Not web exposed in the typical way:
  // 'webdriver', 'webextensions',
  // https://github.com/mdn/browser-compat-data/pull/9830:
  // 'xpath', 'xslt',
];

async function screenshot(page, url, filename, includeHeader = false) {
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded'
  });
  const status = response.status();
  if (!(status >= 200 && status <= 299)) {
    console.warn(`${url} status is ${status}`);
    return;
  }
  const table = await page.waitForSelector('.bc-table');
  await page.evaluate((table, includeHeader) => {
    // Remove the header if not explicitly included.
    if (!includeHeader) {
      table.tHead.remove()
    }
    // Remove any Node.js cells.
    const nodeCells = document.querySelectorAll('.bc-platform-server, .bc-browser-nodejs');
    for (const cell of Array.from(nodeCells)) {
      cell.remove();
    }
  }, table, includeHeader);
  await table.screenshot({path: filename});
}

async function isFile(path) {
  try {
    const stats = await fs.stat(path);
    return stats.isFile();
  } catch (e) {
    return false;
  }
}
async function main() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({
    width: 1024, // the breakpoint for the compact desktop layout
    height: 768,
    deviceScaleFactor: 1,
  });

  // First collect entries (synchronous visitor callbacks)
  const entries = new Map();
  for (const entryPoint of entryPoints) {
    visit((path, compat) => {
      if (!compat.mdn_url) {
        // Nothing to screenshot.
        return;
      }

      entries.set(path, compat);

      // Don't visit child entries, they will be included in the screenshot
      // of their parent, if any.
      return visit.CONTINUE;
    }, { entryPoint, data: bcd });
  }

  // Now try taking a screenshot of each in turn.
  let includeHeader = true;
  for (const [path, compat] of entries.entries()) {
    // Tweak the URL to use a locally running mdn/content
    const url = new URL(compat.mdn_url);
    url.protocol = 'http:';
    url.host = 'localhost:5000';

    // Save in screenshots/
    const filename = `screenshots/${path}.png`;

    if (await isFile(filename)) {
      includeHeader = false;
      continue;
    }

    console.log(`Taking screenshot of ${url} as ${filename}`);
    try {
      await screenshot(page, url, filename, includeHeader);
      includeHeader = false;
    } catch(e) {
      console.warn(e);
    }
  }

  await browser.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
