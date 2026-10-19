import {
  STATUS_VALUES,
  USER_DISCLAIMER,
  createDocument,
  createQuote,
} from './local-qa.mjs';
import { createDocumentStore } from './document-store.mjs';
import { filterDocuments, exportDocuments, importDocuments, MAX_IMPORT_BYTES } from './document-library.mjs';

const state = {
  documents: [],
  currentDocument: null,
  quotes: [],
};

let store;
let storageError = '';

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
    button.addEventListener('click', () => {
      document.querySelector('[data-save-status]').textContent = '';
      state.currentDocument = doc;
      state.quotes = [createQuote(doc, doc.content)];
      updateFormState(doc);
      renderQuoteList();
      renderDocumentList();
      showError();
    });
    item.appendChild(button);
    list.appendChild(item);
  }
  const empty = document.querySelector('[data-library-empty]');
  empty.hidden = visible.length > 0;
  empty.textContent = state.documents.length ? 'Geen documenten gevonden.' : 'Nog geen opgeslagen documenten.';
  document.querySelector('#delete-document').disabled = !state.currentDocument;
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
}

function attachEvents() {
  const form = document.querySelector('#document-form');
  const resetButton = document.querySelector('#reset-document');
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
    if (!state.currentDocument) return;
    try {
      const documents = state.documents.filter((doc) => doc.documentId !== state.currentDocument.documentId);
      persist(documents);
      state.documents = documents;
      resetButton.click();
      document.querySelector('[data-save-status]').textContent = 'Document verwijderd.';
    } catch (error) {
      showError(error);
    }
  });

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      const form = document.querySelector('#document-form');
      if (form) form.reset();
      state.currentDocument = null;
      state.quotes = [];
      renderQuoteList();
      updateFormState(null);
      renderDocumentList();
      document.querySelector('[data-save-status]').textContent = '';

      const errorBox = document.querySelector('[data-error-box]');
      if (errorBox) {
        errorBox.textContent = '';
      }
    });
  }
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

