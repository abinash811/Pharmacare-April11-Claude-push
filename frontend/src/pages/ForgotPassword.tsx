import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppButton } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/axios';
import { toast } from 'sonner';

/**
 * ForgotPassword — self-service password reset, step 1 (docs/15_ROADMAP.md
 * Auth Overhaul #6). No real email service is wired in yet (asked, not
 * assumed — needs real SMTP/SendGrid credentials); until then, the backend
 * returns `dev_reset_link` directly so the flow is usable end-to-end today.
 * Route: /forgot-password (public, unauthenticated).
 */
export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const email = new FormData(e.currentTarget).get('email');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      setDevResetLink(res.data.dev_reset_link || null);
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-6">
      <Card className="w-full max-w-sm" data-testid="forgot-password-card">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Forgot password?</CardTitle>
          <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4" data-testid="forgot-password-success">
              <p className="text-sm text-gray-600">
                If an account exists for that email, a password reset link has been sent.
              </p>
              {devResetLink && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2" data-testid="dev-reset-link-box">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                    Dev mode — no email service configured yet
                  </p>
                  <p className="text-xs text-amber-700">
                    Since PharmaCare can't send real emails yet, here's your reset link directly:
                  </p>
                  <Link to={devResetLink} className="text-sm font-medium text-brand underline break-all" data-testid="dev-reset-link">
                    {devResetLink}
                  </Link>
                </div>
              )}
              <Link to="/" className="block text-sm text-center text-brand font-medium">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email" name="email" type="email" placeholder="admin@pharmacy.com"
                  required className="h-12 md:h-9" data-testid="forgot-password-email-input"
                />
              </div>
              <AppButton type="submit" className="w-full h-12 md:h-9 text-[15px] md:text-sm" loading={loading} data-testid="forgot-password-submit-btn">
                Send reset link
              </AppButton>
              <Link to="/" className="block text-sm text-center text-gray-500">Back to login</Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
