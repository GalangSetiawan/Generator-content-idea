import { Injectable, signal, computed } from '@angular/core';

export const TEXT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' }
];

export const IMAGE_MODELS = [
  { id: 'imagen-3.0-generate-002', name: 'Imagen 3.0', disabled: false },
  { id: 'imagen-4.0-generate-001', name: 'Imagen 4.0', disabled: false }
];

const TEXT_MODEL_STORAGE_KEY = 'contentGenTextModel';
const IMAGE_MODEL_STORAGE_KEY = 'contentGenImageModel';

@Injectable({
  providedIn: 'root',
})
export class ModelSettingsService {
  textModel = signal<string>(TEXT_MODELS[0].id);
  imageModel = signal<string>(IMAGE_MODELS[0].id);

  textModels = TEXT_MODELS;
  imageModels = IMAGE_MODELS;

  textModelName = computed(() => {
    const modelId = this.textModel();
    return this.textModels.find(m => m.id === modelId)?.name ?? modelId;
  });

  constructor() {
    this.loadSettingsFromStorage();
  }

  private loadSettingsFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const storedTextModel = localStorage.getItem(TEXT_MODEL_STORAGE_KEY);
      if (storedTextModel && this.textModels.some(m => m.id === storedTextModel)) {
        this.textModel.set(storedTextModel);
      }

      const storedImageModel = localStorage.getItem(IMAGE_MODEL_STORAGE_KEY);
      if (storedImageModel && this.imageModels.some(m => m.id === storedImageModel && !m.disabled)) {
        this.imageModel.set(storedImageModel);
      }
    }
  }

  setTextModel(modelId: string): void {
    if (this.textModels.some(m => m.id === modelId)) {
      this.textModel.set(modelId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TEXT_MODEL_STORAGE_KEY, modelId);
      }
    }
  }

  setImageModel(modelId: string): void {
    if (this.imageModels.some(m => m.id === modelId && !m.disabled)) {
      this.imageModel.set(modelId);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, modelId);
      }
    }
  }
}
