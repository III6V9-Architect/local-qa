import { createDocument } from './local-qa.mjs';

export const STORAGE_KEY = 'local-qa.documents.v1';

export function validateDocuments(documents) {
  if (!Array.isArray(documents)) throw new Error('Ongeldige documentenlijst.');
  const ids = new Set();
  return documents.map((doc) => {
    if (!doc || typeof doc.documentId !== 'string' || !doc.documentId.trim() || ids.has(doc.documentId)
      || typeof doc.title !== 'string' || typeof doc.content !== 'string'
      || typeof doc.source?.origin !== 'string' || typeof doc.source?.status !== 'string') {
      throw new Error('Ongeldig opgeslagen document.');
    }
    ids.add(doc.documentId);
    // Stored data is user input: reconstruct rather than trusting verification flags.
    return createDocument({ ...doc, origin: doc.source.origin, status: doc.source.status });
  });
}

export function createDocumentStore(storage) {
  let snapshot;
  let loaded = false;
  function assertCurrent() {
    if (!loaded) throw new Error('Opslag kon niet worden geladen; bestaande gegevens blijven behouden.');
    if (storage.getItem(STORAGE_KEY) !== snapshot) {
      throw new Error('Documenten zijn in een ander tabblad gewijzigd. Werk de documenten bij voordat je doorgaat.');
    }
  }
  return {
    assertCurrent,
    load() {
      loaded = false;
      const raw = storage.getItem(STORAGE_KEY);
      const data = raw === null ? { version: 1, documents: [] } : JSON.parse(raw);
      if (data?.version !== 1) throw new Error('Onbekende opslagversie.');
      const documents = validateDocuments(data.documents);
      snapshot = raw;
      loaded = true;
      return documents;
    },
    save(documents) {
      assertCurrent();
      const raw = JSON.stringify({ version: 1, documents: validateDocuments(documents) });
      storage.setItem(STORAGE_KEY, raw);
      snapshot = raw;
    },
  };
}
