import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FieldDefinition,
  FieldType,
  FormDetail,
  FormSchema,
  FormSummary,
  FormVersionSummary,
  StarterTemplate
} from '../../core/models/form.models';
import {
  FieldTypeVisualMeta,
  REUSABLE_FIELD_TYPES,
  createFieldFromType,
  getFieldAccent,
  slugifyFieldKey
} from '../../core/registry/field-registry';
import { FormApiService } from '../../core/services/form-api.service';
import { DynamicFormRendererComponent } from '../../shared/dynamic-form-renderer/dynamic-form-renderer.component';

@Component({
  selector: 'app-builder-studio',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    DynamicFormRendererComponent
  ],
  template: `
    <div class="studio-shell">
      <!-- LEFT RAIL: Form Switcher, Reusable Field Palette & Starter Templates -->
      <aside class="left-rail" aria-label="Field registry and starter templates">
        <div class="rail-section">
          <div class="rail-head">
            <span class="rail-title">Active Form</span>
            <button type="button" class="ff-btn ff-btn-ghost mini-btn" (click)="createBlankForm()">
              + New
            </button>
          </div>
          <label class="sr-only" for="studio-form-select">Select form to edit</label>
          <select
            id="studio-form-select"
            class="ff-select"
            [ngModel]="activeFormId()"
            (ngModelChange)="switchForm($event)">
            @for (item of forms(); track item.id) {
              <option [value]="item.id">{{ item.catalogCode }} · {{ item.title }}</option>
            }
          </select>
        </div>

        <div class="rail-section">
          <div class="rail-head">
            <span class="rail-title">Field Registry</span>
            <span class="hint-text">Drag or +</span>
          </div>

          <div
            cdkDropList
            id="paletteList"
            [cdkDropListData]="paletteTypes"
            [cdkDropListConnectedTo]="['canvasList']"
            [cdkDropListSortingDisabled]="true"
            class="palette-list">
            @for (meta of paletteTypes; track meta.type) {
              <div class="palette-card" cdkDrag [cdkDragData]="meta.type" [cdkDragDisabled]="inspectingVersion() !== null">
                <span class="type-bar" [style.background]="meta.accentColor"></span>
                <div class="palette-copy">
                  <div class="palette-name">{{ meta.label }}</div>
                  <div class="palette-desc">{{ meta.description }}</div>
                </div>
                <button
                  type="button"
                  class="add-field-btn"
                  [title]="'Add ' + meta.label"
                  [disabled]="inspectingVersion() !== null"
                  (click)="appendField(meta.type)">
                  +
                </button>
              </div>
            }
          </div>
        </div>

        <div class="rail-section">
          <div class="rail-head">
            <span class="rail-title">Starter Templates</span>
            <a routerLink="/templates" class="rail-link">Gallery</a>
          </div>
          <div class="tpl-mini-list">
            @for (tpl of templates(); track tpl.key) {
              <button
                type="button"
                class="tpl-mini-row"
                [disabled]="cloningKey() === tpl.key"
                (click)="cloneStarterTemplate(tpl.key)">
                <span>{{ tpl.title }}</span>
                <span class="mono tpl-clone-tag">{{ cloningKey() === tpl.key ? '...' : 'Clone' }}</span>
              </button>
            }
          </div>
        </div>
      </aside>

      <!-- CENTER CANVAS: Form Header, Version Rail & CDK Dropzone -->
      <section class="canvas-pane" aria-label="Form canvas">
        @if (loading()) {
          <div class="canvas-sheet">
            <div class="ff-skeleton" style="height: 32px; width: 48%;"></div>
            <div class="ff-skeleton" style="height: 82px; width: 100%; margin-top: 20px;"></div>
            <div class="ff-skeleton" style="height: 82px; width: 100%; margin-top: 12px;"></div>
          </div>
        } @else {
          @if (formDetail(); as detail) {
          <div class="studio-toolbar">
            <div class="toolbar-left">
              <span class="mono code-chip">{{ detail.catalogCode }}</span>
              @if (detail.activeVersionNumber) {
                <span class="ff-pill ff-pill-published mono">v{{ detail.activeVersionNumber }} Published</span>
              } @else {
                <span class="ff-pill ff-pill-draft">Unpublished Draft</span>
              }
              @if (dirty() || detail.hasUnpublishedChanges) {
                <span class="ff-pill ff-pill-draft">Pending Changes</span>
              }
            </div>

            <div class="toolbar-right">
              <div class="mode-switch" role="group" aria-label="Canvas mode">
                <button
                  type="button"
                  class="mode-btn"
                  [class.active]="!previewMode()"
                  (click)="previewMode.set(false)">
                  Design
                </button>
                <button
                  type="button"
                  class="mode-btn"
                  [class.active]="previewMode()"
                  (click)="previewMode.set(true)">
                  Preview
                </button>
              </div>

              @if (detail.activeVersionNumber) {
                <button type="button" class="ff-btn" (click)="copyShareLink(detail.slug)">
                  {{ copiedLink() ? 'Copied Link' : 'Share Link' }}
                </button>
              }

              <button
                type="button"
                class="ff-btn"
                [disabled]="saving() || inspectingVersion() !== null"
                (click)="saveDraft()">
                {{ saving() ? 'Saving...' : 'Save Draft' }}
              </button>

              <button
                type="button"
                class="ff-btn ff-btn-primary"
                [disabled]="publishing() || fields().length === 0 || inspectingVersion() !== null"
                (click)="publishNewVersion()">
                {{ publishing() ? 'Publishing...' : 'Publish v' + nextVersionNumber() }}
              </button>
            </div>
          </div>

          @if (statusMessage()) {
            <div class="banner-success" role="status">{{ statusMessage() }}</div>
          }
          @if (errorMessage()) {
            <div class="banner-error" role="alert">{{ errorMessage() }}</div>
          }

          @if (detail.versions.length > 0) {
            <div class="version-rail">
              <span class="rail-label">Immutable Versions:</span>
              <button
                type="button"
                class="ver-chip"
                [class.active]="inspectingVersion() === null"
                (click)="inspectingVersion.set(null)">
                Working Draft
              </button>
              @for (ver of detail.versions; track ver.id) {
                <button
                  type="button"
                  class="ver-chip mono"
                  [class.active]="inspectingVersion()?.id === ver.id"
                  (click)="inspectingVersion.set(ver)">
                  v{{ ver.versionNumber }} · {{ ver.responseCount }} resp
                </button>
              }
              <a [routerLink]="['/responses', detail.id]" class="ver-resp-link">
                Responses &amp; Excel →
              </a>
            </div>
          }

          @if (inspectingVersion(); as locked) {
            <div class="snapshot-notice">
              <span>
                Inspecting locked snapshot <strong class="mono">v{{ locked.versionNumber }}</strong>
                (published {{ locked.publishedAt | date: 'mediumDate' }}). Historical responses remain bound to this schema.
              </span>
              <button type="button" class="ff-btn" (click)="inspectingVersion.set(null)">
                Return to Editable Draft
              </button>
            </div>
          }

          <div class="canvas-sheet">
            @if (previewMode()) {
              <div class="preview-head">
                <h2>{{ title() || 'Untitled Form' }}</h2>
                @if (description()) {
                  <p>{{ description() }}</p>
                }
              </div>
              <app-dynamic-form-renderer
                [schema]="activeRenderSchema()"
                submitLabel="Test Validation (Preview)"
                (submitted)="onPreviewValidated()" />
            } @else {
              <div class="sheet-meta-edit">
                <label class="sr-only" for="form-title-input">Form title</label>
                <input
                  id="form-title-input"
                  type="text"
                  class="title-input"
                  [disabled]="inspectingVersion() !== null"
                  [ngModel]="title()"
                  (ngModelChange)="onTitleChange($event)"
                  placeholder="Form title" />
                <label class="sr-only" for="form-desc-input">Form description</label>
                <input
                  id="form-desc-input"
                  type="text"
                  class="desc-input"
                  [disabled]="inspectingVersion() !== null"
                  [ngModel]="description()"
                  (ngModelChange)="onDescChange($event)"
                  placeholder="Optional description or instructions for respondents" />
              </div>

              <div
                cdkDropList
                id="canvasList"
                [cdkDropListData]="displayedFields()"
                [cdkDropListConnectedTo]="['paletteList']"
                (cdkDropListDropped)="onCanvasDrop($event)"
                class="drop-canvas">
                @for (field of displayedFields(); track field.id; let idx = $index) {
                  <div
                    cdkDrag
                    [cdkDragDisabled]="inspectingVersion() !== null"
                    class="canvas-field"
                    [class.selected]="selectedFieldId() === field.id"
                    (click)="selectedFieldId.set(field.id)">
                    <span class="type-bar" [style.background]="accentFor(field.type)"></span>

                    <div class="field-main">
                      <div class="field-row-top">
                        <div class="field-title-group">
                          @if (inspectingVersion() === null) {
                            <span
                              cdkDragHandle
                              class="drag-handle"
                              title="Drag to reorder"
                              aria-label="Drag handle">
                              ⋮⋮
                            </span>
                          }
                          <span class="mono idx-num">{{ (idx + 1).toString().padStart(2, '0') }}</span>
                          <span class="field-name">{{ field.label }}</span>
                          @if (field.required) {
                            <span class="req">*</span>
                          }
                        </div>

                        <div class="field-row-tools" (click)="$event.stopPropagation()">
                          <span class="mono key-badge">{{ field.key }}</span>
                          <span class="mono type-badge">{{ field.type }}</span>
                          @if (inspectingVersion() === null) {
                            <button
                              type="button"
                              class="icon-btn"
                              title="Move up"
                              [disabled]="idx === 0"
                              (click)="moveField(idx, -1)">
                              ↑
                            </button>
                            <button
                              type="button"
                              class="icon-btn"
                              title="Move down"
                              [disabled]="idx === fields().length - 1"
                              (click)="moveField(idx, 1)">
                              ↓
                            </button>
                            <button
                              type="button"
                              class="icon-btn"
                              title="Duplicate field"
                              (click)="duplicateField(idx)">
                              ⧉
                            </button>
                            <button
                              type="button"
                              class="icon-btn danger"
                              title="Remove field"
                              (click)="removeField(idx)">
                              ×
                            </button>
                          }
                        </div>
                      </div>

                      <div class="field-preview-box">
                        @if (field.type === 'dropdown') {
                          <span>{{ field.options?.join(' · ') || 'No options configured' }}</span>
                          <span>▾</span>
                        } @else if (field.type === 'signature') {
                          <span>Signature ink pad (PNG capture)</span>
                        } @else if (field.type === 'date') {
                          <span class="mono">YYYY-MM-DD</span>
                        } @else {
                          <span>{{ field.placeholder || 'Text entry' }}</span>
                        }
                      </div>
                    </div>
                  </div>
                }

                @if (displayedFields().length === 0) {
                  <div class="empty-canvas">
                    <p>Drag a field type from the left registry or click <strong>+</strong> to build your form.</p>
                  </div>
                }
              </div>
            }
          </div>
          }
        }
      </section>

      <!-- RIGHT INSPECTOR: Field Properties & Validation Rules -->
      <aside class="right-rail" aria-label="Field properties inspector">
        @if (inspectingVersion() !== null) {
          <div class="inspector-empty">
            <h3>Read-Only Snapshot</h3>
            <p>Switch back to <strong>Working Draft</strong> to modify field properties or publish a new version.</p>
          </div>
        } @else {
          @if (selectedField(); as sel) {
          <div class="inspector-head">
            <span class="rail-title">Field Inspector</span>
            <span class="mono type-badge">{{ sel.type }}</span>
          </div>

          <div class="prop-group">
            <label for="prop-label">Field Label</label>
            <input
              id="prop-label"
              type="text"
              class="ff-input"
              [ngModel]="sel.label"
              (ngModelChange)="updateSelected({ label: $event })" />
          </div>

          <div class="prop-group">
            <label for="prop-key">Schema Key (JSON &amp; Excel)</label>
            <input
              id="prop-key"
              type="text"
              class="ff-input mono"
              [ngModel]="sel.key"
              (ngModelChange)="updateSelected({ key: sanitizeKey($event) })" />
          </div>

          <div class="prop-group">
            <label for="prop-placeholder">Placeholder</label>
            <input
              id="prop-placeholder"
              type="text"
              class="ff-input"
              [ngModel]="sel.placeholder || ''"
              (ngModelChange)="updateSelected({ placeholder: $event })" />
          </div>

          <div class="prop-group">
            <label for="prop-help">Help Text</label>
            <input
              id="prop-help"
              type="text"
              class="ff-input"
              [ngModel]="sel.helpText || ''"
              (ngModelChange)="updateSelected({ helpText: $event })" />
          </div>

          <label class="toggle-row">
            <span>Required field</span>
            <input
              type="checkbox"
              [checked]="sel.required"
              (change)="updateSelected({ required: $any($event.target).checked })" />
          </label>

          @if (sel.type === 'text') {
            <div class="rule-block">
              <div class="rail-title">Text Validation</div>
              <label class="toggle-row">
                <span>Multiline textarea</span>
                <input
                  type="checkbox"
                  [checked]="!!sel.validation?.multiline"
                  (change)="updateValidation({ multiline: $any($event.target).checked })" />
              </label>
              <div class="two-col">
                <div class="prop-group">
                  <label for="prop-minlen">Min length</label>
                  <input
                    id="prop-minlen"
                    type="number"
                    min="0"
                    class="ff-input mono"
                    [ngModel]="sel.validation?.minLength ?? null"
                    (ngModelChange)="updateValidation({ minLength: toNullableInt($event) })" />
                </div>
                <div class="prop-group">
                  <label for="prop-maxlen">Max length</label>
                  <input
                    id="prop-maxlen"
                    type="number"
                    min="1"
                    max="4000"
                    class="ff-input mono"
                    [ngModel]="sel.validation?.maxLength ?? null"
                    (ngModelChange)="updateValidation({ maxLength: toNullableInt($event) })" />
                </div>
              </div>
              <div class="prop-group">
                <label for="prop-regex">Regex pattern (optional)</label>
                <input
                  id="prop-regex"
                  type="text"
                  class="ff-input mono"
                  [ngModel]="sel.validation?.pattern || ''"
                  (ngModelChange)="updateValidation({ pattern: $event || undefined })"
                  placeholder="e.g. ^[A-Z0-9-]+$" />
              </div>
            </div>
          }

          @if (sel.type === 'date') {
            <div class="rule-block">
              <div class="rail-title">Date Bounds</div>
              <div class="prop-group">
                <label for="prop-mindate">Earliest date</label>
                <input
                  id="prop-mindate"
                  type="date"
                  class="ff-input mono"
                  [ngModel]="sel.validation?.minDate || ''"
                  (ngModelChange)="updateValidation({ minDate: $event || undefined })" />
              </div>
              <div class="prop-group">
                <label for="prop-maxdate">Latest date</label>
                <input
                  id="prop-maxdate"
                  type="date"
                  class="ff-input mono"
                  [ngModel]="sel.validation?.maxDate || ''"
                  (ngModelChange)="updateValidation({ maxDate: $event || undefined })" />
              </div>
            </div>
          }

          @if (sel.type === 'dropdown') {
            <div class="rule-block">
              <div class="rail-title">Dropdown Options</div>
              <div class="options-editor">
                @for (opt of sel.options || []; track $index) {
                  <div class="opt-row">
                    <input
                      type="text"
                      class="ff-input"
                      [attr.aria-label]="'Option ' + ($index + 1)"
                      [ngModel]="opt"
                      (ngModelChange)="updateOption($index, $event)" />
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Remove option"
                      [disabled]="(sel.options?.length || 0) <= 1"
                      (click)="removeOption($index)">
                      ×
                    </button>
                  </div>
                }
              </div>
              <div class="add-opt-row">
                <input
                  type="text"
                  class="ff-input"
                  [(ngModel)]="newOptionText"
                  (keyup.enter)="addOption()"
                  placeholder="Add choice..." />
                <button type="button" class="ff-btn" (click)="addOption()">Add</button>
              </div>
            </div>
          }

          @if (sel.type === 'signature') {
            <div class="rule-block">
              <div class="rail-title">Signature Verification</div>
              <p class="sig-note">
                Captures transparent PNG ink via pointer/touch canvas, verifies PNG binary headers server-side, and embeds signatures directly into ClosedXML Excel rows.
              </p>
            </div>
          }
          } @else {
            <div class="inspector-empty">
              <h3>Field Inspector</h3>
              <p>Select any field on the canvas to configure its label, schema key, required state, and validation rules.</p>
            </div>
          }
        }
      </aside>
    </div>
  `,
  styles: [`
    .studio-shell {
      display: grid;
      grid-template-columns: 280px 1fr 336px;
      flex: 1;
      min-height: calc(100vh - 58px);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
    .left-rail {
      background: var(--ff-bg-rail);
      border-right: 1px solid var(--ff-border);
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .rail-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .rail-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rail-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ff-ink-secondary);
    }
    .hint-text {
      font-size: 11px;
      color: var(--ff-ink-muted);
    }
    .mini-btn {
      height: 26px;
      padding: 0 8px;
      font-size: 12px;
    }
    .rail-link {
      font-size: 12px;
      font-weight: 600;
      color: var(--ff-accent);
      text-decoration: none;
    }
    .palette-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .palette-card {
      display: grid;
      grid-template-columns: 4px 1fr 28px;
      align-items: center;
      gap: 10px;
      background: var(--ff-bg-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius-md);
      padding: 10px 10px;
      cursor: grab;
      transition: border-color 150ms ease-out;
    }
    .palette-card:hover {
      border-color: var(--ff-border-strong);
    }
    .type-bar {
      width: 4px;
      align-self: stretch;
      min-height: 28px;
      border-radius: 2px;
    }
    .palette-name {
      font-size: 13px;
      font-weight: 600;
    }
    .palette-desc {
      font-size: 12px;
      color: var(--ff-ink-muted);
      line-height: 1.35;
      margin-top: 2px;
    }
    .add-field-btn {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: 1px solid var(--ff-border);
      background: var(--ff-bg-subtle);
      color: var(--ff-ink);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .add-field-btn:hover:not(:disabled) {
      background: var(--ff-accent-tint);
      border-color: var(--ff-accent);
      color: var(--ff-accent);
    }
    .tpl-mini-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tpl-mini-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius-sm);
      background: var(--ff-bg-surface);
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      color: var(--ff-ink);
      cursor: pointer;
      text-align: left;
    }
    .tpl-mini-row:hover:not(:disabled) {
      border-color: var(--ff-accent);
    }
    .tpl-clone-tag {
      font-size: 11px;
      color: var(--ff-accent);
    }
    .canvas-pane {
      padding: 20px 28px 48px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }
    .studio-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .toolbar-left,
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .code-chip {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      background: var(--ff-bg-surface);
      border: 1px solid var(--ff-border-strong);
      border-radius: 4px;
    }
    .mode-switch {
      display: inline-flex;
      border: 1px solid var(--ff-border-strong);
      border-radius: var(--ff-radius-sm);
      overflow: hidden;
      background: var(--ff-bg-surface);
    }
    .mode-btn {
      border: none;
      background: transparent;
      padding: 7px 12px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      color: var(--ff-ink-secondary);
      cursor: pointer;
    }
    .mode-btn.active {
      background: var(--ff-accent-tint);
      color: var(--ff-accent);
    }
    .banner-success {
      padding: 9px 14px;
      border: 1px solid var(--ff-success-border);
      background: var(--ff-success-bg);
      color: var(--ff-success);
      border-radius: var(--ff-radius-sm);
      font-size: 13px;
      font-weight: 600;
    }
    .banner-error {
      padding: 9px 14px;
      border: 1px solid var(--ff-danger-border);
      background: var(--ff-danger-bg);
      color: var(--ff-danger);
      border-radius: var(--ff-radius-sm);
      font-size: 13px;
      font-weight: 600;
    }
    .version-rail {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .rail-label {
      color: var(--ff-ink-muted);
      font-weight: 600;
    }
    .ver-chip {
      padding: 4px 10px;
      border: 1px solid var(--ff-border-strong);
      border-radius: var(--ff-radius-sm);
      background: var(--ff-bg-surface);
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      color: var(--ff-ink-secondary);
      cursor: pointer;
    }
    .ver-chip.active {
      border-color: var(--ff-accent);
      background: var(--ff-accent-tint);
      color: var(--ff-accent);
    }
    .ver-resp-link {
      margin-left: auto;
      font-weight: 600;
      color: var(--ff-accent);
      text-decoration: none;
    }
    .snapshot-notice {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--ff-warn-bg);
      border: 1px solid var(--ff-warn-border);
      border-radius: var(--ff-radius-sm);
      font-size: 13px;
      color: var(--ff-warn);
      flex-wrap: wrap;
    }
    .canvas-sheet {
      padding: 6px 4px 24px;
      max-width: 820px;
      width: 100%;
      margin: 0 auto;
    }
    .sheet-meta-edit {
      padding-bottom: 16px;
      border-bottom: 1px solid var(--ff-border);
      margin-bottom: 18px;
    }
    .title-input {
      width: 100%;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 4px 6px;
      margin-left: -6px;
      font-family: inherit;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ff-ink);
      background: transparent;
    }
    .title-input:hover:not(:disabled),
    .title-input:focus {
      border-color: var(--ff-border-strong);
      background: var(--ff-bg-subtle);
      outline: none;
    }
    .desc-input {
      width: 100%;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 4px 6px;
      margin: 4px 0 0 -6px;
      font-family: inherit;
      font-size: 13px;
      color: var(--ff-ink-secondary);
      background: transparent;
    }
    .desc-input:hover:not(:disabled),
    .desc-input:focus {
      border-color: var(--ff-border-strong);
      background: var(--ff-bg-subtle);
      outline: none;
    }
    .drop-canvas {
      min-height: 220px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .canvas-field {
      display: grid;
      grid-template-columns: 4px 1fr;
      gap: 14px;
      padding: 14px 16px;
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius-md);
      background: var(--ff-bg-surface);
      cursor: pointer;
      transition: border-color 150ms ease-out, background-color 150ms ease-out;
    }
    .canvas-field:hover {
      border-color: var(--ff-border-strong);
    }
    .canvas-field.selected {
      border-color: var(--ff-accent);
      background: #f5fbfb;
      box-shadow: 0 0 0 1px var(--ff-accent);
    }
    .field-main {
      min-width: 0;
    }
    .field-row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .field-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    .drag-handle {
      cursor: grab;
      color: var(--ff-ink-muted);
      letter-spacing: -2px;
      padding: 2px 4px;
      user-select: none;
    }
    .idx-num {
      font-size: 11px;
      color: var(--ff-ink-muted);
    }
    .req {
      color: var(--ff-danger);
    }
    .field-row-tools {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .key-badge {
      font-size: 11px;
      color: var(--ff-ink-muted);
      margin-right: 4px;
    }
    .type-badge {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--ff-bg-rail);
      border: 1px solid var(--ff-border);
      color: var(--ff-ink-secondary);
    }
    .icon-btn {
      width: 26px;
      height: 26px;
      border: 1px solid var(--ff-border);
      background: var(--ff-bg-surface);
      border-radius: 4px;
      color: var(--ff-ink-secondary);
      font-size: 13px;
      cursor: pointer;
    }
    .icon-btn:hover:not(:disabled) {
      background: var(--ff-bg-rail);
      color: var(--ff-ink);
    }
    .icon-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .icon-btn.danger:hover:not(:disabled) {
      background: var(--ff-danger-bg);
      color: var(--ff-danger);
      border-color: var(--ff-danger-border);
    }
    .field-preview-box {
      padding: 8px 0 0;
      margin-top: 4px;
      border-top: 1px dashed var(--ff-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: var(--ff-ink-muted);
    }
    .empty-canvas {
      padding: 44px 20px;
      text-align: center;
      border: 1px dashed var(--ff-border-strong);
      border-radius: var(--ff-radius-md);
      color: var(--ff-ink-secondary);
      background: var(--ff-bg-subtle);
    }
    .preview-head {
      padding-bottom: 16px;
      border-bottom: 1px solid var(--ff-border);
      margin-bottom: 18px;
    }
    .preview-head h2 {
      margin: 0;
      font-size: 22px;
    }
    .preview-head p {
      margin: 6px 0 0;
      color: var(--ff-ink-secondary);
    }
    .right-rail {
      background: var(--ff-bg-surface);
      border-left: 1px solid var(--ff-border);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .inspector-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--ff-border);
    }
    .prop-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .prop-group label {
      font-size: 12px;
      font-weight: 600;
      color: var(--ff-ink-secondary);
    }
    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-top: 1px solid var(--ff-border);
      border-bottom: 1px solid var(--ff-border);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .toggle-row input {
      width: 17px;
      height: 17px;
      accent-color: var(--ff-accent);
    }
    .rule-block {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 4px;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .options-editor {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .opt-row,
    .add-opt-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px;
      align-items: center;
    }
    .sig-note {
      margin: 0;
      font-size: 12px;
      color: var(--ff-ink-secondary);
      line-height: 1.5;
    }
    .inspector-empty {
      padding: 24px 8px;
      color: var(--ff-ink-secondary);
    }
    .inspector-empty h3 {
      margin: 0 0 6px;
      color: var(--ff-ink);
      font-size: 15px;
    }
    @media (max-width: 1120px) {
      .studio-shell {
        grid-template-columns: 1fr;
      }
      .left-rail {
        border-right: none;
        border-bottom: 1px solid var(--ff-border);
      }
      .right-rail {
        border-left: none;
        border-top: 1px solid var(--ff-border);
      }
      .canvas-pane {
        padding: 18px 14px 28px;
      }
      .canvas-sheet {
        padding: 18px 16px;
      }
    }
  `]
})
export class BuilderStudioPageComponent implements OnInit {
  private readonly api = inject(FormApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly paletteTypes: FieldTypeVisualMeta[] = REUSABLE_FIELD_TYPES;
  readonly forms = signal<FormSummary[]>([]);
  readonly templates = signal<StarterTemplate[]>([]);
  readonly activeFormId = signal<string>('');
  readonly formDetail = signal<FormDetail | null>(null);
  readonly title = signal('');
  readonly description = signal('');
  readonly fields = signal<FieldDefinition[]>([]);
  readonly selectedFieldId = signal<string | null>(null);
  readonly inspectingVersion = signal<FormVersionSummary | null>(null);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly publishing = signal(false);
  readonly cloningKey = signal<string | null>(null);
  readonly previewMode = signal(false);
  readonly dirty = signal(false);
  readonly copiedLink = signal(false);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  newOptionText = '';

  readonly displayedFields = computed(() =>
    this.inspectingVersion()?.schema.fields ?? this.fields()
  );

  readonly activeRenderSchema = computed<FormSchema>(() => ({
    fields: this.displayedFields()
  }));

  readonly selectedField = computed(() => {
    const id = this.selectedFieldId();
    return this.fields().find((f) => f.id === id) ?? null;
  });

  readonly nextVersionNumber = computed(() => {
    const versions = this.formDetail()?.versions ?? [];
    if (versions.length === 0) return 1;
    return Math.max(...versions.map((v) => v.versionNumber)) + 1;
  });

  accentFor = getFieldAccent;
  sanitizeKey = slugifyFieldKey;

  ngOnInit(): void {
    this.api.getTemplates().subscribe((t) => this.templates.set(t));

    this.route.paramMap.subscribe((params) => {
      const routeFormId = params.get('id');
      this.loadFormList(routeFormId);
    });
  }

  switchForm(formId: string): void {
    if (!formId) return;
    this.router.navigate(['/studio', formId]);
  }

  createBlankForm(): void {
    this.api.createForm({ title: 'Untitled Operational Form' }).subscribe({
      next: (created) => {
        this.router.navigate(['/studio', created.id]);
      },
      error: () => this.errorMessage.set('Could not create a new form.')
    });
  }

  cloneStarterTemplate(key: string): void {
    this.cloningKey.set(key);
    this.api.cloneTemplate(key).subscribe({
      next: (created) => {
        this.cloningKey.set(null);
        this.statusMessage.set(`Cloned template "${created.title}" into an editable draft.`);
        this.router.navigate(['/studio', created.id]);
      },
      error: () => {
        this.cloningKey.set(null);
        this.errorMessage.set('Failed to clone starter template.');
      }
    });
  }

  onCanvasDrop(event: CdkDragDrop<FieldDefinition[]>): void {
    if (this.inspectingVersion() !== null) return;
    const current = [...this.fields()];

    if (event.previousContainer === event.container) {
      moveItemInArray(current, event.previousIndex, event.currentIndex);
      this.fields.set(current);
    } else {
      const type = event.item.data as FieldType;
      const created = createFieldFromType(type, current);
      current.splice(event.currentIndex, 0, created);
      this.fields.set(current);
      this.selectedFieldId.set(created.id);
    }

    this.markDirty();
  }

  appendField(type: FieldType): void {
    if (this.inspectingVersion() !== null) return;
    const current = [...this.fields()];
    const created = createFieldFromType(type, current);
    current.push(created);
    this.fields.set(current);
    this.selectedFieldId.set(created.id);
    this.markDirty();
  }

  moveField(index: number, delta: number): void {
    const target = index + delta;
    const current = [...this.fields()];
    if (target < 0 || target >= current.length) return;
    moveItemInArray(current, index, target);
    this.fields.set(current);
    this.markDirty();
  }

  duplicateField(index: number): void {
    const current = [...this.fields()];
    const src = current[index];
    if (!src) return;
    const copy: FieldDefinition = {
      ...structuredClone(src),
      id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      key: `${src.key}_copy`,
      label: `${src.label} (Copy)`
    };
    current.splice(index + 1, 0, copy);
    this.fields.set(current);
    this.selectedFieldId.set(copy.id);
    this.markDirty();
  }

  removeField(index: number): void {
    const current = [...this.fields()];
    const removed = current.splice(index, 1)[0];
    this.fields.set(current);
    if (removed && this.selectedFieldId() === removed.id) {
      this.selectedFieldId.set(current[0]?.id ?? null);
    }
    this.markDirty();
  }

  onTitleChange(value: string): void {
    this.title.set(value);
    this.markDirty();
  }

  onDescChange(value: string): void {
    this.description.set(value);
    this.markDirty();
  }

  updateSelected(patch: Partial<FieldDefinition>): void {
    const id = this.selectedFieldId();
    if (!id) return;
    this.fields.update((list) =>
      list.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
    this.markDirty();
  }

  updateValidation(patch: Record<string, unknown>): void {
    const id = this.selectedFieldId();
    if (!id) return;
    this.fields.update((list) =>
      list.map((f) =>
        f.id === id ? { ...f, validation: { ...(f.validation ?? {}), ...patch } } : f
      )
    );
    this.markDirty();
  }

  updateOption(index: number, value: string): void {
    const sel = this.selectedField();
    if (!sel) return;
    const next = [...(sel.options ?? [])];
    next[index] = value;
    this.updateSelected({ options: next });
  }

  addOption(): void {
    const trimmed = this.newOptionText.trim();
    const sel = this.selectedField();
    if (!trimmed || !sel) return;
    const next = [...(sel.options ?? []), trimmed];
    this.newOptionText = '';
    this.updateSelected({ options: next });
  }

  removeOption(index: number): void {
    const sel = this.selectedField();
    if (!sel || (sel.options?.length ?? 0) <= 1) return;
    const next = (sel.options ?? []).filter((_, i) => i !== index);
    this.updateSelected({ options: next });
  }

  toNullableInt(val: unknown): number | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const num = Number(val);
    return Number.isFinite(num) ? num : undefined;
  }

  saveDraft(onSaved?: () => void): void {
    const id = this.activeFormId();
    if (!id) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    this.statusMessage.set(null);

    this.api.updateDraft(id, {
      title: this.title().trim() || 'Untitled Form',
      description: this.description().trim(),
      schema: { fields: this.fields() }
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dirty.set(false);
        this.statusMessage.set('Draft saved.');
        if (onSaved) onSaved();
        else this.refreshDetail(id);
      },
      error: (err) => {
        this.saving.set(false);
        const errs: string[] | undefined = err?.error?.errors;
        this.errorMessage.set(errs?.join(' ') || err?.error?.message || 'Failed to save draft.');
      }
    });
  }

