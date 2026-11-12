import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StarterTemplate } from '../../core/models/form.models';
import { getFieldAccent } from '../../core/registry/field-registry';
import { FormApiService } from '../../core/services/form-api.service';

@Component({
  selector: 'app-templates-gallery',
  standalone: true,
  template: `
    <section class="page-wrap">
      <header class="page-head">
        <div>
          <h1>Starter Template Gallery</h1>
          <p class="subtitle">
            Clone any ready-made operational template into an editable draft in Builder Studio—no setup from scratch required.
          </p>
        </div>
        <button type="button" class="ff-btn ff-btn-primary" [disabled]="creatingBlank()" (click)="createBlankForm()">
          {{ creatingBlank() ? 'Creating...' : '+ Start Blank Form' }}
        </button>
      </header>

      @if (error()) {
        <div class="alert-error" role="alert">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="template-grid">
          @for (item of [1, 2, 3, 4, 5]; track item) {
            <div class="tpl-card skeleton-card">
              <div class="ff-skeleton" style="height: 22px; width: 55%;"></div>
              <div class="ff-skeleton" style="height: 44px; width: 100%; margin-top: 12px;"></div>
              <div class="ff-skeleton" style="height: 36px; width: 100%; margin-top: 18px;"></div>
            </div>
          }
        </div>
      } @else {
        <div class="template-grid">
          @for (tpl of templates(); track tpl.key) {
            <article class="tpl-card">
              <div class="tpl-top">
                <span class="cat-badge">{{ tpl.category }}</span>
                <span class="mono field-count">{{ tpl.schema.fields.length }} fields</span>
              </div>

              <h2>{{ tpl.title }}</h2>
              <p class="tpl-desc">{{ tpl.description }}</p>

              <ul class="field-preview-list" aria-label="Included fields">
                @for (f of tpl.schema.fields; track f.id) {
                  <li class="field-preview-item">
                    <span class="mini-tab" [style.background]="accentFor(f.type)"></span>
                    <span class="f-label">{{ f.label }}</span>
                    <span class="mono f-type">{{ f.type }}</span>
                  </li>
                }
              </ul>

              <div class="tpl-actions">
                <button
                  type="button"
                  class="ff-btn ff-btn-primary clone-btn"
                  [disabled]="cloningKey() === tpl.key"
                  (click)="cloneTemplate(tpl.key)">
                  {{ cloningKey() === tpl.key ? 'Cloning into Studio...' : 'Clone into Studio' }}
                </button>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .page-wrap {
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 24px 48px;
    }
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--ff-border);
      margin-bottom: 26px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin: 6px 0 0;
      color: var(--ff-ink-secondary);
      max-width: 66ch;
    }
    .alert-error {
      padding: 12px 16px;
      border: 1px solid var(--ff-danger-border);
      background: var(--ff-danger-bg);
      color: var(--ff-danger);
      border-radius: var(--ff-radius-sm);
      margin-bottom: 20px;
      font-weight: 600;
    }
    .template-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 18px;
    }
    .tpl-card {
      background: var(--ff-bg-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius-md);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 160ms ease-out;
    }
    .tpl-card:hover {
      border-color: var(--ff-border-strong);
    }
    .skeleton-card {
      min-height: 280px;
    }
    .tpl-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cat-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--ff-accent);
      background: var(--ff-accent-tint);
      padding: 3px 8px;
      border-radius: 4px;
    }
    .field-count {
      font-size: 12px;
      color: var(--ff-ink-muted);
    }
    .tpl-card h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }
    .tpl-desc {
      margin: 0;
      font-size: 13px;
      color: var(--ff-ink-secondary);
      min-height: 38px;
    }
    .field-preview-list {
      list-style: none;
      padding: 0;
      margin: 4px 0 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field-preview-item {
      display: grid;
      grid-template-columns: 4px 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      background: var(--ff-bg-subtle);
      border: 1px solid var(--ff-border);
      border-radius: 4px;
      font-size: 13px;
    }
    .mini-tab {
      height: 16px;
      border-radius: 2px;
    }
    .f-label {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .f-type {
      font-size: 11px;
      color: var(--ff-ink-muted);
    }
    .tpl-actions {
      margin-top: auto;
      padding-top: 8px;
    }
    .clone-btn {
      width: 100%;
    }
  `]
})
export class TemplatesGalleryPageComponent implements OnInit {
  private readonly api = inject(FormApiService);
  private readonly router = inject(Router);

  readonly templates = signal<StarterTemplate[]>([]);
  readonly loading = signal(true);
  readonly cloningKey = signal<string | null>(null);
  readonly creatingBlank = signal(false);
  readonly error = signal<string | null>(null);

  accentFor = getFieldAccent;

  ngOnInit(): void {
    this.api.getTemplates().subscribe({
      next: (list) => {
        this.templates.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load starter templates from the API.');
        this.loading.set(false);
      }
    });
  }

  cloneTemplate(key: string): void {
    this.cloningKey.set(key);
    this.error.set(null);
    this.api.cloneTemplate(key).subscribe({
      next: (created) => {
        this.cloningKey.set(null);
        this.router.navigate(['/studio', created.id]);
      },
      error: () => {
        this.error.set('Failed to clone template. Check that the backend API is running.');
        this.cloningKey.set(null);
      }
    });
  }

  createBlankForm(): void {
    this.creatingBlank.set(true);
    this.error.set(null);
    this.api.createForm({ title: 'Untitled Operational Form' }).subscribe({
      next: (created) => {
        this.creatingBlank.set(false);
        this.router.navigate(['/studio', created.id]);
      },
      error: () => {
        this.error.set('Failed to create a blank form.');
        this.creatingBlank.set(false);
      }
    });
  }
}
