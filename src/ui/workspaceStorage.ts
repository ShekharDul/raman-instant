type StoredWorkspace<T> = { revision: number; workspace: T | null };
const key = 'workspace-v1';

export class WorkspaceStorage<T> {
  private revision = 0;
  private database: Promise<IDBDatabase>;

  constructor() {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open('instant-raman', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspaces');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Workspace database is busy in another tab.'));
    });
  }

  async load(): Promise<T | null> {
    const db = await this.database;
    return new Promise((resolve, reject) => {
      const request = db.transaction('workspaces').objectStore('workspaces').get(key);
      request.onsuccess = () => {
        const saved: StoredWorkspace<T> | undefined = request.result;
        this.revision = saved?.revision ?? 0;
        resolve(saved?.workspace ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async save(workspace: T | null): Promise<void> {
    const db = await this.database;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('workspaces', 'readwrite');
      const store = transaction.objectStore('workspaces');
      const request = store.get(key);
      const revision = this.revision + 1;
      request.onsuccess = () => {
        const current: StoredWorkspace<T> | undefined = request.result;
        // Another tab may have changed the workspace since this tab opened.
        if ((current?.revision ?? 0) !== this.revision) {
          reject(new Error('Workspace changed in another tab. Reload to restore it.'));
          transaction.abort();
          return;
        }
        try {
          store.put({ revision, workspace } satisfies StoredWorkspace<T>, key);
        } catch (error) {
          reject(error);
          transaction.abort();
        }
      };
      transaction.oncomplete = () => {
        this.revision = revision;
        resolve();
      };
      transaction.onabort = () => reject(transaction.error ?? new Error('Workspace save was interrupted.'));
    });
  }
}
