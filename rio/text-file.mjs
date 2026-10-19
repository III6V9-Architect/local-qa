import { createDocument } from './local-qa.mjs';

export const MAX_TEXT_FILE_BYTES = 1024 * 1024;

export function validateTextFile(name, size) {
  if (!/\.(txt|md|markdown)$/i.test(name)) {
    throw new Error('Kies een .txt-, .md- of .markdown-bestand. PDF en Word worden niet ondersteund.');
  }
  if (size > MAX_TEXT_FILE_BYTES) throw new Error('Het tekstbestand is te groot. Maximaal 1 MB.');
}

export function parseTextFile(name, bytes) {
  validateTextFile(name, bytes.byteLength);
  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Dit bestand is geen geldige UTF-8-tekst. Sla het opnieuw op als UTF-8.');
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(content)) {
    throw new Error('Dit bestand bevat binaire gegevens of niet-ondersteunde controletekens.');
  }
  return createDocument({
    title: name.replace(/\.(txt|md|markdown)$/i, '').trim() || name,
    content,
    origin: name,
    status: 'draft',
  });
}
