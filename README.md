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
Saving replaces the current quote. Reset clears the form, quote, and errors.
Documents live only in memory and disappear on reload.

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

