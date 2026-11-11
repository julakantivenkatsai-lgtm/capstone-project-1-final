export const AuthService = {
  async checkSession(): Promise<boolean> {
    try {
      const res = await fetch('/api/session', { credentials: 'include' });
      if (!res.ok) return false;
      const data = await res.json();
      return data.authenticated === true;
    } catch (_) {
      return false;
    }
  },

  async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      if (res.ok) return { success: true };
      const err = await res.json().catch(() => null);
      return { success: false, error: err?.error || 'Login failed' };
    } catch {
      return { success: false, error: 'Unable to connect to the server. Please try again.' };
    }
  },

  async logout(): Promise<boolean> {
    const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    return res.ok;
  },

  /** Step 1 – send contact (email or phone), get back token + OTP (demo) */
  async recoverRequest(contact: string): Promise<{
    success: boolean;
    token?: string;
    otp?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/recover/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact })
      });
      return await res.json();
    } catch (_) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  /** Step 2 – verify OTP, receive username + password */
  async recoverVerify(token: string, otp: string): Promise<{
    success: boolean;
    username?: string;
    password?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/recover/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otp })
      });
      return await res.json();
    } catch (_) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }
};
