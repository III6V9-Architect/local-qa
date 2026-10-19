import { createQuote, STATUS_VALUES } from './local-qa.mjs';

// Only remove common question/function words; keep negations such as niet/geen.
const STOP_WORDS = new Set('de het een en of van voor op in aan bij met om te is zijn was waren wordt worden wat wie waar wanneer hoe welke welk er over dit dat die deze als ik je mijn'.split(' '));
const normalizeWord = (word) => word.normalize('NFC').toLocaleLowerCase('nl');
const wordPattern = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu;
const tokens = (text) => (text.match(wordPattern) ?? []).map(normalizeWord);

export function searchPassages(documents, question, { status = '', match = 'any' } = {}) {
  if (status && !STATUS_VALUES.includes(status)) throw new Error('Ongeldig statusfilter.');
  if (!['any', 'all'].includes(match)) throw new Error('Ongeldige zoekmodus.');
  const terms = [...new Set(tokens(question).filter((word) => !STOP_WORDS.has(word)))];
  if (!terms.length) throw new Error('Vul een vraag met minstens één zoekwoord in.');
  const results = [];
  for (const doc of documents) {
    if (status && doc.source.status !== status) continue;
    const paragraphs = doc.content.split(/\r?\n\s*\r?\n/u);
    for (let index = 0; index < paragraphs.length; index++) {
      const paragraph = paragraphs[index].trim();
      const words = new Set(tokens(paragraph));
      const matchedTerms = terms.filter((term) => words.has(term));
      if (!matchedTerms.length || (match === 'all' && matchedTerms.length !== terms.length)) continue;
      results.push({
        ...createQuote(doc, paragraph),
        title: doc.title,
        paragraphNumber: index + 1,
        matchedTerms,
        queryTerms: terms,
      });
    }
  }
  // Stable ties follow collection and paragraph order, rather than inventing confidence.
  return results.sort((a, b) => b.matchedTerms.length - a.matchedTerms.length).slice(0, 5);
}

// Keep original text and offsets; normalization is used only to compare words.
export function highlightParts(text, terms) {
  const wanted = new Set(terms.map(normalizeWord));
  const parts = [];
  let cursor = 0;
  for (const word of text.matchAll(wordPattern)) {
    if (!wanted.has(normalizeWord(word[0]))) continue;
    if (word.index > cursor) parts.push({ text: text.slice(cursor, word.index), matched: false });
    parts.push({ text: word[0], matched: true });
    cursor = word.index + word[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), matched: false });
  return parts;
}
