import { STATUS_VALUES } from './local-qa.mjs';
import { validateDocuments } from './document-store.mjs';

export const DRAFT_KEY = 'local-qa.editor-draft.v1';

function validateDraft(draft) {
  if (draft?.version !== 1 || !draft.fields
    || !['title', 'content', 'origin', 'status'].every((key) => typeof draft.fields[key] === 'string')
    || !STATUS_VALUES.includes(draft.fields.status)) {
    throw new Error('Ongeldig concept.');
  }
  const base = draft.base === null ? null : validateDocuments([draft.base])[0];
  const { title, content, origin, status } = draft.fields;
  return { version: 1, base, fields: { title, content, origin, status } };
}

export function createDraftStore(storage) {
  return {
    load() {
      const raw = storage.getItem(DRAFT_KEY);
      return raw === null ? null : validateDraft(JSON.parse(raw));
    },
    save(draft) { storage.setItem(DRAFT_KEY, JSON.stringify(validateDraft(draft))); },
    clear() { storage.removeItem(DRAFT_KEY); },
  };
}

export function recoverDraft(draft, documents) {
  const validated = validateDraft(draft);
  const current = validated.base && documents.find((doc) => doc.documentId === validated.base.documentId);
  const unchanged = current && JSON.stringify(current) === JSON.stringify(validated.base);
  return {
    document: unchanged ? current : null,
    fields: validated.fields,
    conflict: Boolean(validated.base && !unchanged),
  };
}
