import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormSummary, ResponsesPayload } from '../../core/models/form.models';
import { FormApiService } from '../../core/services/form-api.service';

@Component({
  selector: 'app-responses-page',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <section class="page-wrap">
      <header class="page-head">
        <div>
          <h1>Responses &amp; Versioned Excel Export</h1>
          <p class="subtitle">
            Switch between immutable schema versions to inspect historical answers with exact version columns and export formatted <span class="mono">.xlsx</span> workbooks.
          </p>
        </div>

        <div class="head-controls">
          <label class="sr-only" for="form-picker">Select form</label>
          <select
            id="form-picker"
            class="ff-select form-picker"
            [value]="selectedFormId()"
            (change)="onFormSelect($event)">
            @for (f of forms(); track f.id) {
              <option [value]="f.id">{{ f.catalogCode }} · {{ f.title }} ({{ f.totalResponses }})</option>
            }
          </select>

          @if (payload(); as p) {
            @if (p.selectedVersion) {
              <a
                class="ff-btn ff-btn-primary"
                [href]="exportLink(p.id, p.selectedVersion.id)"
                download>
                Export v{{ p.selectedVersion.versionNumber }} .xlsx
              </a>
            }
          }
        </div>
      </header>

      @if (error()) {
        <div class="alert-error" role="alert">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="table-card">
          <div class="ff-skeleton" style="height: 38px; width: 100%; margin-bottom: 12px;"></div>
          <div class="ff-skeleton" style="height: 44px; width: 100%; margin-bottom: 8px;"></div>
          <div class="ff-skeleton" style="height: 44px; width: 100%;"></div>
        </div>
      } @else {
        @if (payload(); as p) {
        @if (p.versions.length === 0) {
          <div class="empty-card">
            <h2>No Published Versions Yet</h2>
            <p>Publish version 1 of <strong>{{ p.title }}</strong> in Builder Studio to start collecting and exporting responses.</p>
            <a [routerLink]="['/studio', p.id]" class="ff-btn ff-btn-primary">Open in Builder Studio</a>
          </div>
        } @else {
          <div class="version-bar" role="tablist" aria-label="Form versions">
            <span class="bar-label">Schema Version:</span>
            @for (v of p.versions; track v.id) {
              <button
                type="button"
                role="tab"
                class="ver-tab"
                [class.active]="p.selectedVersion?.id === v.id"
                [attr.aria-selected]="p.selectedVersion?.id === v.id"
                (click)="selectVersion(p.id, v.id)">
                <span class="mono">v{{ v.versionNumber }}</span>
                <span class="ver-count tabular">{{ v.responseCount }}</span>
                @if (v.isActive) {
                  <span class="active-dot" title="Currently active public version">Active</span>
                }
              </button>
            }
            <a [routerLink]="['/fill', p.slug]" class="ff-btn ff-btn-ghost open-fill-link">
              Open Public Fill Form ↗
            </a>
          </div>

          <div class="table-card">
            @if (p.responses.length === 0) {
              <div class="empty-inline">
                <p>No responses recorded for <span class="mono">v{{ p.selectedVersion?.versionNumber }}</span> yet.</p>
                <a [routerLink]="['/fill', p.slug]" class="ff-btn">Submit First Response</a>
              </div>
            } @else {
              <div class="table-scroll">
                <table class="resp-table">
                  <thead>
                    <tr>
                      <th>Response ID</th>
                      <th>Submitted (UTC)</th>
                      @for (col of p.fields; track col.id) {
                        <th>
                          <span>{{ col.label }}</span>
                          <span class="mono th-type">{{ col.type }}</span>
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of p.responses; track row.id) {
                      <tr>
                        <td class="mono id-cell">{{ row.id.slice(0, 8).toUpperCase() }}</td>
                        <td class="mono time-cell">{{ row.submittedAt | date: 'yyyy-MM-dd HH:mm' : 'UTC' }}</td>
                        @for (col of p.fields; track col.id) {
                          <td>
                            @if (col.type === 'signature') {
                              @if (signatureUri(row.answers[col.key || col.id]); as sig) {
                                <button
                                  type="button"
                                  class="sig-thumb-btn"
                                  (click)="previewSignature(sig, col.label)">
                                  <img [src]="sig" alt="Captured signature thumbnail" class="sig-thumb" />
                                </button>
                              } @else {
                                <span class="muted">—</span>
                              }
                            } @else if (col.type === 'dropdown') {
                              @if (stringValue(row.answers[col.key || col.id]); as val) {
                                <span class="choice-badge">{{ val }}</span>
                              } @else {
                                <span class="muted">—</span>
                              }
                            } @else {
                              <span>{{ stringValue(row.answers[col.key || col.id]) || '—' }}</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
        }
      }
    </section>

    <dialog #sigDialog class="sig-dialog" aria-label="Signature preview">
      <div class="dialog-head">
        <strong>{{ previewLabel() }}</strong>
        <button type="button" class="ff-btn ff-btn-ghost" (click)="closePreview()">Close</button>
      </div>
      @if (previewUri(); as uri) {
        <img [src]="uri" alt="Full size respondent signature" class="dialog-img" />
      }
    </dialog>
  `,
  styles: [`
    .page-wrap {
      max-width: 1360px;
      width: 100%;
      margin: 0 auto;
      padding: 28px 24px 48px;
    }
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--ff-border);
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font-size: 23px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin: 5px 0 0;
      color: var(--ff-ink-secondary);
      max-width: 68ch;
    }
    .head-controls {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .form-picker {
      min-width: 280px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
    .version-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .bar-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--ff-ink-muted);
      margin-right: 4px;
    }
    .ver-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: var(--ff-radius-sm);
      border: 1px solid var(--ff-border-strong);
      background: var(--ff-bg-surface);
      color: var(--ff-ink-secondary);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .ver-tab.active {
      border-color: var(--ff-accent);
      background: var(--ff-accent-tint);
      color: var(--ff-accent);
    }
    .ver-count {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--ff-bg-rail);
      color: var(--ff-ink);
    }
    .active-dot {
      font-size: 11px;
      color: var(--ff-success);
      font-weight: 700;
    }
    .open-fill-link {
      margin-left: auto;
    }
    .table-card,
    .empty-card {
      background: var(--ff-bg-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius-md);
      padding: 18px;
    }
    .empty-card,
    .empty-inline {
      text-align: center;
      padding: 36px 20px;
      color: var(--ff-ink-secondary);
    }
    .table-scroll {
      overflow-x: auto;
    }
    .resp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .resp-table th {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid var(--ff-border-strong);
      background: var(--ff-bg-rail);
      font-weight: 700;
      color: var(--ff-ink);
      white-space: nowrap;
    }
    .th-type {
      display: inline-block;
      margin-left: 6px;
      font-size: 11px;
      font-weight: 500;
      color: var(--ff-ink-muted);
    }
    .resp-table td {
      padding: 11px 12px;
      border-bottom: 1px solid var(--ff-border);
      vertical-align: middle;
    }
    .id-cell {
      font-size: 12px;
      color: var(--ff-ink-secondary);
    }
    .time-cell {
      font-size: 12px;
      color: var(--ff-ink-secondary);
      white-space: nowrap;
    }
    .choice-badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .sig-thumb-btn {
      padding: 2px 4px;
      border: 1px solid var(--ff-border);
      background: #ffffff;
      border-radius: 4px;
      cursor: zoom-in;
    }
    .sig-thumb {
      display: block;
      height: 30px;
      width: auto;
      max-width: 120px;
    }
    .muted {
      color: var(--ff-ink-muted);
    }
    .alert-error {
      padding: 10px 14px;
      margin-bottom: 14px;
      background: var(--ff-danger-bg);
      border: 1px solid var(--ff-danger-border);
      color: var(--ff-danger);
      border-radius: var(--ff-radius-sm);
      font-weight: 600;
    }
    .sig-dialog {
      border: 1px solid var(--ff-border-strong);
      border-radius: var(--ff-radius-md);
      padding: 18px;
      background: var(--ff-bg-surface);
      max-width: 540px;
      width: 92vw;
    }
    .sig-dialog::backdrop {
      background: rgba(15, 23, 42, 0.35);
    }
    .dialog-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .dialog-img {
      display: block;
      width: 100%;
      border: 1px solid var(--ff-border);
      border-radius: 4px;
      background: #ffffff;
    }
  `]
})
export class ResponsesPageComponent implements OnInit {
  private readonly api = inject(FormApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('sigDialog') sigDialog?: ElementRef<HTMLDialogElement>;

  readonly forms = signal<FormSummary[]>([]);
  readonly selectedFormId = signal<string>('');
  readonly payload = signal<ResponsesPayload | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly previewUri = signal<string | null>(null);
  readonly previewLabel = signal<string>('');

  ngOnInit(): void {
    this.api.listForms().subscribe({
      next: (list) => {
        this.forms.set(list);
        const routeId = this.route.snapshot.paramMap.get('id');
        const targetId = routeId && list.some((f) => f.id === routeId) ? routeId : list[0]?.id;
        if (targetId) {
          this.selectedFormId.set(targetId);
          this.loadResponses(targetId);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.error.set('Could not load forms list.');
        this.loading.set(false);
      }
    });
  }

  onFormSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedFormId.set(id);
    this.router.navigate(['/responses', id]);
    this.loadResponses(id);
  }

  selectVersion(formId: string, versionId: string): void {
    this.loadResponses(formId, versionId);
  }

  exportLink(formId: string, versionId: string): string {
    return this.api.exportUrl(formId, versionId);
  }

  stringValue(val: unknown): string {
    return typeof val === 'string' ? val : val == null ? '' : String(val);
  }

  signatureUri(val: unknown): string | null {
    return typeof val === 'string' && val.startsWith('data:image/png;base64,') ? val : null;
  }

  previewSignature(uri: string, label: string): void {
    this.previewUri.set(uri);
    this.previewLabel.set(label);
    this.sigDialog?.nativeElement.showModal();
  }

  closePreview(): void {
    this.sigDialog?.nativeElement.close();
  }

  private loadResponses(formId: string, versionId?: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getResponses(formId, versionId).subscribe({
      next: (data) => {
        this.payload.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load responses for this form.');
        this.loading.set(false);
      }
    });
  }
}
