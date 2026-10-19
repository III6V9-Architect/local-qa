import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCitation, formatPassageReport } from './citation-export.mjs';
import { USER_DISCLAIMER } from './local-qa.mjs';

const passage = {
  documentId: 'doc-1', title: 'Waterrapport', paragraphNumber: 2,
  source: { origin: 'Archief', status: 'historisch' },
  quote: 'Waterkwaliteit is niet vastgesteld.\nTweede regel: café.',
};

test('citation includes full provenance, mandatory disclaimer and literal text', () => {
  const text = formatCitation({ ...passage, label: 'verified' });
  assert.equal(text, [
    'Document: Waterrapport', 'Document-ID: doc-1', 'Alinea: 2',
    'Herkomst: Archief', 'Status: historisch', USER_DISCLAIMER,
    '', 'Citaat:', passage.quote,
  ].join('\n'));
});

test('report preserves result order, submitted question and disclaimer per source', () => {
  const second = { ...passage, documentId: 'doc-2', title: 'Tweede bron', quote: '<img src=x> Water.' };
  const text = formatPassageReport('  Wat is de waterkwaliteit? ', [passage, second]);
  assert.ok(text.includes('Vraag: Wat is de waterkwaliteit?'));
  assert.ok(text.includes('Aantal passages: 2'));
  assert.ok(text.includes('geen zelfstandig antwoord of verificatie'));
  assert.equal(text.split(USER_DISCLAIMER).length - 1, 2);
  assert.ok(text.indexOf('Document-ID: doc-1') < text.indexOf('Document-ID: doc-2'));
  assert.ok(text.includes(second.quote));
});

test('report requires a question and at least one result', () => {
  assert.throws(() => formatPassageReport(' ', [passage]), /Zoek eerst/);
  assert.throws(() => formatPassageReport('water', []), /Zoek eerst/);
});
