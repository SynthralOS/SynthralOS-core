export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    email?: boolean;
    inApp?: boolean;
    workflowCompleted?: boolean;
    workflowFailed?: boolean;
    alertTriggered?: boolean;
  };
  language?: string;
  timezone?: string;
  dateFormat?: string;
  [key: string]: unknown; // Allow additional preferences
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  emailVerified: boolean;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer' | 'guest';
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

