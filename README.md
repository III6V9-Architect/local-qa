# local-qa
Minimal local Q&amp;A app implementing user-supplied document origin/status metadata with proof constraints.

Requires Node.js 20 or newer and Python 3.

## Run locally

```sh
npm ci
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/rio/local-qa.html.

Title and document content must contain non-whitespace text. Origin is optional;
blank origin becomes `ONBEKEND`. Status is `draft`, `historisch`, or
`specificatie`. Every quote carries the user-supplied, unverified disclaimer.
Saving updates the selected document; Nieuw / Reset starts a new document and clears
only the form, quote, and errors. Select a title to reopen it, or use the delete
button to remove the selected document. Documents persist in localStorage in this
browser for the same site address; nothing is sent to a server. They are not
synced or backed up, and clearing browser site data removes them.

Storage failures do not replace the current saved document or claim success.
Malformed/unsupported stored data is preserved and blocks writes until repaired.
If another tab changes storage, reload before saving to avoid overwriting it.
Reload discards unsaved form edits. Stored verification flags are never trusted;
loaded documents remain user-supplied and unverified.

## Tests

```sh
npm ci
npx playwright install chromium
npm test
npm run test:browser
```

On Linux, use `npx playwright install --with-deps chromium` when browser system
dependencies are missing. Playwright starts the Python server automatically.
GitHub Actions runs both suites using the committed dependency lockfile.


## Search and backups

Search matches title, document text, or origin without case sensitivity. Combine
it with a status filter. Filtering leaves the selected editor and quote intact.
Export always downloads all saved documents, regardless of the filter; unsaved
editor changes are excluded. The JSON file contains the full document text.

Import accepts version 1 JSON backups up to 5 MB. All records are validated before
saving. Identical IDs with identical normalized content are skipped; an ID with
different content rejects the entire import. Invalid records, duplicate IDs in a
file, unsupported versions, or storage failures leave saved documents unchanged.
Imported metadata always remains user-supplied and unverified. Export and import
run entirely in the browser. Keep the exported file to restore your collection
if browser site data is cleared.

## Questions with source passages

The question form searches all saved documents, independently of the collection
filters and unsaved editor text. It returns up to five literal paragraphs with
title, paragraph number, origin, status, and the unverified-user disclaimer.
Open a source to inspect or edit its full text. Saving, importing, or deleting
in this page refreshes existing question results.

This is local keyword retrieval, not a generated answer or semantic search.
Words match case-insensitively as whole Unicode tokens; common Dutch question
words are ignored. Negations are retained. Paragraphs rank by the number of
distinct matching query words, with collection order breaking ties. Results may
match only part of a question; matched words are displayed for inspection.
No query, document text, or result is sent to an external model or service.

## Editing and undo

The editor marks unsaved changes. Switching to another document, opening a
different source, resetting, or deleting with unsaved edits asks before discarding
them. Selecting the current document preserves its editor. Reload/leave uses the
browser's standard unsaved-changes warning where supported; save to retain edits.

The last successfully deleted document can be restored during the current page
session, until another successful deletion or reload. Undo restores the saved
version at its previous position and preserves the current editor, including
unsaved text. A same-ID conflict or failed storage write keeps undo available and
leaves the collection unchanged. Undo is not a persistent recycle bin.

## Open a text file

Use the file picker above the editor to open a local `.txt`, `.md`, or `.markdown`
file (UTF-8, up to 1 MB). The filename supplies the title and user-declared origin;
status starts as `draft`. The file is read only in the browser. Markdown is kept
as literal text, including any HTML, and never rendered as executable markup.

Opening creates an unsaved new editor document, even when an existing document
was selected. Review it and press Document opslaan to add it to the collection.
Unsaved edits require discard confirmation. Invalid UTF-8, binary control
characters, blank content, unsupported extensions, oversized files, and read
failures leave the current editor and saved collection unchanged. PDF and Word
extraction are not supported. Reopening a file and saving creates another document.

## Copy and download citations

Each question result has a copy button that includes the literal passage, source
title, document ID, paragraph number, origin, status, and unverified-user
disclaimer. If clipboard access is unavailable, the app selects the same text
in a read-only field for manual copying.

Download vraag en passages exports the submitted question and all currently
shown results as UTF-8 plain text. It describes the output as keyword retrieval,
not an independently verified answer. Editing the question clears the results
and disables export until a new search finds passages. Saving, importing,
deleting, or undoing deletion refreshes the downloadable results. Exports use
saved content; unsaved editor changes are excluded.
