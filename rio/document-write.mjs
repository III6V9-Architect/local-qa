import { STORAGE_KEY } from './document-store.mjs';

export const WRITE_LOCK = `${STORAGE_KEY}.write`;

export async function writeDocuments(store, documents, locks) {
  if (!locks?.request) {
    throw new Error('Veilig opslaan vereist Web Locks. Open de app via localhost of HTTPS in een browser die dit ondersteunt.');
  }
  return locks.request(WRITE_LOCK, { mode: 'exclusive', ifAvailable: true }, (lock) => {
    if (!lock) throw new Error('Een ander tabblad slaat nu op. Probeer het opnieuw.');
    // The snapshot check and write must share the same cross-tab lock.
    store.save(documents);
  });
}
