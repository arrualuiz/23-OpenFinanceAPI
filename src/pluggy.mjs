import { requireEnv } from './env.mjs';

const BASE_URL = 'https://api.pluggy.ai';

export class PluggyClient {
  constructor() {
    this.apiKey = null;
    this.apiKeyExpiresAt = 0;
  }

  async getApiKey() {
    if (this.apiKey && Date.now() < this.apiKeyExpiresAt) return this.apiKey;

    const response = await fetch(`${BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: requireEnv('PLUGGY_CLIENT_ID'),
        clientSecret: requireEnv('PLUGGY_CLIENT_SECRET'),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Pluggy /auth falhou (${response.status}): ${JSON.stringify(data)}`);
    }

    this.apiKey = data.apiKey || data.accessToken;
    if (!this.apiKey) throw new Error('Pluggy /auth nao retornou apiKey/accessToken.');

    this.apiKeyExpiresAt = Date.now() + 1000 * 60 * 110;
    return this.apiKey;
  }

  async request(pathname, options = {}) {
    const apiKey = await this.getApiKey();
    const url = pathname.startsWith('http') ? pathname : `${BASE_URL}${pathname}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Pluggy ${pathname} falhou (${response.status}): ${JSON.stringify(data)}`);
    }
    return data;
  }

  async createConnectToken({ itemId } = {}) {
    const payload = {
      ...(itemId ? { itemId } : {}),
      options: {
        clientUserId: process.env.CLIENT_USER_ID || 'personal-finance',
        avoidDuplicates: true,
      },
    };

    return this.request('/connect_token', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async fetchItem(itemId) {
    return this.request(`/items/${encodeURIComponent(itemId)}`);
  }

  async fetchAccounts(itemId) {
    return this.request(`/accounts?itemId=${encodeURIComponent(itemId)}&pageSize=500`);
  }

  async fetchInvestments(itemId) {
    return this.request(`/investments?itemId=${encodeURIComponent(itemId)}&pageSize=500`);
  }

  async fetchBills(accountId) {
    return this.request(`/bills?accountId=${encodeURIComponent(accountId)}&pageSize=500`);
  }
}
