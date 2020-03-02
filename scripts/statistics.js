'use strict';

const assert = require('assert');
const bcd = require('..');
const compareVersions = require('compare-versions');

/**
 * @typedef {object} VersionStats
 * @property {number} all The total number of occurrences for the browser.
 * @property {number} true The total number of `true` values for the browser.
 * @property {number} null The total number of `null` values for the browser.
 * @property {number} range The total number of range values for the browser.
 * @property {number} real The total number of real values for the browser.
 */

const browsers = [
  'chrome',
  'chrome_android',
  'edge',
  'firefox',
  'ie',
  'safari',
  'safari_ios',
  'webview_android',
];
/** @type {{total: VersionStats; [browser: string]: VersionStats}} */
let stats = { total: { all: 0, true: 0, null: 0, range: 0, real: 0 } };
browsers.forEach(browser => {
  const bcdReleaseData = bcd.browsers[browser].releases;
  const versions = Object.keys(bcdReleaseData);
  // Sorting is necessary because index-like properties are listed first, so
  // order from JSON isn't preserved. It is preserved in a Map however.
  versions.sort(compareVersions);
  const releases = new Map;
  for (const version of versions) {
    releases.set(version, {
      date: bcdReleaseData[version].release_date,
      added: new Set,
      removed: new Set,
    });
  }
  const no_release = new Set;
  stats[browser] = { all: 0, true: 0, null: 0, range: 0, real: 0, versions, releases, no_release }
});

const checkSupport = (supportData, type) => {
  if (!Array.isArray(supportData)) {
    supportData = [supportData];
  }
  if (type == '≤') {
    return supportData.some(
      item =>
        (typeof item.version_added == 'string' &&
          item.version_added.startsWith('≤')) ||
        (typeof item.version_removed == 'string' &&
          item.version_removed.startsWith('≤')),
    );
  }
  return supportData.some(
    item => item.version_added === type || item.version_removed === type,
  );
};

// Get release when this was added. Can return the same values as
// `version_added` (string/true/false/null) with the same meaning.
const getVersionAdded = (supportData, versions) => {
  const indexOf = (version) => {
    const index = versions.indexOf(version);
    assert(index !== -1, `Invalid version ${version}`);
    return index;
  };

  if (!Array.isArray(supportData)) {
    assert(supportData);
    supportData = [supportData];
  }
  assert(supportData.length);

  let earliestIndex = -1;
  let nonStringValues = new Set;
  for (const item of supportData) {
    if (item.flags) {
      // ignore things that are behind a flag
      continue;
    }
    if (item.prefix || item.alternative_name) {
      // ignore things with non-standard names
      // TODO: do something better, even though this doesn't seem to affect
      // results by a lot.
      continue;
    }
    if (item.version_removed) {
      // ignore things that have been removed
      // TODO: don't ignore them
      continue;
    }
    if (typeof item.version_added !== 'string') {
      nonStringValues.add(item.version_added);
      continue;
    }

    const index = indexOf(item.version_added);
    if (earliestIndex === -1 || index < earliestIndex) {
      earliestIndex = index;
    }
  }

  if (earliestIndex !== -1 ) {
    return versions[earliestIndex];
  }

  if (nonStringValues.size === 0) {
    return false;
  }

  //assert(nonStringValues.size < 2);
  if (nonStringValues.has(true)) {
    return true;
  }
  if (nonStringValues.has(false)) {
    return false;
  }

  return null;
};

const processData = (data, path) => {
  if (data.support) {
    browsers.forEach(function(browser) {
      stats[browser].all++;
      stats.total.all++;
      let real_value = true;
      if (!data.support[browser]) {
        stats[browser].null++;
        stats.total.null++;
        real_value = false;
        // printBrowserStats would be invalid if this didn't hold.
        assert(browser.includes('_'));
      } else {
        if (checkSupport(data.support[browser], null)) {
          stats[browser].null++;
          stats.total.null++;
          real_value = false;
        } else if (checkSupport(data.support[browser], true)) {
          stats[browser].true++;
          stats.total.true++;
          real_value = false;
        } else if (checkSupport(data.support[browser], '≤')) {
          stats[browser].range++;
          stats.total.range++;
          real_value = false;
        }
        const versions = stats[browser].versions;
        const version_added = getVersionAdded(data.support[browser], versions);
        if (typeof version_added === 'string') {
          stats[browser].releases.get(version_added).added.add(path);
        } else if (version_added === true || version_added === null) {
          stats[browser].no_release.add(path);
        }
      }
      if (real_value) {
        stats[browser].real++;
        stats.total.real++;
      }
    });
  }
};

