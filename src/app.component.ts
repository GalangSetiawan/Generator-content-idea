import { Component, ChangeDetectionStrategy, signal, computed, inject, HostListener, effect, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';
import { ChipInputComponent } from './components/chip-input/chip-input.component';
import { AutoresizeTextareaDirective } from './directives/autoresize-textarea.directive';
import { ContentIdea, ImagePrompt, HistoryItem } from './models/content-idea.model';
import { ApiKeyService } from './services/api-key.service';

interface PromptTemplate {
  name: string;
  template: string;
}

interface LightboxState {
  ideaId: string;
  promptIndex: number;
}

// Helper function to determine the initial theme
function getInitialTheme(): 'light' | 'dark' {
  const storedTheme = localStorage.getItem('contentGenTheme') as 'light' | 'dark';
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }
  // Match the logic in index.html: default to light unless system prefers dark
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChipInputComponent, AutoresizeTextareaDirective],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  apiKeyService = inject(ApiKeyService);
  geminiService = inject(GeminiService);

  // --- UI State ---
  topic = signal<string>('Buat pembahasan tentang fakta menarik, misterius, atau sedikit ngeri seputar dunia hewan — bisa tentang hewan spesifik, perilaku, atau konsep biologis seperti predator, simbiosis, evolusi, dll.');
  customColumns = signal<string[]>(['Hewan', 'fakta']);
  
  loadingIdeas = signal(false);
  loadingMoreIdeas = signal(false);
  expandedIdeaId = signal<string | null>(null);
  
  copiedColumn = signal<string | null>(null);
  copiedTemplate = signal<string | null>(null);
  isHistoryDropdownOpen = signal(false);
  historyDropdown = viewChild<ElementRef>('historyDropdown');
  viewMode = signal<'normal' | 'compact'>('normal');
  theme = signal<'light' | 'dark'>(getInitialTheme());
  copiedCompactView = signal(false);
  copiedAllPrompts = signal<string | null>(null);
  copiedNarration = signal<string|null>(null);

  // --- History State ---
  history = signal<HistoryItem[]>([]);
  activeHistoryId = signal<string | null>(null);
  clearedHistoryIds = signal<Set<string>>(new Set());

  activeHistoryItem = computed(() => {
    const activeId = this.activeHistoryId();
    if (!activeId) return null;
    return this.history().find(h => h.id === activeId) ?? null;
  });

  currentIdeas = computed(() => {
    const activeItem = this.activeHistoryItem();
    if (!activeItem) return [];
    // If the active history ID is in the "cleared" set, return an empty array
    if (this.clearedHistoryIds().has(activeItem.id)) {
      return [];
    }
    return activeItem.ideas ?? [];
  });
  
  // --- Template Management State ---
  newDefaultPrompt = `🎬 Tujuan:
Buat narasi video tentang fakta menarik, misterius, atau sedikit ngeri seputar dunia hewan — bisa tentang hewan spesifik, perilaku, atau konsep biologis seperti predator, simbiosis, evolusi, dll.

🧠 Gaya & Emosi:
Gaya narasi: penasaran, misterius, dan sedikit ngeri.
Bahasa santai seperti narator konten viral.
hindari pemakaian lo-gue gunakan aku-kamu 
ubah penggunaan kata "aku" menjadi "mimin"
Penonton harus merasa “wah keren tapi agak merinding."

🧩 Struktur Saran:
Gunakan struktur berikut agar hasilnya mengalir dan tidak terasa terpisah:

---

🎙️ [HOOK] (0–5 detik)
Kalimat 1 → Pancing rasa penasaran atau heran.  
Contoh: “Ternyata [Hewan] bisa [hal mengejutkan].”  
Kalimat 2 → Tambahkan ekspresi ringan biar terasa alami.  
Contoh: “Gue juga awalnya nggak percaya, tapi ternyata ini nyata.”

---

🎙️ [FAKTA UTAMA] (5–25 detik)
Kalimat 1 → Perkenalkan perilaku utama hewan dengan kalimat aktif.  
Contoh: “[Hewan] punya kebiasaan unik, mereka sering [perilaku utama].”  
Kalimat 2 → Jelaskan apa yang mereka lakukan dan kapan hal itu terjadi.  
Contoh: “Biasanya ini terjadi waktu [situasi tertentu].”  
Kalimat 3 → Tambahkan contoh nyata atau eksperimen.  
Contoh: “Misalnya, dalam sebuah penelitian, [Hewan] bisa [aksi spesifik].”  
Kalimat 4 → Jelaskan fungsi langsung dari perilaku itu.  
Contoh: “Tujuannya buat [bertahan hidup / menarik pasangan / melindungi kelompok].”  
Kalimat 5 → Gunakan kalimat transisi halus ke topik berbeda tapi masih nyambung.  
🔹 Pola transisi yang bisa dipakai:
- “Tapi yang lebih menarik, ternyata bukan cuma itu.”  
- “Uniknya, di balik kebiasaan ini, ada hal lain yang jarang diketahui.”  
- “Dan ini baru sebagian kecil dari kehebatan mereka.”  
- “Nah, yang bikin makin keren lagi adalah...”  

---

🎙️ [DETAIL TAMBAHAN / PENJELASAN ILMIAH] (25–45 detik)
Kalimat 1 → Gunakan transisi pembuka dari kalimat sebelumnya.  
Contoh: “Karena selain itu, [Hewan] juga punya kemampuan lain yang luar biasa.”  
Kalimat 2 → Jelaskan fakta atau perilaku tambahan yang berbeda, tapi masih relevan.  
Contoh: “Mereka bisa [kemampuan tambahan], dan itu bantu mereka [fungsi biologis].”  
Kalimat 3 → Jelaskan penyebab biologisnya.  
Contoh: “Hal ini terjadi karena mereka punya [bagian tubuh / sistem unik].”  
Kalimat 4 → Tambahkan data ilmiah atau riset singkat.  
Contoh: “Penelitian dari [nama institusi] nunjukin kalau hal ini bantu mereka bertahan di [lingkungan / kondisi ekstrem].”  
Kalimat 5 → Tutup bagian ini dengan kalimat reflektif ringan.  
Contoh: “Jadi makin kelihatan ya, kalau mereka bukan hewan biasa.”

---

🎙️ [EDUKASI / PESAN NILAI] (45–55 detik)
Kalimat 1 → Ambil pelajaran singkat dari keseluruhan perilaku hewan.  
Contoh: “Dari [Hewan] kita belajar kalau adaptasi itu kunci buat bertahan.”  
Kalimat 2 (opsional) → Tambahkan penguat pendek.  
Contoh: “Kadang yang bikin kuat bukan otot, tapi cara menyesuaikan diri.”

---

🎙️ [CLOSING] (55–60 detik)
Kalimat 1 → Tutup dengan nada reflektif atau kekaguman.  
Contoh: “Alam selalu punya cara elegan buat nunjukin kecerdasannya.”

🧾 Instruksi Tambahan:
- Hindari istilah ilmiah berat.
- Tidak perlu CTA promosi (“subscribe”, dll).
- Format hasil: dijadikan narasi utuh, hindari karakter karakter berlebihan yang membuat hasil text to sound menjadi aneh.
- panjang narasi WAJIB maksimal 200 kata


Topic : membahas {{Hewan}} tentang {{Idea}}
dengan fakta {{fakta}}

💬 Keluaran yang diharapkan:
buat menjadi beberapa paragraf sesuai dengan struktur penulisan [WAJIB]`;

  newTraditionTemplate = `🎬 Tujuan:
Buat narasi YouTube Shorts  tentang kebiasaan, tradisi, atau hal unik yang dilakukan di suatu tempat di dunia.

🧠 Gaya & Emosi:
Gaya narasi: penasaran, misterius, dan sedikit ngeri.
Bahasa santai seperti narator konten viral.

🎯 Tujuan:
Menimbulkan rasa kagum, penasaran, dan “wow” melalui gaya bercerita eksploratif, bukan penjelasan ilmiah.

💬 Gaya:
Natural, misterius, dan seolah narator sedang menceritakan fakta mengejutkan.

Gunakan struktur berikut:
1. Hook Penasaran (3 detik pertama) — tunjukkan hal paling aneh atau paradoksal dari tradisi itu.
2. Fakta Utama / Latar — jelaskan singkat apa, di mana, dan mengapa tradisi itu dilakukan.
3. Detail Unik / Twist — tambahkan fakta menarik atau makna simbolik di baliknya.
4. Penutup Reflektif — simpulkan makna atau ironi tradisi itu tanpa CTA.

Gunakan bahasa yang mudah diucapkan sebagai voice-over.
Pastikan tiap kalimat mengalir alami, tidak terkesan dibaca dari naskah.

- Tidak perlu CTA promosi (“subscribe”, dll).
- Format hasil: dijadikan narasi utuh, hindari karakter karakter berlebihan yang membuat hasil text to sound menjadi aneh.
- panjang narasi WAJIB maksimal 200 kata


Topic : membahas {{Idea}}
hal yang di bahas : {{fakta}}

💬 Keluaran yang diharapkan:
buat menjadi beberapa paragraf sesuai dengan struktur penulisan [WAJIB]`;

  savedPromptTemplates = signal<PromptTemplate[]>([
    { name: 'Narasi Fakta Hewan (Detail)', template: this.newDefaultPrompt },
    { name: 'Fakta unik kebiasaan / tradisi', template: this.newTraditionTemplate }
  ]);
  isTemplatesModalOpen = signal(false);
  activeIdeaForModal = signal<ContentIdea | null>(null);
  isSavingTemplateForIdeaId = signal<string | null>(null);
  newTemplateName = signal('');
  recentlyDeletedTemplate = signal<{ template: PromptTemplate, index: number } | null>(null);
  editingTemplateIndex = signal<number | null>(null);
  editingTemplateName = signal('');
  editingTemplateContent = signal('');
  
  // --- User-Requested Features State ---
  initialGenerationCount = signal(10);
  moreGenerationCount = signal(10);
  scrollToTopClickCount = signal(0);
  isResetConfirmModalOpen = signal(false);
  isImportConfirmModalOpen = signal(false);
  fileToImport = signal<File | null>(null);
  importFileInput = viewChild<ElementRef<HTMLInputElement>>('importFileInput');
  lightboxState = signal<LightboxState | null>(null);
  copiedLightboxPrompt = signal<'image' | 'video' | null>(null);
  isGeneratingAllImages = signal<string | null>(null);
  isDownloadingAllImages = signal<string | null>(null);
  isBatchGenerateModalOpen = signal(false);
  selectedIdeasForBatch = signal<Set<string>>(new Set());

  // --- API Key Management State ---
  isApiKeyModalOpen = signal(false);
  apiKeyInput = signal('');
  hasApiKey = computed(() => !!this.apiKeyService.apiKey());
  apiKeyValidation = signal<{ status: 'idle' | 'validating' | 'invalid' | 'valid', message: string }>({ status: 'idle', message: '' });
  isAboutModalOpen = signal(false);

  // --- UI/UX Improvements State ---
  isScrolled = signal(false);
  narrationPromptVisibility = signal<{[key: string]: boolean}>({});

  tableColumns = computed(() => ['Idea', ...(this.activeHistoryItem()?.customColumns ?? this.customColumns())]);

  excelColumns = computed(() => {
    const count = this.tableColumns().length;
    const columns: string[] = [];
    for (let i = 0; i < count; i++) {
      let temp = i;
      let letter = '';
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      columns.push(letter);
    }
    return columns;
  });

  lightboxImageUrl = computed(() => {
    const state = this.lightboxState();
    if (!state) return null;

    const idea = this.currentIdeas().find(i => i.id === state.ideaId);
    return idea?.imagePrompts?.[state.promptIndex]?.imageUrl ?? null;
  });

  lightboxImagePromptObject = computed(() => {
    const state = this.lightboxState();
    if (!state) return null;

    const idea = this.currentIdeas().find(i => i.id === state.ideaId);
    return idea?.imagePrompts?.[state.promptIndex] ?? null;
  });

  hasNextImage = computed(() => {
    const state = this.lightboxState();
    if (!state) return false;
    const idea = this.currentIdeas().find(i => i.id === state.ideaId);
    if (!idea?.imagePrompts) return false;
    
    for (let i = state.promptIndex + 1; i < idea.imagePrompts.length; i++) {
        if (idea.imagePrompts[i].imageUrl) return true;
    }
    return false;
  });

  hasPrevImage = computed(() => {
      const state = this.lightboxState();
      if (!state) return false;
      const idea = this.currentIdeas().find(i => i.id === state.ideaId);
      if (!idea?.imagePrompts) return false;

      for (let i = state.promptIndex - 1; i >= 0; i--) {
          if (idea.imagePrompts[i].imageUrl) return true;
      }
      return false;
  });

  isAnyIdeaSelectedForBatch = computed(() => this.selectedIdeasForBatch().size > 0);
  isAllIdeasSelectedForBatch = computed(() => {
    const ideas = this.currentIdeas();
    return ideas.length > 0 && this.selectedIdeasForBatch().size === ideas.length;
  });
  
  apiError = this.geminiService.error;

  constructor() {
    this.loadStateFromStorage();
    
    // Auto-save state whenever they change
    effect(() => {
        this.saveStateToStorage();
    });

    // Effect for theme management
    effect(() => {
      const currentTheme = this.theme();
      if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('contentGenTheme', currentTheme);
    });

    // When active history item changes, update the UI inputs
    effect(() => {
        const activeItem = this.activeHistoryItem();
        if (activeItem) {
            this.topic.set(activeItem.topic);
            this.customColumns.set(activeItem.customColumns);
        }
    });

    // Effect to manage API key modal
    effect(() => {
      if (!this.hasApiKey()) {
          this.isApiKeyModalOpen.set(true);
      } else {
          this.isApiKeyModalOpen.set(false);
      }
    });
  }
  
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isHistoryDropdownOpen() && !this.historyDropdown()?.nativeElement.contains(event.target)) {
      this.isHistoryDropdownOpen.set(false);
    }
  }

  onMainScroll(event: Event): void {
    const mainContent = event.target as HTMLElement;
    if (mainContent) {
        this.isScrolled.set(mainContent.scrollTop > 100);
        if (mainContent.scrollTop === 0) {
            this.scrollToTopClickCount.set(0);
        }
    }
  }

  // --- API Key Management ---
  async saveApiKey(): Promise<void> {
    const keyToValidate = this.apiKeyInput().trim();
    if (!keyToValidate) {
      this.apiKeyValidation.set({ status: 'invalid', message: 'API Key cannot be empty.' });
      return;
    }

    this.apiKeyValidation.set({ status: 'validating', message: '' });

    const result = await this.geminiService.validateApiKey(keyToValidate);

    if (result.isValid) {
      this.apiKeyService.setApiKey(keyToValidate);
      this.apiKeyInput.set(''); // Clear input after saving
      this.apiKeyValidation.set({ status: 'valid', message: 'API Key validated and saved successfully!' });
      // Close modal after a short delay to show success message
      setTimeout(() => {
        this.closeApiKeyModal();
      }, 1500);
    } else {
      let errorMessage = result.error || 'An unknown validation error occurred.';
      if (this.hasApiKey()) {
        errorMessage += " The new key was NOT saved. The application is still using your previously saved valid key.";
      }
      this.apiKeyValidation.set({ status: 'invalid', message: errorMessage });
    }
  }

  clearApiKey(): void {
    this.apiKeyService.clearApiKey();
  }
  
  openApiKeyModal(): void {
    this.apiKeyInput.set(this.apiKeyService.apiKey() ?? '');
    this.apiKeyValidation.set({ status: 'idle', message: '' }); // Reset on open
    this.isApiKeyModalOpen.set(true);
  }

  closeApiKeyModal(): void {
    this.isApiKeyModalOpen.set(false);
  }

  // --- About Modal ---
  openAboutModal(): void {
    this.isAboutModalOpen.set(true);
  }

  closeAboutModal(): void {
    this.isAboutModalOpen.set(false);
  }

  // --- State Persistence ---
  private loadStateFromStorage(): void {
    const storedHistory = localStorage.getItem('contentGenHistory');
    if (storedHistory) {
        try {
            const parsedHistory: HistoryItem[] = JSON.parse(storedHistory);
            this.history.set(parsedHistory);
            if (parsedHistory.length > 0) {
                this.activeHistoryId.set(parsedHistory[0].id);
            }
        } catch (e) {
            console.error('Failed to parse history from localStorage', e);
        }
    }
    const storedTemplates = localStorage.getItem('contentGenTemplates');
    if (storedTemplates) {
      try {
        const parsedTemplates = JSON.parse(storedTemplates);
        // Ensure the default template is always present if no templates are stored
        if (Array.isArray(parsedTemplates) && parsedTemplates.length > 0) {
          this.savedPromptTemplates.set(parsedTemplates);
        }
      } catch (e) {
        console.error('Failed to parse templates from localStorage', e);
      }
    }
    const storedViewMode = localStorage.getItem('contentGenViewMode') as 'normal' | 'compact';
    if (storedViewMode && (storedViewMode === 'normal' || storedViewMode === 'compact')) {
        this.viewMode.set(storedViewMode);
    }
  }

  private saveStateToStorage(): void {
    try {
      // Create a deep copy of history and strip out large image data before saving
      const historyToSave = this.history().map(historyItem => ({
        ...historyItem,
        ideas: historyItem.ideas.map(idea => {
          // If there are no image prompts, just return the idea as is.
          if (!idea.imagePrompts) {
            return idea;
          }
          return {
            ...idea,
            imagePrompts: idea.imagePrompts.map(prompt => {
              // Create a copy of the prompt object without the imageUrl
              const { imageUrl, ...promptToSave } = prompt;
              return promptToSave;
            })
          };
        })
      }));

      localStorage.setItem('contentGenHistory', JSON.stringify(historyToSave));
      localStorage.setItem('contentGenTemplates', JSON.stringify(this.savedPromptTemplates()));
      localStorage.setItem('contentGenViewMode', this.viewMode());

    } catch (e) {
        console.error("Failed to save state to localStorage, it might be full:", e);
        this.apiError.set("Could not save your session. Your browser's local storage might be full. Export your data to save it.");
    }
  }

  private mapGeneratedDataToContentIdeas(data: any[]): ContentIdea[] {
    return data.map(item => ({
      ...item,
      id: self.crypto.randomUUID(),
      narrationLoading: false,
      narrationPrompt: this.newDefaultPrompt
    }));
  }

  // --- History Management ---
  toggleHistoryDropdown(): void {
    this.isHistoryDropdownOpen.update(v => !v);
  }

  setActiveHistory(id: string): void {
    if (this.activeHistoryId() === id) {
      this.isHistoryDropdownOpen.set(false);
      return;
    };
    this.activeHistoryId.set(id);

    // When activating a history, ensure it's not marked as cleared
    this.clearedHistoryIds.update(cleared => {
      if (cleared.has(id)) {
        const newSet = new Set(cleared);
        newSet.delete(id);
        return newSet;
      }
      return cleared;
    });

    this.expandedIdeaId.set(null);
    this.isHistoryDropdownOpen.set(false);
  }

  deleteHistoryItem(idToDelete: string): void {
    this.history.update(currentHistory => {
        const newHistory = currentHistory.filter(h => h.id !== idToDelete);
        if (this.activeHistoryId() === idToDelete) {
            this.activeHistoryId.set(newHistory.length > 0 ? newHistory[0].id : null);
        }
        return newHistory;
    });
  }
  
  formatTimestampForHistory(timestamp: number): string {
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  trackByHistoryItem(index: number, item: HistoryItem) {
    return item.id;
  }
  
  // --- Core Generation Logic ---
  async generateIdeas(): Promise<void> {
    if (!this.topic().trim() || this.loadingIdeas()) return;
    
    this.loadingIdeas.set(true);
    this.expandedIdeaId.set(null);

    const columnsForGeneration = ['Idea', ...this.customColumns()];
    const generatedData = await this.geminiService.generateContentIdeas(this.topic(), columnsForGeneration, this.initialGenerationCount());
    const newIdeas = this.mapGeneratedDataToContentIdeas(generatedData);
    
    const newHistoryItem: HistoryItem = {
      id: self.crypto.randomUUID(),
      timestamp: Date.now(),
      topic: this.topic(),
      customColumns: this.customColumns(),
      ideas: newIdeas
    };

    this.history.update(current => [newHistoryItem, ...current]);
    this.activeHistoryId.set(newHistoryItem.id);
    this.loadingIdeas.set(false);
  }

  async generateMoreIdeas(): Promise<void> {
    const activeId = this.activeHistoryId();
    const activeItem = this.activeHistoryItem();
    if (!activeId || !activeItem || this.loadingMoreIdeas()) return;
    
    this.loadingMoreIdeas.set(true);
    const columnsForGeneration = ['Idea', ...activeItem.customColumns];
    const generatedData = await this.geminiService.generateContentIdeas(activeItem.topic, columnsForGeneration, this.moreGenerationCount());
    const newIdeas = this.mapGeneratedDataToContentIdeas(generatedData);
    
    this.history.update(currentHistory => 
        currentHistory.map(h => 
            h.id === activeId ? { ...h, ideas: [...h.ideas, ...newIdeas] } : h
        )
    );
    this.loadingMoreIdeas.set(false);
  }

  private updateIdea(ideaId: string, updater: (idea: ContentIdea) => ContentIdea): void {
    const activeId = this.activeHistoryId();
    if (!activeId) return;

    this.history.update(currentHistory =>
        currentHistory.map(h => {
            if (h.id === activeId) {
                return {
                    ...h,
                    ideas: h.ideas.map(idea => (idea.id === ideaId ? updater(idea) : idea)),
                };
            }
            return h;
        })
    );
  }

  toggleExpand(ideaId: string): void {
    const isCurrentlyExpanded = this.expandedIdeaId() === ideaId;
    this.expandedIdeaId.update(current => (current === ideaId ? null : ideaId));

    if (!isCurrentlyExpanded) {
      const idea = this.currentIdeas().find(i => i.id === ideaId);
      const isVisible = !(idea && idea.narration);
      this.narrationPromptVisibility.update(vis => ({ ...vis, [ideaId]: isVisible }));
    }
  }

  private processPrompt(idea: ContentIdea, template: string): string {
    let processedPrompt = template;
    const variables = template.match(/{{\s*([\w\d]+)\s*}}/g) || [];
    variables.forEach(variable => {
      const columnName = variable.replace(/{{\s*|\s*}}/g, '');
      const value = idea[columnName] || `[${columnName}]`;
      processedPrompt = processedPrompt.replace(new RegExp(variable, 'g'), value);
    });
    return processedPrompt;
  }
  
  async generateNarration(idea: ContentIdea): Promise<void> {
    if (!idea.narrationPrompt.trim()) return;

    this.updateIdea(idea.id, i => ({ ...i, narrationLoading: true, narration: '', imagePrompts: [] }));
    this.narrationPromptVisibility.update(vis => ({...vis, [idea.id]: false}));

    const processedPrompt = this.processPrompt(idea, idea.narrationPrompt);
    const result = await this.geminiService.generateNarrationAndPrompts(idea, processedPrompt);

    this.updateIdea(idea.id, i => {
      if (result && result.imagePrompts) {
        const imagePromptsWithGenerated = result.imagePrompts.map(p => ({ ...p, generated: false, videoPromptLoading: false }));
        return { ...i, narration: result.narration, imagePrompts: imagePromptsWithGenerated, narrationLoading: false };
      }
      return { ...i, narrationLoading: false };
    });

    setTimeout(() => {
      const element = document.getElementById(`narration-result-${idea.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
  
  updateNarrationPrompt(ideaId: string, event: Event) {
    const prompt = (event.target as HTMLTextAreaElement).value;
    this.updateIdea(ideaId, i => ({...i, narrationPrompt: prompt}));
  }

  addToNarrationPrompt(idea: ContentIdea, textToAdd: string): void {
    const textarea = document.getElementById('narrationPrompt-' + idea.id) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentPrompt = idea.narrationPrompt;
    const trimmedText = textToAdd?.trim() ?? '';
    if (!trimmedText) return;

    const prefix = (start > 0 && currentPrompt[start - 1] !== ' ') ? ' ' : '';
    const suffix = ' ';
    const textToInsert = prefix + trimmedText + suffix;

    const newPrompt = currentPrompt.substring(0, start) + textToInsert + currentPrompt.substring(end);

    this.updateIdea(idea.id, i => ({ ...i, narrationPrompt: newPrompt }));
    
    // Use a minimal timeout to allow the DOM to update before focusing and setting the cursor position.
    setTimeout(() => {
      textarea.focus({ preventScroll: true });
      const newCursorPos = start + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, 0);
  }

  copyToClipboard(text: string, type: string, id: string): void {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'narration') {
        this.copiedNarration.set(id);
        setTimeout(() => {
          if (this.copiedNarration() === id) this.copiedNarration.set(null);
        }, 2000);
      } else {
        const key = `${id}-${type}`;
        this.copiedColumn.set(key);
        setTimeout(() => {
          if (this.copiedColumn() === key) this.copiedColumn.set(null);
        }, 2000);
      }
    });
  }

  copyAllImagePrompts(idea: ContentIdea): void {
    if (!idea.imagePrompts || idea.imagePrompts.length === 0) return;

    const allPrompts = idea.imagePrompts
        .map(p => p.prompt)
        .join('\n\n---\n\n');

    navigator.clipboard.writeText(allPrompts).then(() => {
        this.copiedAllPrompts.set(idea.id);
        setTimeout(() => {
            if (this.copiedAllPrompts() === idea.id) {
                this.copiedAllPrompts.set(null);
            }
        }, 2000);
    });
  }

  getWordCount(text: string | undefined): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  getCharacterCount(text: string | undefined): number {
    if (!text) return 0;
    return text.length;
  }
  
  // --- View Mode ---
  setViewMode(mode: 'normal' | 'compact'): void {
    this.viewMode.set(mode);
  }

  toggleTheme(): void {
    this.theme.update(current => (current === 'dark' ? 'light' : 'dark'));
  }

  copyCompactViewToClipboard(): void {
    const activeItem = this.activeHistoryItem();
    if (!activeItem || activeItem.ideas.length === 0) return;

    const columns = this.tableColumns();
    const header = columns.join('\t');

    const rows = activeItem.ideas.map((idea) => {
        const rowData = columns.map(col => {
            // Replace newlines with a space for Excel compatibility, and handle potential null/undefined values.
            const cellData = idea[col] ? idea[col].toString().replace(/\r?\n|\r/g, ' ') : '';
            return `"${cellData.replace(/"/g, '""')}"`; // Quote and escape existing quotes
        });
        return rowData.join('\t');
    });

    const tsvData = [header, ...rows].join('\n');

    navigator.clipboard.writeText(tsvData).then(() => {
        this.copiedCompactView.set(true);
        setTimeout(() => this.copiedCompactView.set(false), 2000);
    });
  }

  // --- Template Management Methods ---
  startSavingTemplate(ideaId: string): void { this.isSavingTemplateForIdeaId.set(ideaId); this.newTemplateName.set(''); }
  cancelSavingTemplate(): void { this.isSavingTemplateForIdeaId.set(null); }

  savePromptTemplate(idea: ContentIdea, name: string): void {
    const trimmedName = name.trim();
    let trimmedPrompt = idea.narrationPrompt.trim();
    
    if (trimmedName && trimmedPrompt) {
      const columns = this.tableColumns();
      const replacements = columns
        .map(col => ({
          column: col,
          value: idea[col] as string,
        }))
        .filter(item => item.value && typeof item.value === 'string' && item.value.trim().length > 2)
        .sort((a, b) => b.value.length - a.value.length);

      for (const replacement of replacements) {
        const escapedValue = replacement.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedValue, 'gi');
        trimmedPrompt = trimmedPrompt.replace(regex, `{{${replacement.column}}}`);
      }

      if (!this.savedPromptTemplates().some(t => t.template === trimmedPrompt)) {
        this.savedPromptTemplates.update(templates => [...templates, { name: trimmedName, template: trimmedPrompt }]);
      }
    }
    this.cancelSavingTemplate();
  }

  deletePromptTemplate(index: number): void {
    const templateToDelete = this.savedPromptTemplates()[index];
    if (!templateToDelete) return;

    this.recentlyDeletedTemplate.set({ template: templateToDelete, index });
    this.editingTemplateIndex.set(null); // Ensure edit mode is closed if deleting

    this.savedPromptTemplates.update(templates => {
      const newTemplates = [...templates];
      newTemplates.splice(index, 1);
      return newTemplates;
    });

    // Automatically clear the "undo" option after 5 seconds
    setTimeout(() => {
      // Only clear if it's still the same deleted item
      if (this.recentlyDeletedTemplate()?.template.name === templateToDelete.name) {
        this.recentlyDeletedTemplate.set(null);
      }
    }, 5000);
  }

  undoDeletePromptTemplate(): void {
    const deletedItem = this.recentlyDeletedTemplate();
    if (!deletedItem) return;

    this.savedPromptTemplates.update(templates => {
      const newTemplates = [...templates];
      // Re-insert the item at its original position
      newTemplates.splice(deletedItem.index, 0, deletedItem.template);
      return newTemplates;
    });

    this.recentlyDeletedTemplate.set(null); // Clear the undo state
  }

  applyPromptTemplate(idea: ContentIdea, template: string): void {
    let processedPrompt = template;
    const variables = template.match(/{{\s*([\w\d]+)\s*}}/g) || [];
    variables.forEach(variable => {
      const columnName = variable.replace(/{{\s*|\s*}}/g, '');
      const value = idea[columnName] || `[${columnName}]`;
      processedPrompt = processedPrompt.replace(new RegExp(variable, 'g'), value);
    });
    this.updateIdea(idea.id, i => ({ ...i, narrationPrompt: processedPrompt }));
    this.closeTemplatesModal();
    const textarea = document.getElementById('narrationPrompt-' + idea.id) as HTMLTextAreaElement;
    if (textarea) {
      setTimeout(() => textarea.dispatchEvent(new Event('input', { bubbles: true })));
    }
  }
  
  insertVariableIntoPrompt(idea: ContentIdea, variableName: string): void {
    const textarea = document.getElementById('narrationPrompt-' + idea.id) as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentPrompt = idea.narrationPrompt;
    const textToInsert = `{{${variableName}}}`;
    const newPrompt = `${currentPrompt.substring(0, start)}${textToInsert}${currentPrompt.substring(end)}`;
    this.updateIdea(idea.id, i => ({ ...i, narrationPrompt: newPrompt }));
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  openTemplatesModal(idea: ContentIdea): void { 
    this.activeIdeaForModal.set(idea); 
    this.isTemplatesModalOpen.set(true); 
    this.recentlyDeletedTemplate.set(null); 
    this.editingTemplateIndex.set(null);
  }
  closeTemplatesModal(): void { 
    this.isTemplatesModalOpen.set(false); 
    this.activeIdeaForModal.set(null); 
    this.editingTemplateIndex.set(null);
  }
  
  copyTemplateToClipboard(template: string, index: number) {
     navigator.clipboard.writeText(template).then(() => {
      const key = `template-${index}`;
      this.copiedTemplate.set(key);
      setTimeout(() => { if (this.copiedTemplate() === key) { this.copiedTemplate.set(null); } }, 2000);
    });
  }

  startEditingTemplate(index: number): void {
    const template = this.savedPromptTemplates()[index];
    if (!template) return;
    this.editingTemplateIndex.set(index);
    this.editingTemplateName.set(template.name);
    this.editingTemplateContent.set(template.template);
  }

  cancelEditingTemplate(): void {
    this.editingTemplateIndex.set(null);
  }

  saveEditingTemplate(): void {
    const index = this.editingTemplateIndex();
    if (index === null) return;
    const newName = this.editingTemplateName().trim();
    const newContent = this.editingTemplateContent().trim();

    if (!newName || !newContent) return; // Basic validation

    this.savedPromptTemplates.update(templates => {
      const newTemplates = [...templates];
      newTemplates[index] = { name: newName, template: newContent };
      return newTemplates;
    });
    this.cancelEditingTemplate();
  }

  // --- User-Requested Features Methods ---
  toggleNarrationPrompt(ideaId: string): void {
    this.narrationPromptVisibility.update(vis => ({ ...vis, [ideaId]: !vis[ideaId] }));
  }

  toggleImagePromptGenerated(ideaId: string, promptIndex: number): void {
    this.updateIdea(ideaId, idea => {
      if (!idea.imagePrompts) return idea;
      const newImagePrompts = idea.imagePrompts.map((prompt, index) => 
        index === promptIndex ? { ...prompt, generated: !prompt.generated } : prompt
      );
      return { ...idea, imagePrompts: newImagePrompts };
    });
  }

  async generateVideoPrompt(ideaId: string, promptIndex: number): Promise<void> {
    const activeId = this.activeHistoryId();
    if (!activeId) return;

    const updatePromptState = (updater: (p: ImagePrompt) => ImagePrompt) => {
      this.updateIdea(ideaId, idea => {
        if (!idea.imagePrompts) return idea;
        return {
          ...idea,
          imagePrompts: idea.imagePrompts.map((p, i) => i === promptIndex ? updater(p) : p),
        };
      });
    };

    const idea = this.currentIdeas().find(i => i.id === ideaId);
    const originalPrompt = idea?.imagePrompts?.[promptIndex]?.prompt;
    if (!originalPrompt) return;
    
    updatePromptState(p => ({ ...p, videoPromptLoading: true }));
    const videoPrompt = await this.geminiService.generateVideoPromptFromImagePrompt(originalPrompt);
    updatePromptState(p => ({ ...p, videoPrompt: videoPrompt ?? undefined, videoPromptLoading: false }));
  }

  handleScrollButtonClick(): void {
    this.scrollToTopClickCount.update(c => c + 1);
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    if (this.scrollToTopClickCount() > 2) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      mainContent.scrollBy({ top: -mainContent.clientHeight * 0.8, behavior: 'smooth' });
    }
  }

  // --- Reset Data ---
  openResetConfirmModal(): void {
    this.isResetConfirmModalOpen.set(true);
  }

  closeResetConfirmModal(): void {
    this.isResetConfirmModalOpen.set(false);
  }

  confirmResetData(): void {
    const activeId = this.activeHistoryId();
    if (activeId) {
      this.clearedHistoryIds.update(cleared => {
        const newSet = new Set(cleared);
        newSet.add(activeId);
        return newSet;
      });
    }
    this.expandedIdeaId.set(null);
    this.closeResetConfirmModal();
  }

  // --- Import/Export Data ---
  exportData(): void {
    try {
      const dataToExport = {
        version: 1,
        history: this.history(),
        templates: this.savedPromptTemplates()
      };
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `${timestamp}-content-generator-backup.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export data:", e);
      this.apiError.set("An error occurred while trying to export your data.");
    }
  }

  triggerImport(): void {
    this.importFileInput()?.nativeElement.click();
  }

  handleFileImport(event: Event): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    if (file) {
      this.fileToImport.set(file);
      this.isImportConfirmModalOpen.set(true);
    }
    element.value = ''; // Reset to allow re-importing the same file
  }

  cancelImport(): void {
    this.fileToImport.set(null);
    this.isImportConfirmModalOpen.set(false);
  }

  async confirmImport(): Promise<void> {
    const file = this.fileToImport();
    if (!file) {
      this.cancelImport();
      return;
    }

    try {
      const fileContent = await file.text();
      const importedData = JSON.parse(fileContent);

      let importedHistory: HistoryItem[] = [];
      let importedTemplates: PromptTemplate[] = [];

      // Handle legacy format (just an array of history items)
      if (Array.isArray(importedData)) {
        importedHistory = importedData as HistoryItem[];
      } 
      // Handle new format, being lenient about missing keys
      else if (typeof importedData === 'object' && importedData !== null && !Array.isArray(importedData)) {
        let hasContent = false;
        if (Array.isArray(importedData.history)) {
          importedHistory = importedData.history;
          hasContent = true;
        }
        if (Array.isArray(importedData.templates)) {
          importedTemplates = importedData.templates;
          hasContent = true;
        }
        
        if (!hasContent) {
          throw new Error("Invalid file format.");
        }
      } 
      else {
        throw new Error("Invalid file format.");
      }

      // --- Merge History ---
      const historyMap = new Map<string, HistoryItem>();
      // Add current history to map first.
      for (const item of this.history()) {
          historyMap.set(item.topic, item);
      }
      // Merge imported history, keeping the newest on conflict.
      for (const importedItem of importedHistory) {
          const existingItem = historyMap.get(importedItem.topic);
          if (!existingItem || importedItem.timestamp > existingItem.timestamp) {
              historyMap.set(importedItem.topic, importedItem);
          }
      }
      let mergedHistory = Array.from(historyMap.values());
      mergedHistory.sort((a, b) => b.timestamp - a.timestamp); // Newest first
      
      this.history.set(mergedHistory);

      // --- Merge Templates ---
      if (importedTemplates.length > 0) {
        const templateMap = new Map<string, PromptTemplate>();
        // Add current templates to map first to give them priority.
        for (const template of this.savedPromptTemplates()) {
            templateMap.set(template.name, template);
        }
        // Add imported templates if they don't already exist.
        for (const importedTemplate of importedTemplates) {
            if (!templateMap.has(importedTemplate.name)) {
                templateMap.set(importedTemplate.name, importedTemplate);
            }
        }
        const mergedTemplates = Array.from(templateMap.values());
        this.savedPromptTemplates.set(mergedTemplates);
      }

      // Preserve active history if possible, otherwise set to the newest.
      const currentActiveId = this.activeHistoryId();
      if (!currentActiveId || !mergedHistory.some(h => h.id === currentActiveId)) {
          this.activeHistoryId.set(mergedHistory.length > 0 ? mergedHistory[0].id : null);
      }
      
    } catch (e) {
      console.error("Failed to import data:", e);
      this.apiError.set("Failed to import data. The file may be corrupt or in an incorrect format.");
    } finally {
      this.cancelImport();
    }
  }

  // --- Image Generation ---
  hasGeneratedImages(idea: ContentIdea): boolean {
    return idea.imagePrompts?.some(p => p.imageUrl) ?? false;
  }

  async generateSingleImage(ideaId: string, promptIndex: number): Promise<void> {
    const updateImagePromptState = (updater: (p: ImagePrompt) => ImagePrompt) => {
      this.updateIdea(ideaId, idea => {
        if (!idea.imagePrompts) return idea;
        return {
          ...idea,
          imagePrompts: idea.imagePrompts.map((p, i) => i === promptIndex ? updater(p) : p),
        };
      });
    };

    const idea = this.currentIdeas().find(i => i.id === ideaId);
    const prompt = idea?.imagePrompts?.[promptIndex];
    if (!prompt) return;

    updateImagePromptState(p => ({ ...p, imageLoading: true, imageError: false }));
    const base64Image = await this.geminiService.generateImage(prompt.prompt);
    
    if (base64Image) {
      updateImagePromptState(p => ({ ...p, imageUrl: `data:image/jpeg;base64,${base64Image}`, imageLoading: false }));
    } else {
      updateImagePromptState(p => ({ ...p, imageLoading: false, imageError: true }));
    }
  }

  async generateAllImages(idea: ContentIdea): Promise<void> {
    if (!idea.imagePrompts) return;
    this.isGeneratingAllImages.set(idea.id);

    const generationPromises: Promise<void>[] = [];
    idea.imagePrompts.forEach((prompt, index) => {
      if (!prompt.imageUrl) {
        generationPromises.push(this.generateSingleImage(idea.id, index));
      }
    });

    await Promise.all(generationPromises);
    this.isGeneratingAllImages.set(null);
  }

  openLightbox(ideaId: string, promptIndex: number): void {
    this.lightboxState.set({ ideaId, promptIndex });
  }

  closeLightbox(): void {
    this.lightboxState.set(null);
  }

  copyLightboxPrompt(text: string | undefined, type: 'image' | 'video'): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        this.copiedLightboxPrompt.set(type);
        setTimeout(() => {
            if (this.copiedLightboxPrompt() === type) {
                this.copiedLightboxPrompt.set(null);
            }
        }, 2000);
    });
  }

  nextImage(): void {
    this.lightboxState.update(state => {
        if (!state) return null;
        const idea = this.currentIdeas().find(i => i.id === state.ideaId);
        if (!idea?.imagePrompts) return state;

        for (let i = state.promptIndex + 1; i < idea.imagePrompts.length; i++) {
            if (idea.imagePrompts[i].imageUrl) {
                return { ...state, promptIndex: i };
            }
        }
        return state;
    });
  }

  prevImage(): void {
      this.lightboxState.update(state => {
          if (!state) return null;
          const idea = this.currentIdeas().find(i => i.id === state.ideaId);
          if (!idea?.imagePrompts) return state;

          for (let i = state.promptIndex - 1; i >= 0; i--) {
              if (idea.imagePrompts[i].imageUrl) {
                  return { ...state, promptIndex: i };
              }
          }
          return state;
      });
  }

  downloadImage(imageUrl: string, filename: string): void {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = filename || 'generated-image.jpeg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async downloadAllImages(idea: ContentIdea): Promise<void> {
    this.isDownloadingAllImages.set(idea.id);
    const imagesToDownload = idea.imagePrompts?.filter(p => p.imageUrl) ?? [];
    
    for (let i = 0; i < imagesToDownload.length; i++) {
      const prompt = imagesToDownload[i];
      if(prompt.imageUrl) {
        this.downloadImage(prompt.imageUrl, `image-${prompt.timestamp}.jpeg`);
        if (i < imagesToDownload.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    this.isDownloadingAllImages.set(null);
  }

  // --- Batch Narration Generation ---
  openBatchGenerateModal(): void {
    this.isBatchGenerateModalOpen.set(true);
    this.selectedIdeasForBatch.set(new Set()); // Reset selection on open
  }

  closeBatchGenerateModal(): void {
    this.isBatchGenerateModalOpen.set(false);
  }

  toggleIdeaSelection(ideaId: string): void {
    this.selectedIdeasForBatch.update(currentSet => {
      const newSet = new Set(currentSet);
      if (newSet.has(ideaId)) {
        newSet.delete(ideaId);
      } else {
        newSet.add(ideaId);
      }
      return newSet;
    });
  }

  toggleSelectAllIdeas(): void {
    if (this.isAllIdeasSelectedForBatch()) {
      this.selectedIdeasForBatch.set(new Set());
    } else {
      const allIdeaIds = new Set(this.currentIdeas().map(idea => idea.id));
      this.selectedIdeasForBatch.set(allIdeaIds);
    }
  }

  async generateSelectedNarrations(): Promise<void> {
    const selectedIds = this.selectedIdeasForBatch();
    if (selectedIds.size === 0) return;

    const ideasToGenerate = this.currentIdeas().filter(idea => selectedIds.has(idea.id));
    this.closeBatchGenerateModal();

    const generationPromises = ideasToGenerate.map(idea => this.generateNarration(idea));
    
    // We don't need to await here, as we want the UI to be responsive
    // while the generations run in the background. The individual loading
    // states on each idea will provide user feedback.
    Promise.allSettled(generationPromises);
  }

  updateNotes(ideaId: string, event: Event): void {
    const notes = (event.target as HTMLTextAreaElement).value;
    this.updateIdea(ideaId, i => ({...i, notes: notes}));
  }
}
