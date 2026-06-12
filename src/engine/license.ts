export interface LicenseState {
  isPro: boolean;
  licenseKey: string | null;
  productName: string | null;
}

const PROXY_URL = 'https://license.instantraman.workers.dev/validate';
const STORAGE_KEY = 'instant_raman_license_state';

export const LicenseManager = {
  get(): LicenseState {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch { /* Fallback */ }
    return { isPro: false, licenseKey: null, productName: null };
  },

  async validateAndSave(licenseKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey })
      });

      if (!res.ok) {
        const errData = await res.json();
        return { success: false, error: errData.error || 'Validation failed.' };
      }

      const data = await res.json();
      if (data.valid) {
        const newState: LicenseState = {
          isPro: true,
          licenseKey,
          productName: data.product_name
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
