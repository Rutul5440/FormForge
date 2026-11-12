export type FieldType = 'text' | 'date' | 'dropdown' | 'signature';

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  multiline?: boolean;
  minDate?: string;
  maxDate?: string;
}

export interface FieldDefinition {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  validation?: FieldValidation;
}

export interface FormSchema {
  fields: FieldDefinition[];
}

export interface FieldTypeDescriptor {
  type: FieldType;
  displayName: string;
  description: string;
  accentColor: string;
  defaultLabel: string;
  supportsOptions: boolean;
  defaultOptions?: string[];
}

export interface StarterTemplate {
  key: string;
  title: string;
  category: string;
  description: string;
  schema: FormSchema;
}

export interface FormSummary {
  id: string;
  catalogCode: string;
  slug: string;
  title: string;
  description: string;
  activeVersionId?: string | null;
  activeVersionNumber?: number | null;
  totalVersions: number;
  totalResponses: number;
  hasUnpublishedChanges: boolean;
  updatedAt: string;
}

export interface FormVersionSummary {
  id: string;
  versionNumber: number;
  isPublished: boolean;
  publishedAt: string;
  responseCount: number;
  schema: FormSchema;
}

export interface FormDetail {
  id: string;
  catalogCode: string;
  slug: string;
  title: string;
  description: string;
  activeVersionId?: string | null;
  activeVersionNumber?: number | null;
  hasUnpublishedChanges: boolean;
  draftSchema: FormSchema;
  versions: FormVersionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicFormPayload {
  id: string;
  catalogCode: string;
  slug: string;
  title: string;
  description: string;
  versionId: string;
  versionNumber: number;
  publishedAt: string;
  schema: FormSchema;
}

export interface SubmissionReceipt {
  responseId: string;
  versionId: string;
  versionNumber: number;
  submittedAt: string;
}

export interface ResponseRecord {
  id: string;
  formVersionId: string;
  submittedAt: string;
  answers: Record<string, unknown>;
}

export interface ResponsesPayload {
  id: string;
  title: string;
  catalogCode: string;
  slug: string;
  selectedVersion: {
    id: string;
    versionNumber: number;
    publishedAt: string;
  } | null;
  versions: {
    id: string;
    versionNumber: number;
    publishedAt: string;
    isActive: boolean;
    responseCount: number;
  }[];
  fields: FieldDefinition[];
  responses: ResponseRecord[];
}
