import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, USER_DISCLAIMER } from './local-qa.mjs';
import { searchPassages, highlightParts } from './passage-search.mjs';

const doc = (id, content, status = 'draft') => createDocument({ documentId: id, title: `Bron ${id}`, content, origin: 'Archief', status });

test('question returns exact paragraphs, their source and disclaimer', () => {
  const source = doc('a', 'Andere tekst.\n\nWaterkwaliteit is niet vastgesteld.\nControle volgt.', 'historisch');
  const [result] = searchPassages([source], 'Wat is de waterkwaliteit?');
  assert.equal(result.quote, 'Waterkwaliteit is niet vastgesteld.\nControle volgt.');
  assert.ok(source.content.includes(result.quote));
  assert.equal(result.paragraphNumber, 2);
  assert.equal(result.documentId, 'a');
  assert.equal(result.title, 'Bron a');
  assert.equal(result.source.origin, 'Archief');
  assert.equal(result.source.status, 'historisch');
  assert.equal(result.source.verified, false);
  assert.equal(result.label, USER_DISCLAIMER);
});

test('ranking uses distinct matched words and limits results to five', () => {
  const docs = [doc('a', 'Water water water.'), doc('b', 'Water kwaliteit.')];
  for (let n = 0; n < 6; n++) docs.push(doc(`extra-${n}`, 'Water.'));
  const results = searchPassages(docs, 'water kwaliteit water');
  assert.equal(results.length, 5);
  assert.equal(results[0].documentId, 'b');
  assert.equal(results[1].documentId, 'a');
  assert.deepEqual(results[0].matchedTerms, ['water', 'kwaliteit']);
});

test('whole-word Unicode matching keeps negations and ignores title-only matches', () => {
  assert.equal(searchPassages([doc('a', 'Waterkwaliteit.')], 'water').length, 0);
  assert.equal(searchPassages([doc('a', 'Café en café.')], 'CAFE\u0301').length, 1);
  assert.equal(searchPassages([doc('a', 'Niet vastgesteld.')], 'niet').length, 1);
  assert.equal(searchPassages([doc('water', 'Over zand.')], 'water').length, 0);
});

test('empty, punctuation and function-word questions require a search word', () => {
  for (const question of ['', '   ', '?!', 'wat is de']) {
    assert.throws(() => searchPassages([], question), /zoekwoord/);
  }
  assert.deepEqual(searchPassages([], 'water'), []);
  assert.deepEqual(searchPassages([doc('a', 'Zand.')], 'water'), []);
});

test('results reflect edits and removals without mutating documents', () => {
  const docs = [doc('a', 'Water.')];
  const before = JSON.stringify(docs);
  searchPassages(docs, 'water');
  assert.equal(JSON.stringify(docs), before);
  assert.deepEqual(searchPassages([doc('a', 'Zand.')], 'water'), []);
  assert.deepEqual(searchPassages([], 'water'), []);
});

test('all-word mode requires distinct terms in the same paragraph', () => {
  const docs = [doc('a', 'Water.\n\nKwaliteit.'), doc('b', 'Water kwaliteit.')];
  assert.equal(searchPassages(docs, 'water kwaliteit').length, 3);
  const results = searchPassages(docs, 'Wat is water kwaliteit water?', { match: 'all' });
  assert.deepEqual(results.map((result) => result.documentId), ['b']);
  assert.deepEqual(results[0].queryTerms, ['water', 'kwaliteit']);
});

test('status filter applies before ranking and the result limit', () => {
  const docs = Array.from({ length: 6 }, (_, index) => doc(`draft-${index}`, 'Water kwaliteit.'));
  docs.push(doc('spec', 'Water.', 'specificatie'));
  const results = searchPassages(docs, 'water kwaliteit', { status: 'specificatie' });
  assert.deepEqual(results.map((result) => result.documentId), ['spec']);
  assert.deepEqual(searchPassages(docs, 'water', { status: 'historisch' }), []);
  assert.throws(() => searchPassages(docs, 'water', { status: 'verified' }), /statusfilter/);
  assert.throws(() => searchPassages(docs, 'water', { match: 'unknown' }), /zoekmodus/);
});

test('highlighting preserves original Unicode, whitespace and literal markup', () => {
  const text = 'Cafe\u0301, CAFÉ!\n<img src=x> water.';
  const parts = highlightParts(text, ['café', 'water']);
  assert.equal(parts.map((part) => part.text).join(''), text);
  assert.deepEqual(parts.filter((part) => part.matched).map((part) => part.text), ['Cafe\u0301', 'CAFÉ', 'water']);
});

test('highlighting matches whole words and preserves no-match strings', () => {
  assert.deepEqual(highlightParts('waterkwaliteit water', ['water']), [
    { text: 'waterkwaliteit ', matched: false }, { text: 'water', matched: true },
  ]);
  assert.deepEqual(highlightParts('zand', ['water']), [{ text: 'zand', matched: false }]);
  assert.deepEqual(highlightParts('', ['water']), []);
});
