export type LeadStatus = 'new' | 'follow_up' | 'qualified' | 'won' | 'lost';

export interface Lead {
  id: string;
  leadKey: string;
  name: string;
  company?: string | null;
  source?: string | null;
  status: LeadStatus;
  remarks?: string | null;
  followUpDate?: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeadInput {
  name: string;
  company?: string;
  source?: string;
  status?: LeadStatus;
  remarks?: string;
  followUpDate?: Date | null;
}

export interface UpdateLeadInput {
  name?: string;
  company?: string | null;
  source?: string | null;
  status?: LeadStatus;
  remarks?: string | null;
  followUpDate?: Date | null;
}