  publishNewVersion(): void {
    const id = this.activeFormId();
    if (!id) return;

    const doPublish = () => {
      this.publishing.set(true);
      this.api.publishForm(id).subscribe({
        next: (ver) => {
          this.publishing.set(false);
          this.dirty.set(false);
          this.statusMessage.set(`Published immutable version v${ver.versionNumber}.`);
          this.loadFormList(id);
        },
        error: (err) => {
          this.publishing.set(false);
          const errs: string[] | undefined = err?.error?.errors;
          this.errorMessage.set(errs?.join(' ') || err?.error?.message || 'Failed to publish version.');
        }
      });
    };

    if (this.dirty()) {
      this.saveDraft(doPublish);
    } else {
      doPublish();
    }
  }

  copyShareLink(slug: string): void {
    const url = `${window.location.origin}/fill/${slug}`;
    navigator.clipboard?.writeText(url);
    this.copiedLink.set(true);
    setTimeout(() => this.copiedLink.set(false), 2000);
  }

  onPreviewValidated(): void {
    this.statusMessage.set('Preview validation passed against the current draft schema.');
  }

  private markDirty(): void {
    this.dirty.set(true);
    this.statusMessage.set(null);
    this.errorMessage.set(null);
  }

  private loadFormList(preferredId: string | null): void {
    this.api.listForms().subscribe({
      next: (list) => {
        this.forms.set(list);
        const targetId = preferredId && list.some((f) => f.id === preferredId)
          ? preferredId
          : list[0]?.id;
        if (targetId) {
          this.activeFormId.set(targetId);
          this.refreshDetail(targetId);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('Unable to connect to FormForge API. Ensure the .NET backend is running.');
        this.loading.set(false);
      }
    });
  }

  private refreshDetail(id: string): void {
    this.loading.set(this.formDetail()?.id !== id);
    this.api.getForm(id).subscribe({
      next: (detail) => {
        this.formDetail.set(detail);
        this.title.set(detail.title);
        this.description.set(detail.description);
        this.fields.set(structuredClone(detail.draftSchema.fields ?? []));
        this.selectedFieldId.set(detail.draftSchema.fields?.[0]?.id ?? null);
        this.inspectingVersion.set(null);
        this.dirty.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Failed to load form details.');
        this.loading.set(false);
      }
    });
  }
}
