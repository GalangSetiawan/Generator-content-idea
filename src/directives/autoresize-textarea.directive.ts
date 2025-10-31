
import { Directive, ElementRef, HostListener, effect, inject, input, Renderer2, OnDestroy, AfterContentInit } from '@angular/core';

@Directive({
  selector: 'textarea[appAutoresize]',
  standalone: true,
})
export class AutoresizeTextareaDirective implements AfterContentInit, OnDestroy {
  private el = inject(ElementRef<HTMLTextAreaElement>);
  private renderer = inject(Renderer2);
  private mainContent: HTMLElement | null = null;
  private originalOverflowAnchor: string | null = null;
  
  // Optional input to trigger resize externally
  triggerResize = input<any>();

  constructor() {
    effect(() => {
      // When the trigger input changes, resize the textarea
      this.triggerResize(); 
      this.resize();
    });
  }

  @HostListener('input')
  onInput(): void {
    this.resize();
  }

  ngAfterContentInit(): void {
    // Find the scrollable container once the view is initialized
    this.mainContent = document.getElementById('main-content');
    // Initial resize
    this.resize();
  }
  
  ngOnDestroy(): void {
    // Restore original style on destroy, just in case
    if (this.mainContent && this.originalOverflowAnchor !== null) {
      this.renderer.setStyle(this.mainContent, 'overflow-anchor', this.originalOverflowAnchor);
    }
  }

  private resize(): void {
    const textarea = this.el.nativeElement;

    if (this.mainContent) {
      // Save the original value only once
      if (this.originalOverflowAnchor === null) {
          this.originalOverflowAnchor = this.mainContent.style.overflowAnchor || '';
      }
      
      // Prevent browser from auto-scrolling
      this.renderer.setStyle(this.mainContent, 'overflow-anchor', 'none');
    }
    
    // Reset height to accurately calculate the new scrollHeight
    textarea.style.height = 'auto';
    // Set the new height
    textarea.style.height = `${textarea.scrollHeight}px`;

    // Re-enable scroll anchoring after the resize has been painted
    if (this.mainContent) {
        requestAnimationFrame(() => {
            if (this.mainContent && this.originalOverflowAnchor !== null) {
                this.renderer.setStyle(this.mainContent, 'overflow-anchor', this.originalOverflowAnchor);
            }
        });
    }
  }
}
