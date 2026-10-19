import { validateDocuments } from './document-store.mjs';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function filterDocuments(documents, query = '', status = '') {
  const term = query.trim().toLocaleLowerCase('nl');
  return documents.filter((doc) => (!status || doc.source.status === status)
    && [doc.title, doc.content, doc.source.origin].some((text) => text.toLocaleLowerCase('nl').includes(term)));
}

export function exportDocuments(documents) {
  return JSON.stringify({ version: 1, documents: validateDocuments(documents) }, null, 2);
}

export function importDocuments(current, text) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    throw new Error('Het bestand is te groot. Maximaal 5 MB.');
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Dit bestand bevat geen geldige JSON.'); }
  if (data?.version !== 1) throw new Error('Onbekende back-upversie.');
  const incoming = validateDocuments(data.documents);
  const documents = validateDocuments(current);
  const existing = new Map(documents.map((doc) => [doc.documentId, doc]));
  let added = 0;
  let skipped = 0;
  for (const doc of incoming) {
    const previous = existing.get(doc.documentId);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(doc)) {
        throw new Error(`Conflict bij document “${doc.title}”. Niets geïmporteerd; de bestaande versie blijft behouden.`);
      }
      skipped++;
    } else {
      documents.push(doc);
      added++;
    }
  }
  return { documents, added, skipped };
}

export function restoreDocument(documents, deleted, index) {
  const existing = documents.find((doc) => doc.documentId === deleted.documentId);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(deleted)) {
      throw new Error('Terugzetten geweigerd: er bestaat al een andere versie met hetzelfde document-ID.');
    }
    return [...documents];
  }
  const restored = [...documents];
  restored.splice(Math.min(Math.max(index, 0), restored.length), 0, deleted);
  return restored;
}
