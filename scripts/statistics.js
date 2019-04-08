'use strict';

const assert = require('assert');
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
  stats[browser] = { all: 0, true: 0, null: 0, real: 0, versions, releases, no_release: 0 }
});

const checkSupport = (supportData, type) => {
  if (!Array.isArray(supportData)) {
    supportData = [supportData];
  }
  return supportData.some(item => item.version_added === type || item.version_removed === type)
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
  const real_value_browsers = new Set;
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
        }
        if (checkSupport(data.support[browser], true)) {
          stats[browser].true++;
          stats.total.true++;
          real_value = false;
        }
        const versions = stats[browser].versions;
        const version_added = getVersionAdded(data.support[browser], versions);
        if (typeof version_added === 'string') {
          stats[browser].releases.get(version_added).added.add(path);
          real_value_browsers.add(browser);
        } else if (version_added === true || version_added === null) {
          stats[browser].no_release++;
        } else if (version_added === false) {
          real_value_browsers.add(browser);
        }
      }
      if (real_value) {
        stats[browser].real++;
        stats.total.real++;
      }
    });
  }
  if (!['chrome', 'edge', 'firefox', 'safari'].every(browser => real_value_browsers.has(browser))) {
    //console.log(path);
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
  if ((key === 'api' || key === 'css' || key === 'javascript')) {
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
  const browsers = ['chrome', 'edge', 'firefox', 'safari'];
  // TODO: generate duh
  const permutations = [
    'chrome', 'edge', 'firefox', 'safari', // 1
    'chrome+edge', 'chrome+firefox', 'chrome+safari', 'edge+firefox', 'edge+safari', 'firefox+safari', // 2
    'chrome+edge+firefox', 'chrome+edge+safari', 'chrome+firefox+safari', 'edge+firefox+safari', // 3
    'chrome+edge+firefox+safari' // 4
  ];

  // table header
  console.log(`date,${permutations.join(',')}`);

  let release_dates = new Set;

  for (const browser of browsers) {
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
    // entries supported in 1..4 browsers.
    const interop = new Map;
    for (const browser of browsers) {
      // TODO: this loop could be replaced by a simple lookup if removed APIs
      // were handled and there was a mapping from browsers release to *all*
      // supported APIs, not just the added ones.
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
    }

    // Now reserve the map.
    const reversed = new Map;
    for (const [path, browsers] of interop) {
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
