import React, { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppButton } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/axios';
import { toast } from 'sonner';

/**
 * ResetPassword — self-service password reset, step 2 (docs/15_ROADMAP.md
 * Auth Overhaul #6). Reads the single-use, 1-hour token from the query
 * string (the link ForgotPassword either emails or, in dev mode with no
 * email service configured yet, shows directly).
 * Route: /reset-password?token=... (public, unauthenticated).
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: newPassword });
      toast.success('Password reset — you can now log in with your new password.');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-6">
      <Card className="w-full max-w-sm" data-testid="reset-password-card">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Set a new password</CardTitle>
          <CardDescription>Choose a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="space-y-4" data-testid="reset-password-missing-token">
              <p className="text-sm text-gray-600">
                This reset link is missing its token. Request a new one from the login page.
              </p>
              <Link to="/forgot-password" className="block text-sm text-center text-brand font-medium">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="reset-new-password">New password</Label>
                <Input
                  id="reset-new-password" name="new_password" type="password" required
                  className="h-12 md:h-9" data-testid="reset-password-new-input"
                />
              </div>
              <div>
                <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                <Input
                  id="reset-confirm-password" name="confirm_password" type="password" required
                  className="h-12 md:h-9" data-testid="reset-password-confirm-input"
                />
              </div>
              <AppButton type="submit" className="w-full h-12 md:h-9 text-[15px] md:text-sm" loading={loading} data-testid="reset-password-submit-btn">
                Reset password
              </AppButton>
              <Link to="/" className="block text-sm text-center text-gray-500">Back to login</Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
