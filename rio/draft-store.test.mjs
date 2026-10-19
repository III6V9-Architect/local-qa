import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftStore, recoverDraft } from './draft-store.mjs';
import { createDocument } from './local-qa.mjs';

const base = () => createDocument({ documentId: 'one', title: 'Titel', content: 'Tekst', origin: 'Bron' });
const draft = (document = null) => ({ version: 1, base: document, fields: { title: '', content: 'Onvoltooid', origin: '', status: 'draft' } });
function storage(raw = null) {
  return { getItem: () => raw, setItem: (_key, value) => { raw = value; }, removeItem: () => { raw = null; } };
}

test('draft store roundtrips incomplete fields and clears them', () => {
  const store = createDraftStore(storage());
  assert.equal(store.load(), null);
  store.save(draft());
  assert.deepEqual(store.load(), draft());
  store.clear();
  assert.equal(store.load(), null);
});

test('recovery only attaches to an unchanged original document', () => {
  const original = base();
  assert.equal(recoverDraft(draft(original), [original]).document, original);
  const changed = { ...original, content: 'Nieuwe versie' };
  for (const docs of [[changed], []]) {
    const recovered = recoverDraft(draft(original), docs);
    assert.equal(recovered.document, null);
    assert.equal(recovered.conflict, true);
    assert.equal(recovered.fields.content, 'Onvoltooid');
  }
  assert.equal(recoverDraft(draft(), []).conflict, false);
});

test('malformed draft records are rejected without changing stored bytes', () => {
  for (const raw of ['{', 'null', JSON.stringify({ ...draft(), version: 2 }), JSON.stringify({ ...draft(), fields: { content: 42 } })]) {
    const memory = storage(raw);
    assert.throws(() => createDraftStore(memory).load());
    assert.equal(memory.getItem(), raw);
  }
});

test('draft storage failures propagate and never alter the collection', () => {
  const doc = base();
  const store = createDraftStore({ setItem() { throw new Error('Quota'); }, removeItem() { throw new Error('Denied'); } });
  assert.throws(() => store.save(draft(doc)), /Quota/);
  assert.throws(() => store.clear(), /Denied/);
  assert.equal(doc.content, 'Tekst');
});
