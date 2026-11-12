import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../core/models/form.models';
import { getFieldAccent } from '../../core/registry/field-registry';
import { FieldShellComponent } from './field-shell.component';

@Component({
  selector: 'app-dropdown-field',
  standalone: true,
  imports: [ReactiveFormsModule, FieldShellComponent],
  template: `
    <app-field-shell
      [field]="field"
      [inputId]="inputId"
      [accentColor]="accent"
      [control]="control"
      [serverError]="serverError">
      <select
        class="ff-select"
        [class.invalid]="isInvalid"
        [id]="inputId"
        [formControl]="control">
        <option value="">{{ field.placeholder || 'Select an option' }}</option>
        @for (opt of field.options || []; track opt) {
          <option [value]="opt">{{ opt }}</option>
        }
      </select>
    </app-field-shell>
  `
})
export class DropdownFieldComponent {
  @Input({ required: true }) field!: FieldDefinition;
  @Input({ required: true }) control!: FormControl;
  @Input() serverError?: string | null;

  readonly accent = getFieldAccent('dropdown');

  get inputId(): string {
    return `ff-${this.field.id}`;
  }

  get isInvalid(): boolean {
    return Boolean(this.serverError) || (this.control.invalid && (this.control.dirty || this.control.touched));
  }
}
