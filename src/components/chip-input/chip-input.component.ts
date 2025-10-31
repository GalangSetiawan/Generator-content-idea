
import { Component, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chip-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chip-input.component.html',
})
export class ChipInputComponent {
  chips = model.required<string[]>();
  inputValue = signal('');

  addChip(value: string): void {
    const chip = value.trim();
    if (chip && !this.chips().includes(chip)) {
      this.chips.update(currentChips => [...currentChips, chip]);
    }
    this.inputValue.set('');
  }

  removeChip(index: number): void {
    this.chips.update(currentChips => {
      const newChips = [...currentChips];
      newChips.splice(index, 1);
      return newChips;
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addChip((event.target as HTMLInputElement).value);
    }
  }

  onBlur(event: FocusEvent): void {
    this.addChip((event.target as HTMLInputElement).value);
  }
}
