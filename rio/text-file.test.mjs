import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTextFile, validateTextFile, MAX_TEXT_FILE_BYTES } from './text-file.mjs';

const bytes = (text) => new TextEncoder().encode(text);

test('UTF-8 text file supplies title, origin and unverified draft metadata', () => {
  const doc = parseTextFile('Waterkwaliteit.TXT', bytes('\uFEFFCafé en water.\r\nTweede regel.'));
  assert.equal(doc.title, 'Waterkwaliteit');
  assert.equal(doc.content, 'Café en water.\r\nTweede regel.');
  assert.deepEqual(doc.source, { origin: 'Waterkwaliteit.TXT', status: 'draft', statusProvidedBy: 'USER', verified: false });
});

test('Markdown and embedded markup remain literal document text', () => {
  const content = '# Rapport\n\n<script>alert(1)</script>\n\nWater.';
  assert.equal(parseTextFile('notities.md', bytes(content)).content, content);
  assert.equal(parseTextFile('.markdown', bytes('tekst')).title, '.markdown');
});

test('unsupported formats, oversized files and empty content are rejected', () => {
  for (const name of ['report.pdf', 'report.docx', 'report', 'report.txt.exe']) {
    assert.throws(() => validateTextFile(name, 10), /Kies een/);
  }
  assert.doesNotThrow(() => validateTextFile('report.txt', MAX_TEXT_FILE_BYTES));
  assert.throws(() => parseTextFile('report.txt', new Uint8Array(MAX_TEXT_FILE_BYTES + 1)), /te groot/);
  assert.throws(() => parseTextFile('report.txt', bytes('  \n\t ')), /Documentinhoud/);
});

test('invalid encoding and binary controls are rejected while tabs and newlines work', () => {
  assert.throws(() => parseTextFile('report.txt', new Uint8Array([0xc3, 0x28])), /UTF-8/);
  assert.throws(() => parseTextFile('report.txt', bytes('abc\u0000def')), /binaire/);
  assert.equal(parseTextFile('report.txt', bytes('a\tb\nc')).content, 'a\tb\nc');
});
