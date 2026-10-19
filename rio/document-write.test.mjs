import test from 'node:test';
import assert from 'node:assert/strict';
import { writeDocuments, WRITE_LOCK } from './document-write.mjs';
import { createDocumentStore } from './document-store.mjs';
import { createDocument } from './local-qa.mjs';

test('serialized writers preserve the first save and reject a stale snapshot', async () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const first = createDocumentStore(storage);
  const second = createDocumentStore(storage);
  first.load(); second.load();
  const locks = { request: async (name, options, callback) => {
    assert.equal(name, WRITE_LOCK);
    assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
    return callback({ name });
  } };
  const doc = createDocument({ documentId: 'one', title: 'First', content: 'Text', status: 'draft' });
  await writeDocuments(first, [doc], locks);
  await assert.rejects(writeDocuments(second, [], locks), /ander tabblad/);
  assert.deepEqual(createDocumentStore(storage).load(), [doc]);
});

test('busy and unsupported locks never attempt a write', async () => {
  const store = { save: () => assert.fail('must not write') };
  await assert.rejects(writeDocuments(store, [], { request: async (_, __, cb) => cb(null) }), /ander tabblad slaat/);
  await assert.rejects(writeDocuments(store, [], undefined), /Web Locks/);
});

test('write failures propagate and a subsequent retry can succeed', async () => {
  let fail = true;
  let saved = false;
  const locks = { request: async (_, __, cb) => cb({}) };
  const store = { save: () => { if (fail) throw new Error('Quota'); saved = true; } };
  await assert.rejects(writeDocuments(store, [], locks), /Quota/);
  fail = false;
  await writeDocuments(store, [], locks);
  assert.equal(saved, true);
});
