import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" routerLink="/studio">
          <span class="brand-mark" aria-hidden="true">FF</span>
          <span class="brand-text">FormForge</span>
        </a>

        <nav class="main-nav" aria-label="Primary navigation">
          <a routerLink="/studio" routerLinkActive="active">Builder Studio</a>
          <a routerLink="/templates" routerLinkActive="active">Starter Templates</a>
          <a routerLink="/responses" routerLinkActive="active">Responses &amp; Export</a>
        </nav>

        <div class="top-meta">
          <span class="mono env-tag">Metadata Engine</span>
        </div>
      </header>

      <main class="app-main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--ff-bg-canvas);
    }
    .topbar {
      height: 58px;
      background: var(--ff-bg-surface);
      border-bottom: 1px solid var(--ff-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      gap: 20px;
      position: sticky;
      top: 0;
      z-index: 30;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--ff-ink);
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.015em;
    }
    .brand-mark {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: var(--ff-accent);
      color: #ffffff;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .main-nav {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .main-nav a {
      text-decoration: none;
      color: var(--ff-ink-secondary);
      font-size: 13px;
      font-weight: 600;
      padding: 7px 14px;
      border-radius: 6px;
      transition: background-color 150ms ease-out, color 150ms ease-out;
    }
    .main-nav a:hover {
      background: var(--ff-bg-rail);
      color: var(--ff-ink);
    }
    .main-nav a.active {
      background: var(--ff-accent-tint);
      color: var(--ff-accent);
    }
    .env-tag {
      font-size: 11px;
      color: var(--ff-ink-muted);
      border: 1px solid var(--ff-border);
      background: var(--ff-bg-subtle);
      padding: 4px 9px;
      border-radius: 4px;
    }
    .app-main {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    @media (max-width: 760px) {
      .topbar {
        padding: 0 14px;
        gap: 10px;
      }
      .top-meta {
        display: none;
      }
      .main-nav a {
        padding: 6px 10px;
        font-size: 12px;
      }
    }
  `]
})
export class AppComponent {}
