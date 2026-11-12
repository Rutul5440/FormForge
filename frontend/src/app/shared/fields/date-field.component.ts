import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldDefinition } from '../../core/models/form.models';
import { getFieldAccent } from '../../core/registry/field-registry';
import { FieldShellComponent } from './field-shell.component';

@Component({
  selector: 'app-date-field',
  standalone: true,
  imports: [ReactiveFormsModule, FieldShellComponent],
  template: `
    <app-field-shell
      [field]="field"
      [inputId]="inputId"
      [accentColor]="accent"
      [control]="control"
      [serverError]="serverError">
      <input
        type="date"
        class="ff-input mono"
        [class.invalid]="isInvalid"
        [id]="inputId"
        [formControl]="control"
        [min]="field.validation?.minDate || null"
        [max]="field.validation?.maxDate || null" />
    </app-field-shell>
  `
})
export class DateFieldComponent {
  @Input({ required: true }) field!: FieldDefinition;
  @Input({ required: true }) control!: FormControl;
  @Input() serverError?: string | null;

  readonly accent = getFieldAccent('date');

  get inputId(): string {
    return `ff-${this.field.id}`;
  }

  get isInvalid(): boolean {
    return Boolean(this.serverError) || (this.control.invalid && (this.control.dirty || this.control.touched));
  }
}

