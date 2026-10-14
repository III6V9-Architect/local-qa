import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STATUS_VALUES,
  USER_DISCLAIMER,
  createDocument,
  createQuote,
  normalizeOrigin,
  validateStatus,
  resetDocumentMetadata,
} from './local-qa.mjs';

test('document invoeren met herkomst + status', () => {
  const document = createDocument({
    documentId: 'doc-1',
    title: 'Test document',
    content: 'Citaat voorbeeld',
    origin: '  Intranet  ',
    status: 'specificatie',
  });

  assert.equal(document.source.origin, 'Intranet');
  assert.equal(document.source.status, 'specificatie');
  assert.equal(document.source.verified, false);
  assert.equal(document.source.statusProvidedBy, 'USER');
});

test('citaat toont herkomst + status + voorbehoud-label', () => {
  const document = createDocument({
    documentId: 'doc-2',
    title: 'Citaat document',
    content: 'Tekst voor citaat',
    origin: 'Bron X',
    status: 'historisch',
  });

  const quote = createQuote(document, document.content);
  assert.equal(quote.source.origin, 'Bron X');
  assert.equal(quote.source.status, 'historisch');
  assert.equal(quote.label, USER_DISCLAIMER);
  assert.match(quote.rendered, /Bron X · historisch/);
});

test('onbekende status-waarde wordt geweigerd', () => {
  assert.throws(() => validateStatus('vervallen'), /Ongeldige status/);
});

test('lege herkomst wordt expliciet ONBEKEND', () => {
  const document = createDocument({
    documentId: 'doc-3',
    title: 'Zonder bron',
    content: 'tekst',
    origin: '   ',
    status: 'draft',
  });

  assert.equal(document.source.origin, 'ONBEKEND');
  assert.equal(normalizeOrigin('   '), 'ONBEKEND');
});

test('reset wist metadata', () => {
  const doc = createDocument({
    documentId: 'doc-4',
    title: 'Reset document',
    content: 'tekst',
    origin: 'Bron Y',
    status: 'historisch',
  });

  const resetDoc = resetDocumentMetadata(doc);
  assert.equal(resetDoc.source.origin, 'ONBEKEND');
  assert.equal(resetDoc.source.status, 'draft');
  assert.equal(resetDoc.source.verified, false);
  assert.equal(resetDoc.title, '');
  assert.equal(resetDoc.content, '');
});

test('status enum is exact', () => {
  assert.deepEqual(STATUS_VALUES, ['draft', 'historisch', 'specificatie']);
});

test('document title and content are required after trimming', () => {
  for (const value of ['', '   ', null, undefined]) {
    assert.throws(() => createDocument({ title: value, content: 'tekst' }), /Documenttitel is vereist/);
    assert.throws(() => createDocument({ title: 'Titel', content: value }), /Documentinhoud is vereist/);
  }
});

test('all statuses preserve the user disclaimer and unverified metadata', () => {
  for (const status of STATUS_VALUES) {
    const doc = createDocument({ title: ' Titel ', content: ' tekst ', origin: '', status: ` ${status.toUpperCase()} ` });
    const quote = createQuote(doc, doc.content);
    assert.equal(doc.title, 'Titel');
    assert.equal(quote.quote, 'tekst');
    assert.equal(quote.source.status, status);
    assert.equal(quote.source.origin, 'ONBEKEND');
    assert.equal(quote.source.verified, false);
    assert.equal(quote.source.statusProvidedBy, 'USER');
    assert.equal(quote.label, USER_DISCLAIMER);
  }
});

test('reset preserves the document schema', () => {
  const doc = createDocument({ title: 'Titel', content: 'tekst' });
  const keys = Object.keys(doc).sort();
  resetDocumentMetadata(doc);
  assert.deepEqual(Object.keys(doc).sort(), keys);
  assert.equal(resetDocumentMetadata(null), null);
});

