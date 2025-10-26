// IndexedDB utilities for offline storage

export interface PendingInspection {
  id: string;
  deviceId: string;
  deviceName: string;
  inspectionData: Record<string, unknown>;
  photos: Blob[];
  timestamp: Date;
  synced: boolean;
}

class OfflineDB {
  private dbName = 'AEDCheckDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('pending_inspections')) {
          const inspectionStore = db.createObjectStore('pending_inspections', { 
            keyPath: 'id',
            autoIncrement: false 
          });
          inspectionStore.createIndex('synced', 'synced', { unique: false });
          inspectionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('cached_devices')) {
          const deviceStore = db.createObjectStore('cached_devices', { 
            keyPath: 'id' 
          });
          deviceStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        if (!db.objectStoreNames.contains('user_settings')) {
          db.createObjectStore('user_settings', { keyPath: 'key' });
        }
      };
    });
  }

  async savePendingInspection(inspection: PendingInspection): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending_inspections'], 'readwrite');
      const store = transaction.objectStore('pending_inspections');
      const request = store.put(inspection);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingInspections(): Promise<PendingInspection[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending_inspections'], 'readonly');
      const store = transaction.objectStore('pending_inspections');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePendingInspection(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['pending_inspections'], 'readwrite');
      const store = transaction.objectStore('pending_inspections');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cacheDevices(devices: Array<Record<string, unknown>>): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached_devices'], 'readwrite');
      const store = transaction.objectStore('cached_devices');
      
      // Clear existing cache
      store.clear();

      // Add new devices with timestamp
      devices.forEach(device => {
        store.put({
          ...device,
          lastUpdated: new Date()
        });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCachedDevices(): Promise<Array<Record<string, unknown>>> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cached_devices'], 'readonly');
      const store = transaction.objectStore('cached_devices');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveUserSetting(key: string, value: unknown): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['user_settings'], 'readwrite');
      const store = transaction.objectStore('user_settings');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserSetting(key: string): Promise<unknown> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['user_settings'], 'readonly');
      const store = transaction.objectStore('user_settings');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async syncPendingInspections(): Promise<number> {
    const pending = await this.getPendingInspections();
    let syncedCount = 0;

    for (const inspection of pending.filter(i => !i.synced)) {
      try {
        const response = await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inspection)
        });

        if (response.ok) {
          inspection.synced = true;
          await this.savePendingInspection(inspection);
          syncedCount++;
        }
      } catch (error) {
        console.error('Failed to sync inspection:', inspection.id, error);
      }
    }

    return syncedCount;
  }
}

export const offlineDB = new OfflineDB();