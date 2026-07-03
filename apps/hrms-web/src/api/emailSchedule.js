import apiClient from './axios';

const normalizeResponse = (res) => res.data;

export const emailScheduleApi = {
  getAll:   ()           => apiClient.get('/email-schedule').then(normalizeResponse),
  getOne:   (type)       => apiClient.get(`/email-schedule/${type}`).then(normalizeResponse),
  update:   (type, data) => apiClient.patch(`/email-schedule/${type}`, data).then(normalizeResponse),
  trigger:  (type)       => apiClient.post(`/email-schedule/${type}/trigger`).then(normalizeResponse),
};
