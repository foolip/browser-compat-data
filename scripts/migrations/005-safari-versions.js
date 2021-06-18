#!/usr/bin/env node
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';
const fs = require('fs');
const path = require('path');
const { platform } = require('os');

/** Determines if the OS is Windows */
const IS_WINDOWS = platform() === 'win32';

const SAFARI_MAP = new Map([
  ['3.2', '3.1'],
  ['6.1', '7'],
]);
const IOS_MAP = new Map([
  ['3.1', '3'],
  ['4.3', '4.2'],
  ['5.1', '5'],
  ['6.1', '6'],
]);

const mapVersions = (value, versionMap) => {
  if (typeof value === 'string') {
    return versionMap.get(value) || value;
  }
  if (Array.isArray(value)) {
    return value.map(v => mapVersions(v, versionMap));
  }
  if (typeof value.version_added === 'string') {
    value.version_added = mapVersions(value.version_added, versionMap);
  }
  if (typeof value.version_removed === 'string') {
    value.version_removed = mapVersions(value.version_removed, versionMap);
  }
  return value;
};

const reviver = (key, value) => {
  if (key === '__compat') {
    if (value.support.safari) {
      value.support.safari = mapVersions(value.support.safari, SAFARI_MAP);
    }
    if (value.support.safari_ios) {
      value.support.safari_ios = mapVersions(value.support.safari_ios, IOS_MAP);
    }
  }
  return value;
};

/**
 * @param {Promise<void>} filename
 */
const fixSafariVersions = filename => {
  const actual = fs.readFileSync(filename, 'utf-8').trim();
  const expected = JSON.stringify(JSON.parse(actual, reviver), null, 2);

  if (IS_WINDOWS) {
    // prevent false positives from git.core.autocrlf on Windows
    actual = actual.replace(/\r/g, '');
    expected = expected.replace(/\r/g, '');
  }

  if (actual !== expected) {
    fs.writeFileSync(filename, expected + '\n', 'utf-8');
  }
};

if (require.main === module) {
  /**
   * @param {string[]} files
   */
  function load(...files) {
    for (let file of files) {
      if (file.indexOf(__dirname) !== 0) {
        file = path.resolve(__dirname, '..', '..', file);
      }

      if (!fs.existsSync(file)) {
        continue; // Ignore non-existent files
      }

      if (fs.statSync(file).isFile()) {
        if (path.extname(file) === '.json') {
          fixSafariVersions(file);
        }

        continue;
      }

      const subFiles = fs.readdirSync(file).map(subfile => {
        return path.join(file, subfile);
      });

      load(...subFiles);
    }
  }

  if (process.argv[2]) {
    load(process.argv[2]);
  } else {
    load(
      'api',
      'css',
      'html',
      'http',
      'svg',
      'javascript',
      'mathml',
      'test',
      'webdriver',
      'webextensions',
    );
  }
}

module.exports = { fixSafariVersions };
