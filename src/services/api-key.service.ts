import { Injectable, signal } from '@angular/core';

const API_KEY_STORAGE_KEY = 'contentGenApiKey';

@Injectable({
  providedIn: 'root',
})
export class ApiKeyService {
  apiKey = signal<string | null>(null);

  constructor() {
    this.loadApiKeyFromStorage();
  }

  private loadApiKeyFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
        const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
        if (storedKey) {
            this.apiKey.set(storedKey);
        }
    }
  }

  setApiKey(key: string): void {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      this.apiKey.set(trimmedKey);
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmedKey);
    } else {
      this.clearApiKey();
    }
  }

  clearApiKey(): void {
    this.apiKey.set(null);
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
}
