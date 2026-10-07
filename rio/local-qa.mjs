export const STATUS_VALUES = ['draft', 'historisch', 'specificatie'];
export const USER_DISCLAIMER = 'gebruikersopgave — niet geverifieerd';

export function normalizeOrigin(input) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (value === '') {
    return 'ONBEKEND';
  }

  return value;
}

export function validateStatus(status) {
  const value = String(status ?? '').trim().toLowerCase();

  if (!STATUS_VALUES.includes(value)) {
    throw new Error(`Ongeldige status: ${status}. Geldige waarden zijn: ${STATUS_VALUES.join(', ')}`);
  }

  return value;
}

export function createDocument({ documentId, title, content, origin, status = 'draft' }) {
  const source = {
    origin: normalizeOrigin(origin),
    status: validateStatus(status),
    statusProvidedBy: 'USER',
    verified: false,
  };

  return {
    documentId: documentId ?? `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: String(title ?? '').trim(),
    content: String(content ?? '').trim(),
    source,
  };
}

export function createQuote(document, quoteText) {
  if (!document || !document.documentId) {
    throw new Error('Document ontbreekt.');
  }

  const quote = String(quoteText ?? '').trim();
  if (!quote) {
    throw new Error('Citaattekst is vereist.');
  }

  return {
    documentId: document.documentId,
    quote,
    source: {
      origin: document.source.origin,
      status: document.source.status,
      statusProvidedBy: document.source.statusProvidedBy,
      verified: document.source.verified,
    },
    label: USER_DISCLAIMER,
    rendered: `${document.source.origin} · ${document.source.status} — ${USER_DISCLAIMER}`,
  };
}

export function resetDocumentMetadata(documentState) {
  if (!documentState) {
    return null;
  }

  documentState.title = '';
  documentState.content = '';
  documentState.origin = '';
  documentState.status = 'draft';
  documentState.source = {
    origin: 'ONBEKEND',
    status: 'draft',
    statusProvidedBy: 'USER',
    verified: false,
  };

  return documentState;
}
