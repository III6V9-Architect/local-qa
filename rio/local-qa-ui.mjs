import {
  STATUS_VALUES,
  USER_DISCLAIMER,
  createDocument,
  createQuote,
} from './local-qa.mjs';
import { parseTextFile, validateTextFile } from './text-file.mjs';
import { formatCitation, formatPassageReport } from './citation-export.mjs';
import { searchPassages, highlightParts } from './passage-search.mjs';
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
let currentPassages = [];
let currentSearchOptions = { status: '', match: 'any' };
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
  document.querySelector('[data-file-status]').textContent = '';
  document.querySelector('[data-file-error]').textContent = '';
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
  document.querySelector('[data-file-status]').textContent = '';
  document.querySelector('[data-file-error]').textContent = '';
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
  currentPassages = [];
  document.querySelector('#export-passages').disabled = true;
  document.querySelector('[data-passage-export-status]').textContent = '';
  list.replaceChildren();
  if (!lastQuestion) {
    message.textContent = 'Stel een vraag om passages in alle opgeslagen documenten te zoeken.';
    return;
  }
  try {
    if (storageError) throw new Error(storageError);
    currentSearchOptions = {
      status: document.querySelector('#question-status-filter').value,
      match: document.querySelector('#question-match').value,
    };
    const results = searchPassages(state.documents, lastQuestion, currentSearchOptions);
    currentPassages = results;
    document.querySelector('#export-passages').disabled = !results.length;
    message.textContent = results.length
      ? `${results.length} passende passages (maximaal 5). Controleer de bron en context.`
      : 'Geen passende passages gevonden. Probeer andere zoekwoorden of zoekinstellingen.';
    for (const result of results) {
      const item = document.createElement('li');
      item.className = 'quote-item';
      item.dataset.testid = 'passage-card';
      const title = document.createElement('h3');
      title.textContent = `${result.title} — alinea ${result.paragraphNumber}`;
      const metadata = document.createElement('p');
      metadata.textContent = result.rendered;
      const matched = document.createElement('p');
      matched.textContent = `Gevonden woorden (${result.matchedTerms.length} van ${result.queryTerms.length}): ${result.matchedTerms.join(', ')}`;
      const quote = document.createElement('blockquote');
      for (const part of highlightParts(result.quote, result.matchedTerms)) {
        if (part.matched) {
          const mark = document.createElement('mark');
          mark.textContent = part.text;
          quote.appendChild(mark);
        } else {
          quote.appendChild(document.createTextNode(part.text));
        }
      }
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
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'secondary';
      copy.textContent = 'Kopieer citaat met bron';
      const copyStatus = document.createElement('p');
      copyStatus.setAttribute('role', 'status');
      const fallback = document.createElement('textarea');
      fallback.readOnly = true;
      fallback.hidden = true;
      fallback.rows = 10;
      fallback.setAttribute('aria-label', 'Citaat met bronvermelding handmatig kopiëren');
      copy.addEventListener('click', async () => {
        const text = formatCitation(result);
        copy.disabled = true;
        copyStatus.textContent = '';
        try {
          await navigator.clipboard.writeText(text);
          fallback.hidden = true;
          copyStatus.textContent = 'Citaat met bronvermelding gekopieerd.';
        } catch {
          copyStatus.textContent = 'Automatisch kopiëren is niet beschikbaar. Kopieer de geselecteerde tekst hieronder.';
          fallback.value = text;
          fallback.hidden = false;
          fallback.focus();
          fallback.select();
        } finally {
          copy.disabled = false;
        }
      });
      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.append(open, copy);
      item.append(title, metadata, matched, quote, actions, copyStatus, fallback);
      list.appendChild(item);
    }
  } catch (error) {
    message.textContent = error.message;
  }
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function updateFormState(documentState, markSaved = true) {
  const originField = document.querySelector('#origin');
  const statusField = document.querySelector('#status');
  if (!originField || !statusField) return;

  document.querySelector('#title').value = documentState?.title ?? '';
  document.querySelector('#content').value = documentState?.content ?? '';
  originField.value = documentState?.source?.origin ?? '';
  statusField.value = documentState?.source?.status ?? 'draft';
  if (markSaved) savedFormFingerprint = formFingerprint();
  updateDirtyState();
}

function attachEvents() {
  document.querySelector('#export-passages').addEventListener('click', () => {
    const message = document.querySelector('[data-passage-export-status]');
    try {
      const text = formatPassageReport(lastQuestion, currentPassages, currentSearchOptions);
      downloadText(text, 'local-qa-passages.txt', 'text/plain;charset=utf-8');
      message.textContent = 'Vraag en passages met bronvermelding gedownload.';
    } catch (error) {
      message.textContent = error.message;
    }
  });
  const textInput = document.querySelector('#open-text-file');
  textInput.addEventListener('change', async () => {
    const file = textInput.files[0];
    if (!file) return;
    const fileStatus = document.querySelector('[data-file-status]');
    const fileError = document.querySelector('[data-file-error]');
    textInput.disabled = true;
    fileStatus.textContent = '';
    fileError.textContent = '';
    try {
      validateTextFile(file.name, file.size);
      const parsed = parseTextFile(file.name, await file.arrayBuffer());
      // Confirm against the current editor after asynchronous reading has finished.
      if (!confirmDiscard()) {
        fileStatus.textContent = 'Openen geannuleerd. Je huidige invoer is behouden.';
        return;
      }
      resetEditor();
      updateFormState(parsed, false);
      fileStatus.textContent = `“${file.name}” geopend als nieuw document. Controleer de inhoud en klik op Document opslaan.`;
      document.querySelector('#title').focus();
    } catch (error) {
      fileError.textContent = `Kon bestand niet openen. ${error.message}`;
    } finally {
      textInput.disabled = false;
      textInput.value = '';
    }
  });
  document.querySelector('#question-status-filter').addEventListener('change', renderPassages);
  document.querySelector('#question-match').addEventListener('change', renderPassages);
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
      downloadText(exportDocuments(state.documents), 'local-qa-backup.json', 'application/json');
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
        document.querySelector('[data-file-status]').textContent = '';
        document.querySelector('[data-file-error]').textContent = '';
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

