import {
  STATUS_VALUES,
  USER_DISCLAIMER,
  createDocument,
  createQuote,
} from './local-qa.mjs';
import { searchPassages } from './passage-search.mjs';
import { createDocumentStore } from './document-store.mjs';
import { filterDocuments, exportDocuments, importDocuments, restoreDocument, MAX_IMPORT_BYTES } from './document-library.mjs';

const state = {
  documents: [],
  currentDocument: null,
  quotes: [],
};

let store;
let storageError = '';
let lastQuestion = '';
let savedFormFingerprint = '';
let lastDeleted = null;
let unloadGuardAttached = false;

function formFingerprint() {
  return JSON.stringify(['title', 'content', 'origin', 'status'].map((id) => document.getElementById(id).value));
}

function hasUnsavedChanges() {
  return formFingerprint() !== savedFormFingerprint;
}

function beforeUnload(event) {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
}

function updateDirtyState() {
  const dirty = hasUnsavedChanges();
  document.querySelector('[data-dirty-status]').textContent = dirty ? 'Niet-opgeslagen wijzigingen' : '';
  if (dirty && !unloadGuardAttached) window.addEventListener('beforeunload', beforeUnload);
  if (!dirty && unloadGuardAttached) window.removeEventListener('beforeunload', beforeUnload);
  unloadGuardAttached = dirty;
}

function confirmDiscard() {
  return !hasUnsavedChanges() || window.confirm('Je hebt niet-opgeslagen wijzigingen. Wil je deze verwerpen?');
}

function resetEditor() {
  state.currentDocument = null;
  state.quotes = [];
  updateFormState(null);
  renderQuoteList();
  renderDocumentList();
  showError();
  document.querySelector('[data-save-status]').textContent = '';
}


function openDocument(doc) {
  if (doc.documentId === state.currentDocument?.documentId) return true;
  if (!confirmDiscard()) return false;
  document.querySelector('[data-save-status]').textContent = '';
  state.currentDocument = doc;
  state.quotes = [createQuote(doc, doc.content)];
  updateFormState(doc);
  renderQuoteList();
  renderDocumentList();
  showError();
  return true;
}


function showError(error = '') {
  document.querySelector('[data-error-box]').textContent = error instanceof Error ? error.message : error;
}

function renderDocumentList() {
  const list = document.querySelector('[data-document-list]');
  list.replaceChildren();
  const visible = filterDocuments(state.documents,
    document.querySelector('#document-search').value,
    document.querySelector('#document-filter').value);
  document.querySelector('[data-result-count]').textContent = `${visible.length} van ${state.documents.length} documenten`;
  for (const doc of visible) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = doc.title;
    button.setAttribute('aria-pressed', String(doc.documentId === state.currentDocument?.documentId));
    button.addEventListener('click', () => openDocument(doc));
    item.appendChild(button);
    list.appendChild(item);
  }
  const empty = document.querySelector('[data-library-empty]');
  empty.hidden = visible.length > 0;
  empty.textContent = state.documents.length ? 'Geen documenten gevonden.' : 'Nog geen opgeslagen documenten.';
  document.querySelector('#delete-document').disabled = !state.currentDocument;
}

