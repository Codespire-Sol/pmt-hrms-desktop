import apiClient from './axios';

import { useAuthStore } from '../store/authStore';
import { normalizeRoleName } from '../utils/auth';

export const settingsAPI = {
    // Profile Settings
    getProfile: () => {
        const user = useAuthStore.getState().user;
        const role = normalizeRoleName(user?.role);

        if (role === 'manager') return apiClient.get('/manager/me/profile');
        // Admin, HR, Employee all use the employee profile endpoint
        return apiClient.get('/employee/me/profile');
    },

    updateProfile: (profileData) => {
        const user = useAuthStore.getState().user;
        const role = normalizeRoleName(user?.role);

        if (role === 'manager') return apiClient.patch('/manager/me/profile', profileData);
        // Admin, HR, Employee all use the employee profile endpoint
        return apiClient.patch('/employee/me/profile', profileData);
    },

    // Notification Preferences
    getNotificationPreferences: () => apiClient.get('/notifications/preferences'),

    updateNotificationPreferences: (preferences) =>
        apiClient.put('/notifications/preferences', { preferences }),

    // Avatar Management
    uploadAvatar: (file) => {
        const formData = new FormData();
        formData.append('avatar', file);

        return apiClient.post('/users/me/avatar/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    // Self-service Documents
    getMyDocuments: () => apiClient.get('/employee/me/documents'),
    uploadMyDocument: (file, documentType) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', documentType);
        return apiClient.post('/employee/me/documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};
