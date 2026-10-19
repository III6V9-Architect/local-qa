import { createQuote } from './local-qa.mjs';

// Only remove common question/function words; keep negations such as niet/geen.
const STOP_WORDS = new Set('de het een en of van voor op in aan bij met om te is zijn was waren wordt worden wat wie waar wanneer hoe welke welk er over dit dat die deze als ik je mijn'.split(' '));
const tokens = (text) => text.normalize('NFC').toLocaleLowerCase('nl').match(/[\p{L}\p{N}]+/gu) ?? [];

export function searchPassages(documents, question) {
  const terms = [...new Set(tokens(question).filter((word) => !STOP_WORDS.has(word)))];
  if (!terms.length) throw new Error('Vul een vraag met minstens één zoekwoord in.');
  const results = [];
  for (const doc of documents) {
    const paragraphs = doc.content.split(/\r?\n\s*\r?\n/u);
    for (let index = 0; index < paragraphs.length; index++) {
      const paragraph = paragraphs[index].trim();
      const words = new Set(tokens(paragraph));
      const matchedTerms = terms.filter((term) => words.has(term));
      if (!matchedTerms.length) continue;
      results.push({
        ...createQuote(doc, paragraph),
        title: doc.title,
        paragraphNumber: index + 1,
        matchedTerms,
      });
    }
  }
  // Stable ties follow collection and paragraph order, rather than inventing confidence.
  return results.sort((a, b) => b.matchedTerms.length - a.matchedTerms.length).slice(0, 5);
}
