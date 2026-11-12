import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'studio', pathMatch: 'full' },
  { path: '**', redirectTo: 'studio' }
];
