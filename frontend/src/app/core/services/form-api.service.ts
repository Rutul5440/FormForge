import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  FieldTypeDescriptor,
  FormDetail,
  FormSchema,
  FormSummary,
  PublicFormPayload,
  ResponsesPayload,
  StarterTemplate,
  SubmissionReceipt
} from '../models/form.models';

@Injectable({ providedIn: 'root' })
export class FormApiService {
  private readonly http = inject(HttpClient);

  getFieldTypes(): Observable<FieldTypeDescriptor[]> {
    return this.http.get<FieldTypeDescriptor[]>('/api/field-types');
  }

  getTemplates(): Observable<StarterTemplate[]> {
    return this.http.get<StarterTemplate[]>('/api/templates');
  }

  cloneTemplate(key: string): Observable<{ id: string; slug: string; catalogCode: string; title: string }> {
    return this.http.post<{ id: string; slug: string; catalogCode: string; title: string }>(
      `/api/templates/${encodeURIComponent(key)}/clone`,
      {}
    );
  }

  listForms(): Observable<FormSummary[]> {
    return this.http.get<FormSummary[]>('/api/forms');
  }

  createForm(payload: { title: string; description?: string; schema?: FormSchema }): Observable<{ id: string; slug: string }> {
    return this.http.post<{ id: string; slug: string }>('/api/forms', payload);
  }

  getForm(id: string): Observable<FormDetail> {
    return this.http.get<FormDetail>(`/api/forms/${id}`);
  }

  updateDraft(id: string, payload: { title: string; description: string; schema: FormSchema }): Observable<{ hasUnpublishedChanges: boolean }> {
    return this.http.put<{ hasUnpublishedChanges: boolean }>(`/api/forms/${id}/draft`, payload);
  }

  publishForm(id: string): Observable<{ id: string; versionNumber: number; publishedAt: string }> {
    return this.http.post<{ id: string; versionNumber: number; publishedAt: string }>(`/api/forms/${id}/publish`, {});
  }

  deleteForm(id: string): Observable<void> {
    return this.http.delete<void>(`/api/forms/${id}`);
  }

  getResponses(formId: string, versionId?: string): Observable<ResponsesPayload> {
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
    return this.http.get<ResponsesPayload>(`/api/forms/${formId}/responses${query}`);
  }

  exportUrl(formId: string, versionId?: string): string {
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
    return `/api/forms/${formId}/export${query}`;
  }

  getPublicForm(slug: string): Observable<PublicFormPayload> {
    return this.http.get<PublicFormPayload>(`/api/public/forms/${encodeURIComponent(slug)}`);
  }

  submitPublicResponse(slug: string, answers: Record<string, unknown>): Observable<SubmissionReceipt> {
    return this.http.post<SubmissionReceipt>(
      `/api/public/forms/${encodeURIComponent(slug)}/responses`,
      { answers }
    );
  }
}
