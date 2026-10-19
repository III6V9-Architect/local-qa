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

