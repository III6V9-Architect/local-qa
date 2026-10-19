import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentStore, STORAGE_KEY } from './document-store.mjs';
import { createDocument } from './local-qa.mjs';

function memoryStorage(raw = null) {
  return { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
}
const doc = () => createDocument({ documentId: 'one', title: 'Titel', content: 'Tekst', origin: 'Bron', status: 'historisch' });

test('storage roundtrip, update and deletion preserve canonical metadata', () => {
  const storage = memoryStorage();
  const store = createDocumentStore(storage);
  assert.deepEqual(store.load(), []);
  store.save([doc()]);
  assert.deepEqual(createDocumentStore(storage).load(), [doc()]);
  store.save([{ ...doc(), title: 'Gewijzigd' }]);
  assert.equal(createDocumentStore(storage).load()[0].title, 'Gewijzigd');
  store.save([]);
  assert.deepEqual(createDocumentStore(storage).load(), []);
});

test('malformed, unsupported and duplicate data block writes without replacement', () => {
  for (const raw of ['{', 'null', JSON.stringify({ version: 2, documents: [] }),
    JSON.stringify({ version: 1, documents: [doc(), doc()] }),
    JSON.stringify({ version: 1, documents: [{ ...doc(), content: '' }] })]) {
    const storage = memoryStorage(raw);
    const store = createDocumentStore(storage);
    assert.throws(() => store.load());
    assert.throws(() => store.save([]));
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('stored verification claims cannot promote user metadata', () => {
  const data = doc();
  data.source.verified = true;
  data.source.statusProvidedBy = 'SYSTEM';
  const store = createDocumentStore(memoryStorage(JSON.stringify({ version: 1, documents: [data] })));
  const [loaded] = store.load();
  assert.equal(loaded.source.verified, false);
  assert.equal(loaded.source.statusProvidedBy, 'USER');
});

test('failed writes and changes from another tab do not advance the snapshot', () => {
  const storage = memoryStorage();
  const first = createDocumentStore(storage);
  const second = createDocumentStore(storage);
  first.load();
  second.load();
  first.save([doc()]);
  assert.throws(() => second.save([]), /ander tabblad/);
  assert.equal(first.load().length, 1);
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => first.save([]), /QuotaExceededError/);
  storage.setItem = write;
  first.save([]);
  assert.deepEqual(first.load(), []);
});
