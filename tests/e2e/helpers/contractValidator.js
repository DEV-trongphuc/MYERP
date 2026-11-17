/**
 * tests/e2e/helpers/contractValidator.js
 * Contract and static architecture validator for MYERP codebase.
 * Verifies code contracts, anti-patterns, security boundaries, and schema alignment.
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert } from './testHarness.js';

const ROOT_DIR = path.resolve(process.cwd());

export function resolveProjectPath(relativePath) {
  return path.resolve(ROOT_DIR, relativePath);
}

export function fileExists(relativePath) {
  return fs.existsSync(resolveProjectPath(relativePath));
}

export function readProjectFile(relativePath) {
  const fullPath = resolveProjectPath(relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Project file does not exist: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

export function assertFileContains(relativePath, needle, message = '') {
  const content = readProjectFile(relativePath);
  const found = content.includes(needle);
  assert(found, message || `File ${relativePath} should contain "${needle}"`);
}

export function assertFileNotContains(relativePath, needle, message = '') {
  const content = readProjectFile(relativePath);
  const found = content.includes(needle);
  assert(!found, message || `File ${relativePath} should NOT contain "${needle}"`);
}

export function assertRegexMatch(relativePath, regex, message = '') {
  const content = readProjectFile(relativePath);
  const matched = regex.test(content);
  assert(matched, message || `File ${relativePath} should match pattern ${regex}`);
}

export function assertRegexNotMatch(relativePath, regex, message = '') {
  const content = readProjectFile(relativePath);
  const matched = regex.test(content);
  assert(!matched, message || `File ${relativePath} should NOT match pattern ${regex}`);
}

export function checkSoftDeleteEnforcement(sqlString) {
  // If statement contains DELETE FROM on core entity without archive/soft delete
  const forbidden = /\bDELETE\s+FROM\s+(users|contacts|leads|deals|activities|deposits|invoices|expenses|students|data_reports|surveys|forms|marketing_campaigns)\b/i;
  return !forbidden.test(sqlString);
}

export function checkDynamicInParameterReindexing(codeSnippet) {
  // Checks if array_unique is wrapped in array_values
  const hasArrayValues = /array_values\s*\(\s*array_unique\s*\(/.test(codeSnippet);
  return hasArrayValues;
}
