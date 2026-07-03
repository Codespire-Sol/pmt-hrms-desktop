import { ApiError } from '../../utils/ApiError';
import { LeadsRepository } from './leads.repository';
import { CreateLeadInput, UpdateLeadInput } from './leads.types';

export class LeadsService {
  private leadsRepository: LeadsRepository;

  constructor() {
    this.leadsRepository = new LeadsRepository();
  }

  async createLead(input: CreateLeadInput, userId: string) {
    return this.leadsRepository.create(input, userId);
  }

  async getLeads() {
    return this.leadsRepository.findAll();
  }

  async getLead(leadId: string) {
    const lead = await this.leadsRepository.findById(leadId);
    if (!lead) throw ApiError.notFound('Lead not found');
    return lead;
  }

  async updateLead(leadId: string, input: UpdateLeadInput) {
    const lead = await this.leadsRepository.findById(leadId);
    if (!lead) throw ApiError.notFound('Lead not found');
    return this.leadsRepository.update(leadId, input);
  }

  async deleteLead(leadId: string) {
    const lead = await this.leadsRepository.findById(leadId);
    if (!lead) throw ApiError.notFound('Lead not found');
    await this.leadsRepository.delete(leadId);
  }
}
