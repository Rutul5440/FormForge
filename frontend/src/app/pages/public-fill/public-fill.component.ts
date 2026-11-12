import { DatePipe } from '@angular/common';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicFormPayload, SubmissionReceipt } from '../../core/models/form.models';
import { FormApiService } from '../../core/services/form-api.service';
import { DynamicFormRendererComponent } from '../../shared/dynamic-form-renderer/dynamic-form-renderer.component';

@Component({
  selector: 'app-public-fill-page',
  standalone: true,
  imports: [DatePipe, RouterLink, DynamicFormRendererComponent],
  template: `
    <div class="fill-backdrop">
      <div class="fill-container">
        @if (loading()) {
          <div class="fill-sheet">
            <div class="ff-skeleton" style="height: 28px; width: 60%;"></div>
            <div class="ff-skeleton" style="height: 18px; width: 40%; margin-top: 10px;"></div>
            <div class="ff-skeleton" style="height: 74px; width: 100%; margin-top: 24px;"></div>
            <div class="ff-skeleton" style="height: 74px; width: 100%; margin-top: 14px;"></div>
          </div>
        } @else if (notFound()) {
          <div class="fill-sheet empty-sheet">
            <h1>Form Unavailable</h1>
            <p>This form does not exist or has not been published yet.</p>
            <a routerLink="/studio" class="ff-btn ff-btn-primary">Return to Form Studio</a>
          </div>
        } @else {
          @if (receipt(); as rec) {
            <div class="fill-sheet receipt-sheet" role="status">
              <div class="receipt-badge">Submission Verified</div>
              <h1>{{ form()!.title }}</h1>
              <p class="receipt-sub">
                Your response was validated server-side against immutable schema
                <span class="mono">v{{ rec.versionNumber }}</span> and recorded.
              </p>
              <dl class="receipt-meta">
                <div>
                  <dt>Response ID</dt>
                  <dd class="mono">{{ rec.responseId }}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd class="mono">{{ rec.submittedAt | date: 'medium' }}</dd>
                </div>
              </dl>
              <div class="receipt-actions">
                <button type="button" class="ff-btn ff-btn-primary" (click)="resetForAnother()">
                  Submit Another Response
                </button>
                <a [routerLink]="['/responses', form()!.id]" class="ff-btn">View in Responses</a>
              </div>
            </div>
          } @else {
            @if (form(); as f) {
            <div class="fill-sheet">
              <header class="sheet-head">
                <div class="sheet-badges">
                  <span class="mono code-chip">{{ f.catalogCode }}</span>
                  <span class="ff-pill ff-pill-published mono">v{{ f.versionNumber }} Published</span>
                </div>
                <h1>{{ f.title }}</h1>
                @if (f.description) {
                  <p class="sheet-desc">{{ f.description }}</p>
                }
              </header>

              @if (bannerError()) {
                <div class="alert-error" role="alert">{{ bannerError() }}</div>
              }

              <app-dynamic-form-renderer
                [schema]="f.schema"
                [submitting]="submitting()"
                [serverErrors]="serverErrors()"
                submitLabel="Submit Form"
                (submitted)="handleSubmit($event)" />
            </div>
            }
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .fill-backdrop {
      flex: 1;
      background: var(--ff-bg-canvas);
      padding: 32px 16px 56px;
    }
    .fill-container {
      max-width: 720px;
      margin: 0 auto;
    }
    .fill-sheet {
      background: var(--ff-bg-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius-lg);
      padding: 28px 32px;
    }
    .sheet-head {
      padding-bottom: 18px;
      border-bottom: 1px solid var(--ff-border);
      margin-bottom: 22px;
    }
    .sheet-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .code-chip {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      background: var(--ff-bg-rail);
      border: 1px solid var(--ff-border);
      color: var(--ff-ink-secondary);
    }
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .sheet-desc {
      margin: 8px 0 0;
      color: var(--ff-ink-secondary);
      max-width: 65ch;
    }
    .alert-error {
      padding: 10px 14px;
      margin-bottom: 16px;
      background: var(--ff-danger-bg);
      border: 1px solid var(--ff-danger-border);
      color: var(--ff-danger);
      border-radius: var(--ff-radius-sm);
      font-size: 13px;
      font-weight: 600;
    }
    .empty-sheet,
    .receipt-sheet {
      text-align: left;
    }
    .receipt-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      color: var(--ff-success);
      background: var(--ff-success-bg);
      border: 1px solid var(--ff-success-border);
      padding: 4px 10px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .receipt-sub {
      color: var(--ff-ink-secondary);
      margin: 8px 0 18px;
    }
    .receipt-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 14px;
      background: var(--ff-bg-subtle);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius-sm);
      margin: 0 0 20px;
    }
    .receipt-meta dt {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--ff-ink-muted);
    }
    .receipt-meta dd {
      margin: 4px 0 0;
      font-size: 13px;
      word-break: break-all;
    }
    .receipt-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    @media (max-width: 600px) {
      .fill-sheet {
        padding: 20px 16px;
      }
      .receipt-meta {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PublicFillPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(FormApiService);

  @ViewChild(DynamicFormRendererComponent) renderer?: DynamicFormRendererComponent;

  readonly form = signal<PublicFormPayload | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly submitting = signal(false);
  readonly bannerError = signal<string | null>(null);
  readonly serverErrors = signal<Record<string, string>>({});
  readonly receipt = signal<SubmissionReceipt | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (!slug) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.loadForm(slug);
    });
  }

  handleSubmit(answers: Record<string, unknown>): void {
    const current = this.form();
    if (!current) return;

    this.submitting.set(true);
    this.bannerError.set(null);
    this.serverErrors.set({});

    this.api.submitPublicResponse(current.slug, answers).subscribe({
      next: (rec) => {
        this.submitting.set(false);
        this.receipt.set(rec);
      },
      error: (err) => {
        this.submitting.set(false);
        const body = err?.error;
        if (body?.errors && typeof body.errors === 'object') {
          this.serverErrors.set(body.errors);
          this.bannerError.set(body.message || 'Server validation rejected one or more fields.');
        } else {
          this.bannerError.set('Unable to submit response right now. Please try again.');
        }
      }
    });
  }

  resetForAnother(): void {
    this.receipt.set(null);
    this.serverErrors.set({});
    this.bannerError.set(null);
    setTimeout(() => this.renderer?.resetForm());
  }

  private loadForm(slug: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.receipt.set(null);
    this.api.getPublicForm(slug).subscribe({
      next: (data) => {
        this.form.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      }
    });
  }
}
