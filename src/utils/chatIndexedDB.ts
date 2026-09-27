// High-performance asynchronous IndexedDB cache for WorkChat
// Non-blocking off-main-thread storage (replaces synchronous localStorage)

const DB_NAME = 'MYERP_WORKCHAT_STORAGE';
const DB_VERSION = 1;
const STORE_MESSAGES = 'messages_by_conv';
const STORE_CONVERSATIONS = 'conversations_list';
const STORE_METADATA = 'chat_meta';

class ChatIndexedDB {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private initDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve(null);
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: any) => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
            db.createObjectStore(STORE_MESSAGES);
          }
          if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
            db.createObjectStore(STORE_CONVERSATIONS);
          }
          if (!db.objectStoreNames.contains(STORE_METADATA)) {
            db.createObjectStore(STORE_METADATA);
          }
        };

        req.onsuccess = () => {
          resolve(req.result);
        };

        req.onerror = () => {
          console.warn('[ChatIndexedDB] Failed to open IndexedDB, falling back to memory');
          resolve(null);
        };
      } catch (err) {
        console.warn('[ChatIndexedDB] Exception opening IndexedDB', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  // Save all cached messages map asynchronously without blocking UI thread
  async saveAllMessages(messagesByConvId: Record<number, any[]>): Promise<void> {
    const db = await this.initDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_MESSAGES, 'readwrite');
        const store = tx.objectStore(STORE_MESSAGES);

        for (const [convIdStr, msgs] of Object.entries(messagesByConvId)) {
          const convId = Number(convIdStr);
          // Only store the latest 100 messages per conversation in IndexedDB to keep reads ultra-fast
          const slice = Array.isArray(msgs) && msgs.length > 100 ? msgs.slice(-100) : msgs;
          store.put(slice, convId);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Save messages for a single conversation
  async saveConversationMessages(convId: number, msgs: any[]): Promise<void> {
    const db = await this.initDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_MESSAGES, 'readwrite');
        const store = tx.objectStore(STORE_MESSAGES);
        const slice = Array.isArray(msgs) && msgs.length > 100 ? msgs.slice(-100) : msgs;
        store.put(slice, convId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Load all cached messages on app startup
  async loadAllMessages(): Promise<Record<number, any[]>> {
    const db = await this.initDB();
    if (!db) return {};

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_MESSAGES, 'readonly');
        const store = tx.objectStore(STORE_MESSAGES);
        const result: Record<number, any[]> = {};

        // In modern browsers, openKeyCursor / getAllKeys is super fast
        const req = store.openCursor();
        req.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            result[cursor.key as number] = cursor.value;
            cursor.continue();
          } else {
            resolve(result);
          }
        };
        req.onerror = () => resolve({});
      } catch {
        resolve({});
      }
    });
  }

  // Save conversations list
  async saveConversations(convList: any[]): Promise<void> {
    const db = await this.initDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite');
        const store = tx.objectStore(STORE_CONVERSATIONS);
        store.put(convList, 'primary_list');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Load conversations list
  async loadConversations(): Promise<any[] | null> {
    const db = await this.initDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_CONVERSATIONS, 'readonly');
        const store = tx.objectStore(STORE_CONVERSATIONS);
        const req = store.get('primary_list');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
}

export const chatDB = new ChatIndexedDB();
