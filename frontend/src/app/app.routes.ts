import { Routes } from '@angular/router';
import { BuilderStudioPageComponent } from './pages/builder-studio/builder-studio.component';
import { PublicFillPageComponent } from './pages/public-fill/public-fill.component';
import { ResponsesPageComponent } from './pages/responses/responses.component';
import { TemplatesGalleryPageComponent } from './pages/templates-gallery/templates-gallery.component';

export const routes: Routes = [
  { path: '', redirectTo: 'studio', pathMatch: 'full' },
  { path: 'studio', component: BuilderStudioPageComponent },
  { path: 'studio/:id', component: BuilderStudioPageComponent },
  { path: 'templates', component: TemplatesGalleryPageComponent },
  { path: 'responses', component: ResponsesPageComponent },
  { path: 'responses/:id', component: ResponsesPageComponent },
  { path: 'fill/:slug', component: PublicFillPageComponent },
  { path: '**', redirectTo: 'studio' }
];
