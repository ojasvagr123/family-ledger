import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, decimalMoney, formatMoney, suggestedCurrencySymbol, isLocalDate, calculateSummary, canEditTransaction, localToday, detectCsvDelimiter, parseDelimitedText, normalizeImportedDate } from '../packages/domain/src/index.ts';
test('money conversion is exact and rejects ambiguous input', () => {
  assert.equal(parseMoney('0.29'), '29');
  assert.equal(parseMoney('9999999999999.99'), '999999999999999');
  assert.equal(parseMoney('-0.01', true), '-1');
  assert.equal(decimalMoney('-1'), '-0.01');
  assert.equal(formatMoney('-1'), '-₹0.01');
  assert.equal(formatMoney('123456', 'INR', 'Rs.'), 'Rs.1,234.56');
  assert.equal(suggestedCurrencySymbol('USD'), '$');
  for (const value of ['0','1.001','1e3','NaN','-1','1,200','10000000000000']) assert.throws(() => parseMoney(value));
});
test('calendar validation handles leap days and impossible dates', () => {
  assert.equal(isLocalDate('2024-02-29'), true);
  for (const value of ['2025-02-29','2024-04-31','2026-13-01','bad']) assert.equal(isLocalDate(value), false);
});
test('family date uses timezone parts without locale string parsing', () => {
  assert.equal(localToday('Asia/Kolkata', new Date('2026-09-13T20:00:00Z')), '2026-09-14');
  assert.equal(localToday('America/Los_Angeles', new Date('2026-09-13T20:00:00Z')), '2026-09-13');
});
test('summary handles zero income and negative net', () => {
  assert.equal(calculateSummary(0n, 100n).savingsRate, null);
  assert.equal(calculateSummary(100n, 150n).netMinor, -50n);
  assert.equal(calculateSummary(100n, 150n).savingsRate, -50);
});
test('transaction UI permission matrix', () => {
  assert.equal(canEditTransaction('VIEWER','a','a'), false);
  assert.equal(canEditTransaction('MEMBER','a','b'), false);
  assert.equal(canEditTransaction('MEMBER','a','a'), true);
  assert.equal(canEditTransaction('OWNER','a','b'), true);
});
test('CSV parsing supports delimiters, quoted commas and multiline cells', () => {
  assert.equal(detectCsvDelimiter('Date;Amount;Description\n2026-01-01;10;Tea'), ';');
  assert.deepEqual(parseDelimitedText('Date,Description,Amount\n2026-01-01,"Food, dining",10\n2026-01-02,"Two\nlines",20'), [
    ['Date', 'Description', 'Amount'],
    ['2026-01-01', 'Food, dining', '10'],
    ['2026-01-02', 'Two\nlines', '20'],
  ]);
});
test('CSV date normalization respects explicit day/month order', () => {
  assert.equal(normalizeImportedDate('31/01/2026', 'DMY'), '2026-01-31');
  assert.equal(normalizeImportedDate('01/31/2026', 'MDY'), '2026-01-31');
  assert.equal(normalizeImportedDate('2026-01-31', 'YMD'), '2026-01-31');
  assert.equal(normalizeImportedDate('31/02/2026', 'DMY'), '31/02/2026');
});
