'use strict';

const bcd = require('.');

const buckets = new Set([
  'api',
  'css',
  'html',
  'http',
  'javascript',
  'svg',
]);

const browsers = new Set([
  'chrome',
  'chrome_android',
  'edge',
  'firefox',
  'ie',
  'safari',
  'safari_ios',
  'webview_android',
]);

function walk(root, callback) {
  var path = [];
  function walkInternal(node) {
    callback(node, path);
    if (node === null || typeof node !== "object") {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      path.push(key);
      walkInternal(value);
      path.pop();
    }
  }
  walkInternal(root);
}

// Build a set of supported
const browserSupport = {};

// Flatten a `__compat` object into just true/false/null.
function flatten(compat) {
  const support = {};
  for (const browser of browsers) {
    let entries = compat.support[browser];
    if (!entries) {
      support[browser] = null;
      continue;
    }
    if (!Array.isArray(entries)) {
      entries = [entries];
    }
    const entry = entries.find(e => {
      return e.version_added !== undefined && e.flags === undefined;
    });
    if (!entry || entry.version_removed) {
      support[browser] = false;
    } else {
      support[browser] = entry.version_added;
    }
  }
  return support;
}

walk(bcd, (value, path) => {
  if (!buckets.has(path[0])) {
    return;
  }
  if (value && value.__compat) {
    const support = flatten(value.__compat);
    const anyNull = Object.values(support).some(v => v === null);
    if (anyNull) {
      // console.log(path.join('.'), support);
      return;
    }
    // Chrome-only
    if (support.chrome && !support.firefox && !support.safari) {
      //console.log(path.join('.'), support);
    }
    // Firefox-only missing support
    if (!support.firefox && support.chrome && support.safari) {
      console.log(path.join('.'), support);
    }
  }
});
