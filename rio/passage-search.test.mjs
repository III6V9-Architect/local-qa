import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, USER_DISCLAIMER } from './local-qa.mjs';
import { searchPassages } from './passage-search.mjs';

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
