import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument } from './local-qa.mjs';
import { filterDocuments, exportDocuments, importDocuments, restoreDocument, MAX_IMPORT_BYTES } from './document-library.mjs';

const make = (id, title = 'Rapport', status = 'draft') => createDocument({ documentId: id, title, content: 'Inhoud over water', origin: 'Archief', status });

test('search matches title, content and origin with combined status filter', () => {
  const docs = [make('a', 'Plan', 'historisch'), make('b', 'Rapport')];
  assert.deepEqual(filterDocuments(docs, '  PLAN '), [docs[0]]);
  assert.equal(filterDocuments(docs, 'WATER').length, 2);
  assert.equal(filterDocuments(docs, 'archief').length, 2);
  assert.deepEqual(filterDocuments(docs, 'water', 'draft'), [docs[1]]);
  assert.deepEqual(filterDocuments(docs, 'missing'), []);
  assert.equal(filterDocuments(docs).length, 2);
});

test('export/import roundtrip is idempotent and preserves canonical metadata', () => {
  const docs = [make('a'), make('b', 'Historie', 'historisch')];
  const text = exportDocuments(docs);
  const restored = importDocuments([], text);
  assert.deepEqual(restored, { documents: docs, added: 2, skipped: 0 });
  assert.deepEqual(importDocuments(docs, text), { documents: docs, added: 0, skipped: 2 });
});

test('a conflict rejects all additions without mutating the current collection', () => {
  const current = [make('a')];
  const before = JSON.stringify(current);
  assert.throws(() => importDocuments(current, exportDocuments([make('b'), make('a', 'Different')])), /Conflict/);
  assert.equal(JSON.stringify(current), before);
});

test('invalid, duplicate, unsupported and oversized imports are rejected', () => {
  for (const text of ['{', 'null', JSON.stringify({ version: 2, documents: [] }),
    JSON.stringify({ version: 1, documents: [make('a'), make('a')] }),
    JSON.stringify({ version: 1, documents: [{ ...make('a'), content: '' }] }),
    ' '.repeat(MAX_IMPORT_BYTES + 1)]) {
    assert.throws(() => importDocuments([], text));
  }
});

test('import ignores verification claims and treats markup as plain document data', () => {
  const doc = make('a', '<img src=x>');
  doc.source.verified = true;
  doc.source.statusProvidedBy = 'SYSTEM';
  const { documents: [loaded] } = importDocuments([], JSON.stringify({ version: 1, documents: [doc] }));
  assert.equal(loaded.title, '<img src=x>');
  assert.equal(loaded.source.verified, false);
  assert.equal(loaded.source.statusProvidedBy, 'USER');
});

test('restore puts a deleted document back without mutating the current list', () => {
  const a = make('a');
  const b = make('b');
  const c = make('c');
  const current = [a, c];
  assert.deepEqual(restoreDocument(current, b, 1), [a, b, c]);
  assert.deepEqual(current, [a, c]);
  assert.deepEqual(restoreDocument([], b, 5), [b]);
});

test('restore is idempotent if the exact document already exists', () => {
  const a = make('a');
  assert.deepEqual(restoreDocument([a], a, 0), [a]);
});

test('restore refuses to overwrite a conflicting imported version', () => {
  const current = [make('a', 'Imported revision')];
  assert.throws(() => restoreDocument(current, make('a'), 0), /andere versie/);
  assert.equal(current[0].title, 'Imported revision');
});