const iterateData = (data, path) => {
  for (const key in data) {
    if (key === '__compat') {
      processData(data[key], path);
    } else {
      iterateData(data[key], `${path}.${key}`);
    }
  }
};

if (process.argv[2]) {
  iterateData(bcd[process.argv[2]]);
} else {
  for (const key in bcd) {
    if ((key === 'api' || key === 'css' || key === 'javascript')) {
      iterateData(bcd[key], key);
    }
  }
}

const printTable = () => {
  let table = `| browser | real values | ranged values | \`true\` values | \`null\` values |
| --- | --- | --- | --- | --- |
`;

  Object.keys(stats).forEach(entry => {
    table += `| ${entry.replace('_', ' ')} | `;
    table += `${((stats[entry].real / stats[entry].all) * 100).toFixed(2)}% | `;
    table += `${((stats[entry].range / stats[entry].all) * 100).toFixed(
      2,
    )}% | `;
    table += `${((stats[entry].true / stats[entry].all) * 100).toFixed(2)}% | `;
    table += `${((stats[entry].null / stats[entry].all) * 100).toFixed(2)}% |
`;
  });

  console.log(table);
};

const printBrowserStats = () => {
  console.log(`browser,version,date,added,min_total,max_total`);
  for (const browser of browsers) {
    if (browser.includes('_')) {
      continue;
    }
    let total = 0;
    const {releases, no_release} = stats[browser];
    for (const [version, {date, added}] of releases.entries()) {
      total += added.size;
      if (!date) {
        continue;
      }
    }
  }
}

const printInteropStats = () => {
  const interop_browsers = ['chrome', 'firefox', 'safari'];
  // TODO: generate duh
  const permutations = [
    'chrome+firefox+safari', // all
    'firefox+safari', 'chrome+safari', 'chrome+firefox', // 2
    'chrome', 'firefox', 'safari', // only X
  ];

  // table header
  console.log(`date,${permutations.join(',')}`);

  let release_dates = new Set;

  for (const browser of interop_browsers) {
    for (const {date} of stats[browser].releases.values()) {
      if (typeof date !== 'string') {
        continue;
      }
      release_dates.add(date);
    }
  }
  release_dates = Array.from(release_dates);
  release_dates.sort();

  for (const max_date of release_dates) {
    // For each browser, find the latest release at `date` and add the name of
    // the browser to `supported`. Then we reserve that map to get number of
    // entries supported in 1..N browsers.
    const interop = new Map;
    // set of paths to exclude because of incomplete data
    const incomplete = new Set;
    for (const browser of interop_browsers) {
      // TODO: this loop could be replaced by a simple lookup if removed APIs
      // were handled and there was a mapping from browsers release to *all*
      // supported APIs, not just the added ones. Would also need a list of
      // APIs with incomplete data.
      for (const {date, added} of stats[browser].releases.values()) {
        if (typeof date !== 'string') {
          continue;
        }
        if (date.localeCompare(max_date) > 0) {
          // future release
          continue;
        }
        for (const path of added) {
          if (!interop.has(path)) {
            interop.set(path, new Set([browser]));
          } else {
            interop.get(path).add(browser);
          }
        }
      }
      for (const path of stats[browser].no_release) {
        incomplete.add(path);
      }
    }

    // Now reserve the map, filtering out incomplete data at the same time.
    const reversed = new Map;
    for (const [path, browsers] of interop) {
      if (incomplete.has(path)) {
        continue;
      }
      const keyParts = Array.from(browsers);
      keyParts.sort();
      const key = keyParts.join('+');
      assert(permutations.includes(key));
      reversed.set(key, (reversed.get(key) || 0) + 1);
    }

    // now print table row
    const cells = permutations.map(key => reversed.get(key) || 0);
    console.log(`${max_date},${cells.join(',')}`);
  }
}

//printTable();
//printBrowserStats();
printInteropStats();
console.log(
  `Status as of version 0.0.xx (released on 2019-MM-DD) for ${
    process.argv[2] ? `${process.argv[2]}/ directory` : `web platform features`
  }: \n`,
);
printTable();