function renderPassages() {
  const list = document.querySelector('[data-passage-list]');
  const message = document.querySelector('[data-question-status]');
  list.replaceChildren();
  if (!lastQuestion) {
    message.textContent = 'Stel een vraag om passages in alle opgeslagen documenten te zoeken.';
    return;
  }
  try {
    if (storageError) throw new Error(storageError);
    const results = searchPassages(state.documents, lastQuestion);
    message.textContent = results.length
      ? `${results.length} passende passages (maximaal 5). Controleer de bron en context.`
      : 'Geen passende passages gevonden. Probeer andere zoekwoorden.';
    for (const result of results) {
      const item = document.createElement('li');
      item.className = 'quote-item';
      item.dataset.testid = 'passage-card';
      const title = document.createElement('h3');
      title.textContent = `${result.title} — alinea ${result.paragraphNumber}`;
      const metadata = document.createElement('p');
      metadata.textContent = result.rendered;
      const matched = document.createElement('p');
      matched.textContent = `Gevonden woorden: ${result.matchedTerms.join(', ')}`;
      const quote = document.createElement('blockquote');
      quote.textContent = result.quote;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'secondary';
      open.textContent = 'Open brondocument';
      open.addEventListener('click', () => {
        const doc = state.documents.find((doc) => doc.documentId === result.documentId);
        if (doc && openDocument(doc)) {
          document.querySelector('#title').focus();
        }
      });
      item.append(title, metadata, matched, quote, open);
      list.appendChild(item);
    }
  } catch (error) {
    message.textContent = error.message;
  }
}

function persist(documents) {
  if (storageError) throw new Error(storageError);
  try {
    store.save(documents);
  } catch (error) {
    throw new Error(`Niet opgeslagen. ${error.message}`);
  }
}

function renderQuoteList() {
  const list = document.querySelector('[data-quote-list]');
  if (!list) return;

  list.innerHTML = '';

  if (!state.quotes.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Nog geen citaat. Voeg een document toe.';
    list.appendChild(empty);
    return;
  }

  for (const quote of state.quotes) {
    const item = document.createElement('li');
    item.className = 'quote-item';
    item.setAttribute('data-testid', 'quote-card');

    const metadata = document.createElement('div');
    metadata.className = 'quote-meta';
    metadata.textContent = `${quote.source.origin} · ${quote.source.status}`;

    const disclaimer = document.createElement('div');
    disclaimer.className = 'quote-disclaimer';
    disclaimer.textContent = quote.label;

    const body = document.createElement('blockquote');
    body.textContent = quote.quote;

    item.appendChild(metadata);
    item.appendChild(disclaimer);
    item.appendChild(body);
    list.appendChild(item);
  }
}

function updateFormState(documentState) {
  const originField = document.querySelector('#origin');
  const statusField = document.querySelector('#status');
  if (!originField || !statusField) return;

  document.querySelector('#title').value = documentState?.title ?? '';
  document.querySelector('#content').value = documentState?.content ?? '';
  originField.value = documentState?.source?.origin ?? '';
  statusField.value = documentState?.source?.status ?? 'draft';
  savedFormFingerprint = formFingerprint();
  updateDirtyState();
}

