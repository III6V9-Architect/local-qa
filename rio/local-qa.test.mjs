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
