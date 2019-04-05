'use strict';

const bcd = require('..');
const compareVersions = require('compare-versions');

const browsers = ['chrome', 'chrome_android', 'edge', 'firefox', 'ie', 'safari', 'safari_ios', 'webview_android'];
let stats = { total: { all: 0, true: 0, null: 0, real: 0 } };
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
  stats[browser] = { all: 0, true: 0, null: 0, real: 0, versions, releases }
});

const checkSupport = (supportData, type) => {
  if (!Array.isArray(supportData)) {
    supportData = [supportData];
  }
  return supportData.some(item => item.version_added === type || item.version_removed === type)
};

// get releases when this was added and removed. either or both may be null.
const getVersionAdded = (supportData, versions) => {
  if (!Array.isArray(supportData)) {
    supportData = [supportData];
  }

  let earliestIndex = -1;
  for (const item of supportData) {
    if (item.flags) {
      // ignore things that are behind a flag
      continue;
    }
    if (item.version_removed) {
      // ignore things that have been removed
      continue;
    }
    if (item.prefix || item.alternative_name) {
      // ignore things with non-standard names
      // TODO: do something better, this will influence results a lot
      continue;
    }
    if (typeof item.version_added !== 'string') {
      // ignore things with non-string versions
      continue;
    }
    const index = versions.indexOf(item.version_added);
    if (index === -1) {
      throw new Error(`Invalid version ${item.version_added}`);
    }
    if (earliestIndex === -1 || index < earliestIndex) {
      earliestIndex = index;
    }
  }
  return versions[earliestIndex] || null;
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
      } else {
        if (checkSupport(data.support[browser], null)) {
          stats[browser].null++;
          stats.total.null++;
          real_value = false;
        }
        if (checkSupport(data.support[browser], true)) {
          stats[browser].true++;
          stats.total.true++;
          real_value = false;
        }
        const versions = stats[browser].versions;
        const version_added = getVersionAdded(data.support[browser], versions);
        if (version_added) {
          stats[browser].releases.get(version_added).added.add(path);
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
  for (let key in data) {
    if (key === '__compat') {
      processData(data[key], path);
    } else {
      iterateData(data[key], `${path}.${key}`);
    }
  }
};

for (let key in bcd) {
  if (!(key === 'browsers' || key === 'webextensions')) {
    iterateData(bcd[key], key);
  }
}

const printTable = () => {
  let table = `| browser | real values | \`true\` values | \`null\` values |
| --- | --- | --- | --- |
`;

  Object.keys(stats).forEach(entry => {
    table += `| ${entry.replace('_', ' ')} | `;
    table += `${((stats[entry].real / stats[entry].all) * 100).toFixed(2)}% | `;
    table += `${((stats[entry].true / stats[entry].all) * 100).toFixed(2)}% | `;
    table += `${((stats[entry].null / stats[entry].all) * 100).toFixed(2)}% |
`;
  });

  console.log(table);
}

const printBrowserStats = () => {
  console.log(`browser,version,date,added,total`);
  for (const browser of browsers) {
    if (browser.includes('_')) {
      continue;
    }
    let total = 0;
    for (const [version, {date, added}] of stats[browser].releases.entries()) {
      total += added.size;
      if (!date) {
        continue;
      }
      console.log(`${browser},${version},${date},${added.size},${total}`);
    }
  }
}

//console.log('Status as of version 0.0.xx (released on xx/xx/2019) for web platform features: \n')
//printTable();
printBrowserStats();
