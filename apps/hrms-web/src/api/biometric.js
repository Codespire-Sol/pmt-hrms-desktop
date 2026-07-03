import apiClient from './axios';

const BASE = '/biometric';

export const biometricAPI = {
  /** GET /biometric/mappings — returns { mapped: [], unmapped: [] } */
  getMappings() {
    return apiClient.get(`${BASE}/mappings`).then(r => r.data);
  },

  /** POST /biometric/mappings — create or update mapping */
  setMapping(employeeId, deviceId) {
    return apiClient.post(`${BASE}/mappings`, { employeeId, deviceId }).then(r => r.data);
  },

  /** DELETE /biometric/mappings/:employeeId — remove mapping */
  removeMapping(employeeId) {
    return apiClient.delete(`${BASE}/mappings/${employeeId}`).then(r => r.data);
  },
};
