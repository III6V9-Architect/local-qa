import { USER_DISCLAIMER } from './local-qa.mjs';

export function formatCitation(passage) {
  return [
    `Document: ${passage.title}`,
    `Document-ID: ${passage.documentId}`,
    `Alinea: ${passage.paragraphNumber}`,
    `Herkomst: ${passage.source.origin}`,
    `Status: ${passage.source.status}`,
    USER_DISCLAIMER,
    '',
    'Citaat:',
    passage.quote,
  ].join('\n');
}

export function formatPassageReport(question, passages) {
  if (!question.trim() || !passages.length) throw new Error('Zoek eerst passages bij een vraag.');
  return [
    'Local Q&A — bronnen bij je vraag',
    `Vraag: ${question.trim()}`,
    'Dit zijn zoekwoordresultaten uit opgeslagen documenten, geen zelfstandig antwoord of verificatie.',
    `Aantal passages: ${passages.length}`,
    '',
    ...passages.map((passage, index) => `Passage ${index + 1}\n${formatCitation(passage)}`),
  ].join('\n\n');
}
