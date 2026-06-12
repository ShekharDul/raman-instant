export interface LicenseState {
  isPro: boolean;
  licenseKey: string | null;
  clientId: string;
}

const PROXY_URL = 'https://license.instantraman.workers.dev/validate';
const STORAGE_KEY = 'instant_raman_license_state';
const CLIENT_ID_KEY = 'instant_raman_client_id';

export const LicenseManager = {
  getClientId(): string {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      try {
        id = (window as any).crypto?.randomUUID() || Math.random().toString(36).substring(2, 15);
      } catch (e) {
        id = Math.random().toString(36).substring(2, 15);
      }
      localStorage.setItem(CLIENT_ID_KEY, id || 'fallback-id');
    }
    return id || 'fallback-id';
  },

  get(): LicenseState {
    const clientId = this.getClientId();
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const state = JSON.parse(cached);
        return { ...state, clientId };
      }
    } catch { /* Fallback */ }
    return { isPro: false, licenseKey: null, clientId };
  },

  async validateAndSave(licenseKey: string): Promise<{ success: boolean; error?: string }> {
    const clientId = this.getClientId();
    try {
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, client_id: clientId })
      });

      if (!res.ok) {
        const errData = await res.json();
        return { success: false, error: errData.error || 'Validation failed.' };
      }

      const data = await res.json();
      if (data.valid) {
        const newState = {
          isPro: true,
          licenseKey
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Invalid license key.' };
      }
    } catch (err: any) {
      return { success: false, error: 'Network error contacting validation server.' };
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};
