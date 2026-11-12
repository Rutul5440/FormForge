import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../core/models/form.models';
import { getFieldAccent } from '../../core/registry/field-registry';
import { FieldShellComponent } from './field-shell.component';

@Component({
  selector: 'app-text-field',
  standalone: true,
  imports: [ReactiveFormsModule, FieldShellComponent],
  template: `
    <app-field-shell
      [field]="field"
      [inputId]="inputId"
      [accentColor]="accent"
      [control]="control"
      [serverError]="serverError">
      @if (field.validation?.multiline) {
        <textarea
          class="ff-textarea"
          [class.invalid]="isInvalid"
          [id]="inputId"
          [formControl]="control"
          [placeholder]="field.placeholder || 'Enter details'">
        </textarea>
      } @else {
        <input
          type="text"
          class="ff-input"
          [class.invalid]="isInvalid"
          [id]="inputId"
          [formControl]="control"
          [placeholder]="field.placeholder || 'Enter value'" />
      }
    </app-field-shell>
  `
})
export class TextFieldComponent {
  @Input({ required: true }) field!: FieldDefinition;
  @Input({ required: true }) control!: FormControl;
  @Input() serverError?: string | null;

  readonly accent = getFieldAccent('text');

  get inputId(): string {
    return `ff-${this.field.id}`;
  }

  get isInvalid(): boolean {
    return Boolean(this.serverError) || (this.control.invalid && (this.control.dirty || this.control.touched));
  }
}

