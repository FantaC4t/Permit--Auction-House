import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',  // Make sure this matches your backend
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const apiService = {
  async login(username, password) {
    try {
      const response = await api.post('/auth/login', { username, password });
      console.log('Login response:', response.data); // Debug log
      return response.data;
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  },

  async logout() {
    return api.post('/auth/logout');
  },

  async register(username, password) {
    return api.post('/auth/register', { username, password });
  },

  async getCurrentUser() {
    return api.get('/user');
  },

  async updateUser(userData) {
    return api.put('/user', userData);
  },

  async getPermits() {
    return api.get('/permits');
  },

  async getPermit(permitId) {
    return api.get(`/permits/${permitId}`);
  },

  async getBids(permitId) {
    return api.get(`/permits/${permitId}/bids`);
  },

  async placeBid(permitId, amount) {
    return api.post(`/permits/${permitId}/bid`, { amount });
  },

  async createTeam(teamName) {
    return api.post('/teams', { name: teamName });
  },

  async getTeams() {
    return api.get('/teams');
  },

  async sendTeamInvite(teamId, username) {
    return api.post(`/teams/${teamId}/invite`, { username });
  },

  async respondToInvite(inviteId, accept) {
    return api.post(`/teams/invite/${inviteId}/respond`, { accept });
  },

  async placeTeamBid(permitId, amount, teamId) {
    return api.post(`/permits/${permitId}/team-bid`, { 
      amount, 
      teamId 
    });
  },

  async getNotifications() {
    return api.get('/notifications');
  },

  async markNotificationRead(notificationId) {
    return api.put(`/notifications/${notificationId}/read`, {});
  }
};

// Add request interceptor for debugging
api.interceptors.request.use(
  config => {
    console.log(`Making ${config.method.toUpperCase()} request to: ${config.url}`);
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Update response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('Unauthorized access, redirecting to login');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiService;