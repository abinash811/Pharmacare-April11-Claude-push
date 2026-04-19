import React, { useState, useContext } from 'react';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/axios';
import { toast } from 'sonner';

const PILL_SVG = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />;

const BrandIcon = ({ cls }) => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">{PILL_SVG}</svg>
);

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Divider = () => (
  <div className="relative my-6">
    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-white px-2 text-gray-500">Or continue with</span>
    </div>
  </div>
);

const TRUST_ITEMS = ['GST-ready billing in seconds', 'Schedule H1 compliance built-in', 'Works on desktop and iPad'];

export default function AuthPage() {
  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const credentials = { email: formData.get('email'), password: formData.get('password') };
    try {
      const response = await api.post('/auth/login', credentials);
      login(response.data.user, response.data.token);
      toast.success('Logged in successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const userData = { name: formData.get('name'), email: formData.get('email'), password: formData.get('password'), role: formData.get('role') || 'cashier' };
    try {
      const response = await api.post('/auth/register', userData);
      login(response.data.user, response.data.token);
      toast.success('Account created successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    }
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    toast.info('Google login is not available in this version.');
  };

  return (
    <div className="min-h-screen flex">

      {/* Left panel — desktop only */}
      <div className="hidden md:flex w-[42%] bg-[#1a2332] flex-col p-8 relative overflow-hidden flex-shrink-0">
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full border-[40px] border-brand/[0.08]" />
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full border-[28px] border-brand/[0.06]" />
        <div className="flex items-center gap-2 mb-auto relative z-10">
          <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
            <BrandIcon cls="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">PharmaCare</span>
        </div>
        <div className="mb-8 relative z-10">
          <h2 className="text-[22px] font-bold text-white leading-snug mb-2">Run your pharmacy<br/>with confidence</h2>
          <p className="text-xs text-white/45 leading-relaxed">Billing, inventory, purchases, compliance<br/>and GST — all in one place.</p>
        </div>
        <div className="flex flex-col gap-2 relative z-10">
          {TRUST_ITEMS.map(item => (
            <div key={item} className="flex items-center gap-2 text-[11px] text-white/50">
              <div className="w-[18px] h-[18px] rounded-[5px] bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 bg-[#1a2332] md:bg-[#f8f9fa] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="md:hidden absolute -bottom-20 -right-20 w-64 h-64 rounded-full border-[48px] border-brand/[0.07]" />
        <div className="md:hidden absolute -top-12 -left-12 w-48 h-48 rounded-full border-[36px] border-brand/[0.06]" />
        <div className="md:hidden flex flex-col items-center mb-6 relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
              <BrandIcon cls="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-white">PharmaCare</span>
          </div>
          <p className="text-[11px] text-white/40">Pharmacy Management System</p>
        </div>

        <Card className="w-full max-w-sm relative z-10 shadow-[0_20px_60px_rgba(0,0,0,0.30)] md:shadow-[0_4px_20px_rgba(0,0,0,0.08)]" data-testid="auth-card">
          <CardHeader className="text-center">
            <p className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1">Sign in</p>
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="login-tab">Login</TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login" data-testid="login-form">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" placeholder="admin@pharmacy.com" required className="h-12 md:h-9" data-testid="login-email-input" />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" name="password" type="password" required className="h-12 md:h-9" data-testid="login-password-input" />
                  </div>
                  <Button type="submit" className="w-full h-12 md:h-9 text-[15px] md:text-sm" disabled={loading} data-testid="login-submit-btn">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
                <Divider />
                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} data-testid="google-login-btn">
                  <GoogleIcon />Sign in with Google
                </Button>
              </TabsContent>

              <TabsContent value="register" data-testid="register-form">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="register-name">Full Name</Label>
                    <Input id="register-name" name="name" type="text" placeholder="John Doe" required className="h-12 md:h-9" data-testid="register-name-input" />
                  </div>
                  <div>
                    <Label htmlFor="register-email">Email</Label>
                    <Input id="register-email" name="email" type="email" placeholder="john@pharmacy.com" required className="h-12 md:h-9" data-testid="register-email-input" />
                  </div>
                  <div>
                    <Label htmlFor="register-password">Password</Label>
                    <Input id="register-password" name="password" type="password" required className="h-12 md:h-9" data-testid="register-password-input" />
                  </div>
                  <div>
                    <Label htmlFor="register-role">Role</Label>
                    <select id="register-role" name="role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="register-role-select">
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full h-12 md:h-9 text-[15px] md:text-sm" disabled={loading} data-testid="register-submit-btn">
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
                <Divider />
                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} data-testid="google-register-btn">
                  <GoogleIcon />Sign up with Google
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
