import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { FieldDefinition, FormSchema } from '../../core/models/form.models';
import { DateFieldComponent } from '../fields/date-field.component';
import { DropdownFieldComponent } from '../fields/dropdown-field.component';
import { SignatureFieldComponent } from '../fields/signature-field.component';
import { TextFieldComponent } from '../fields/text-field.component';

@Component({
  selector: 'app-dynamic-form-renderer',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TextFieldComponent,
    DateFieldComponent,
    DropdownFieldComponent,
    SignatureFieldComponent
  ],
  template: `
    <form [formGroup]="formGroup" (ngSubmit)="onSubmit()" class="dynamic-form" novalidate>
      @for (field of schema.fields; track field.id) {
        @switch (field.type) {
          @case ('text') {
            <app-text-field
              [field]="field"
              [control]="getControl(field)"
              [serverError]="serverErrors[fieldKey(field)]" />
          }
          @case ('date') {
            <app-date-field
              [field]="field"
              [control]="getControl(field)"
              [serverError]="serverErrors[fieldKey(field)]" />
          }
          @case ('dropdown') {
            <app-dropdown-field
              [field]="field"
              [control]="getControl(field)"
              [serverError]="serverErrors[fieldKey(field)]" />
          }
          @case ('signature') {
            <app-signature-field
              [field]="field"
              [control]="getControl(field)"
              [serverError]="serverErrors[fieldKey(field)]" />
          }
        }
      }

      @if (schema.fields.length === 0) {
        <div class="empty-schema">
          No fields defined in this schema yet.
        </div>
      }

      <div class="form-footer">
        <button
          type="submit"
          class="ff-btn ff-btn-primary submit-btn"
          [disabled]="submitting || schema.fields.length === 0">
          @if (submitting) {
            Submitting...
          } @else {
            {{ submitLabel }}
          }
        </button>
      </div>
    </form>
  `,
  styles: [`
    .dynamic-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .empty-schema {
      padding: 28px;
      text-align: center;
      border: 1px dashed var(--ff-border-strong);
      border-radius: var(--ff-radius-md);
      color: var(--ff-ink-secondary);
      background: var(--ff-bg-subtle);
    }
    .form-footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 8px;
    }
    .submit-btn {
      min-width: 164px;
      height: 40px;
    }
  `]
})
export class DynamicFormRendererComponent implements OnChanges {
  @Input({ required: true }) schema!: FormSchema;
  @Input() submitLabel = 'Submit Response';
  @Input() submitting = false;
  @Input() serverErrors: Record<string, string> = {};

  @Output() submitted = new EventEmitter<Record<string, unknown>>();

  formGroup = new FormGroup<Record<string, FormControl>>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['schema']) {
      this.rebuildFormGroup();
    }
  }

  fieldKey(field: FieldDefinition): string {
    return field.key || field.id;
  }

  getControl(field: FieldDefinition): FormControl {
    return this.formGroup.get(this.fieldKey(field)) as FormControl;
  }

  onSubmit(): void {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) return;
    this.submitted.emit(this.formGroup.getRawValue());
  }

  resetForm(): void {
    this.formGroup.reset();
  }

  private rebuildFormGroup(): void {
    const controls: Record<string, FormControl> = {};
    for (const field of this.schema?.fields ?? []) {
      const validators: ValidatorFn[] = [];
      if (field.required) validators.push(Validators.required);

      if (field.type === 'text' && field.validation) {
        if (field.validation.minLength != null) {
          validators.push(Validators.minLength(field.validation.minLength));
        }
        if (field.validation.maxLength != null) {
          validators.push(Validators.maxLength(field.validation.maxLength));
        }
        if (field.validation.pattern) {
          try {
            validators.push(Validators.pattern(field.validation.pattern));
          } catch {
            // Invalid draft regex will still be caught cleanly by server schema validation
          }
        }
      }

      controls[this.fieldKey(field)] = new FormControl('', validators);
    }
    this.formGroup = new FormGroup(controls);
  }
}

