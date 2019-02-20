'use strict';

const bcd = require('..');

const buckets = new Set([
  'api',
  'css',
  'html',
  'http',
  'javascript',
  'svg',
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

// Flatten a `__compat` object into just true/false/null.
function flatten(compat) {
  const support = {};
  for (const browser of ['chrome', 'firefox', 'safari']) {
    let entry = compat.support[browser];
    if (Array.isArray(entry)) {
      entry = entry[0];
    }
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
