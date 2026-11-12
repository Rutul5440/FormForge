import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FieldDefinition } from '../../core/models/form.models';

@Component({
  selector: 'app-field-shell',
  standalone: true,
  template: `
    <div class="field-shell">
      <div class="field-tab" [style.background]="accentColor"></div>
      <div class="field-body">
        <label class="field-label" [attr.for]="inputId">
          <span>{{ field.label }}</span>
          @if (field.required) {
            <span class="req" aria-hidden="true">*</span>
          }
          <span class="type-chip mono">{{ field.type }}</span>
        </label>

        @if (field.helpText) {
          <p class="help-text" [id]="inputId + '-help'">{{ field.helpText }}</p>
        }

        <ng-content />

        @if (errorMessage) {
          <p class="error-text" [id]="inputId + '-err'" role="alert">{{ errorMessage }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .field-shell {
      display: grid;
      grid-template-columns: 4px 1fr;
      gap: 14px;
      background: transparent;
      border-bottom: 1px solid var(--ff-border);
      padding: 14px 2px 16px;
    }
    .field-tab {
      border-radius: 2px;
      min-height: 100%;
    }
    .field-body {
      min-width: 0;
    }
    .field-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: var(--ff-ink);
      margin-bottom: 6px;
    }
    .req {
      color: var(--ff-danger);
      font-weight: 700;
    }
    .type-chip {
      margin-left: auto;
      font-size: 11px;
      font-weight: 500;
      color: var(--ff-ink-muted);
      background: var(--ff-bg-rail);
      border: 1px solid var(--ff-border);
      padding: 1px 7px;
      border-radius: 4px;
    }
    .help-text {
      margin: 0 0 8px;
      font-size: 12px;
      color: var(--ff-ink-secondary);
    }
    .error-text {
      margin: 6px 0 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--ff-danger);
    }
  `]
})
export class FieldShellComponent {
  @Input({ required: true }) field!: FieldDefinition;
  @Input({ required: true }) inputId!: string;
  @Input({ required: true }) accentColor!: string;
  @Input() control?: AbstractControl | null;
  @Input() serverError?: string | null;

  get errorMessage(): string | null {
    if (this.serverError) return this.serverError;
    const ctrl = this.control;
    if (!ctrl || !ctrl.invalid || (!ctrl.dirty && !ctrl.touched)) return null;

    if (ctrl.errors?.['required']) return `${this.field.label} is required.`;
    if (ctrl.errors?.['minlength']) {
      return `${this.field.label} must be at least ${ctrl.errors['minlength'].requiredLength} characters.`;
    }
    if (ctrl.errors?.['maxlength']) {
      return `${this.field.label} cannot exceed ${ctrl.errors['maxlength'].requiredLength} characters.`;
    }
    if (ctrl.errors?.['pattern']) {
      return `${this.field.label} does not match the required format.`;
    }
    return `${this.field.label} is invalid.`;
  }
}