function attachEvents() {
  document.querySelector('#question-form').addEventListener('submit', (event) => {
    event.preventDefault();
    lastQuestion = document.querySelector('#question').value.trim();
    renderPassages();
  });
  document.querySelector('#question').addEventListener('input', () => {
    lastQuestion = '';
    renderPassages();
  });
  const form = document.querySelector('#document-form');
  const resetButton = document.querySelector('#reset-document');
  form.addEventListener('input', updateDirtyState);
  form.addEventListener('change', updateDirtyState);
  document.querySelector('#document-search').addEventListener('input', renderDocumentList);
  document.querySelector('#document-filter').addEventListener('change', renderDocumentList);
  const backupStatus = document.querySelector('[data-backup-status]');
  const backupError = document.querySelector('[data-backup-error]');
  document.querySelector('#export-documents').addEventListener('click', () => {
    backupStatus.textContent = '';
    backupError.textContent = '';
    try {
      if (storageError) throw new Error(storageError);
      const blob = new Blob([exportDocuments(state.documents)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'local-qa-backup.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      backupStatus.textContent = 'Back-up van alle opgeslagen documenten gedownload.';
    } catch (error) {
      backupError.textContent = error.message;
    }
  });
  const importInput = document.querySelector('#import-documents');
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    importInput.disabled = true;
    backupStatus.textContent = '';
    backupError.textContent = '';
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Het bestand is te groot. Maximaal 5 MB.');
      const text = await file.text();
      const result = importDocuments(state.documents, text);
      persist(result.documents);
      state.documents = result.documents;
      renderDocumentList();
      renderPassages();
      backupStatus.textContent = `${result.added} toegevoegd, ${result.skipped} overgeslagen.`;
    } catch (error) {
      backupError.textContent = error.message;
    } finally {
      importInput.disabled = false;
      importInput.value = '';
    }
  });

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      document.querySelector('[data-save-status]').textContent = '';

      const formData = new FormData(form);
      const title = formData.get('title') ?? '';
      const content = formData.get('content') ?? '';
      const origin = formData.get('origin') ?? '';
      const status = formData.get('status') ?? 'draft';

      try {
        const documentState = createDocument({
          documentId: state.currentDocument?.documentId ?? crypto.randomUUID(),
          title,
          content,
          origin,
          status,
        });

        const quote = createQuote(documentState, documentState.content);
        const documents = state.documents.filter((doc) => doc.documentId !== documentState.documentId);
        documents.push(documentState);
        persist(documents);
        state.documents = documents;
        renderPassages();
        state.currentDocument = documentState;
        state.quotes = [quote];
        const errorBox = document.querySelector('[data-error-box]');
        if (errorBox) errorBox.textContent = '';
        renderQuoteList();
        updateFormState(documentState);
        renderDocumentList();
        document.querySelector('[data-save-status]').textContent = 'Document lokaal opgeslagen.';
      } catch (error) {
        const errorBox = document.querySelector('[data-error-box]');
        if (errorBox) {
          errorBox.textContent = error instanceof Error ? error.message : 'Ongeldige invoer.';
        }
      }
    });
  }

  document.querySelector('#delete-document').addEventListener('click', () => {
    if (!state.currentDocument || !confirmDiscard()) return;
    document.querySelector('[data-save-status]').textContent = '';
    try {
      const deleted = { document: state.currentDocument, index: state.documents.findIndex((doc) => doc.documentId === state.currentDocument.documentId) };
      const documents = state.documents.filter((doc) => doc.documentId !== state.currentDocument.documentId);
      persist(documents);
      state.documents = documents;
      lastDeleted = deleted;
      document.querySelector('#undo-delete').hidden = false;
      document.querySelector('[data-undo-status]').textContent = `“${deleted.document.title}” verwijderd. Terugzetten kan tot de volgende verwijdering of herladen.`;
      renderPassages();
      resetEditor();
      document.querySelector('[data-save-status]').textContent = 'Document verwijderd.';
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector('#undo-delete').addEventListener('click', () => {
    if (!lastDeleted) return;
    document.querySelector('[data-save-status]').textContent = '';
    try {
      const documents = restoreDocument(state.documents, lastDeleted.document, lastDeleted.index);
      persist(documents);
      state.documents = documents;
      lastDeleted = null;
      document.querySelector('#undo-delete').hidden = true;
      document.querySelector('[data-undo-status]').textContent = 'Document teruggezet. Je huidige invoer is behouden.';
      renderDocumentList();
      renderPassages();
      showError();
    } catch (error) {
      showError(error);
    }
  });

  resetButton.addEventListener('click', () => {
    if (confirmDiscard()) resetEditor();
  });
}

if (typeof document !== 'undefined') {
  try {
    store = createDocumentStore(window.localStorage);
    state.documents = store.load();
  } catch {
    storageError = 'Lokale opslag is niet beschikbaar of beschadigd. Bestaande gegevens zijn niet gewijzigd. Herstel de opslag en herlaad de pagina.';
    document.querySelector('[data-storage-error]').textContent = storageError;
  }
  attachEvents();
  renderPassages();
  renderDocumentList();
  renderQuoteList();
  updateFormState(null);
}

export {
  state,
  STATUS_VALUES,
  USER_DISCLAIMER,
  createDocument,
  createQuote,
};

