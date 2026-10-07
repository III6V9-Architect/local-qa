import {
  STATUS_VALUES,
  USER_DISCLAIMER,
  createDocument,
  createQuote,
  resetDocumentMetadata,
} from './local-qa.mjs';

const state = {
  currentDocument: null,
  quotes: [],
};

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

  originField.value = documentState?.source?.origin ?? '';
  statusField.value = documentState?.source?.status ?? 'draft';
}

function attachEvents() {
  const form = document.querySelector('#document-form');
  const resetButton = document.querySelector('#reset-document');

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const title = formData.get('title') ?? '';
      const content = formData.get('content') ?? '';
      const origin = formData.get('origin') ?? '';
      const status = formData.get('status') ?? 'draft';

      try {
        const documentState = createDocument({
          documentId: `doc-${Date.now()}`,
          title,
          content,
          origin,
          status,
        });

        state.currentDocument = documentState;
        const quote = createQuote(documentState, documentState.content || title || 'Geen citaat beschikbaar.');
        state.quotes = [quote];
        renderQuoteList();
        updateFormState(documentState);
      } catch (error) {
        const errorBox = document.querySelector('[data-error-box]');
        if (errorBox) {
          errorBox.textContent = error instanceof Error ? error.message : 'Ongeldige invoer.';
        }
      }
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      const form = document.querySelector('#document-form');
      if (form) form.reset();
      state.currentDocument = null;
      state.quotes = [];
      renderQuoteList();
      updateFormState(null);

      const errorBox = document.querySelector('[data-error-box]');
      if (errorBox) {
        errorBox.textContent = '';
      }
    });
  }
}

if (typeof document !== 'undefined') {
  attachEvents();
  renderQuoteList();
  updateFormState(null);
}

export {
  state,
  STATUS_VALUES,
  USER_DISCLAIMER,
  createDocument,
  createQuote,
  resetDocumentMetadata,
};
