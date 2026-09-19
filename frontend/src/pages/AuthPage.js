import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '@/App';
import { AppButton } from '@/components/shared';
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

const TRUST_ITEMS = ['GST-ready billing in seconds', 'Schedule H1 compliance built-in', 'Works on desktop and iPad'];

const REGISTER_STEP = { ACCOUNT: 1, PHARMACY: 2 };

export default function AuthPage() {
  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [registerStep, setRegisterStep] = useState(REGISTER_STEP.ACCOUNT);
  const [accountInfo, setAccountInfo] = useState(null);

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
      toast.error(error.message || 'Login failed');
    }
    setLoading(false);
  };

  const handleAccountStepNext = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    setAccountInfo({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      phone: formData.get('phone'),
    });
    setRegisterStep(REGISTER_STEP.PHARMACY);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const userData = {
      ...accountInfo,
      pharmacy_name: formData.get('pharmacy_name'),
      address: formData.get('address'),
      city: formData.get('city'),
      state: formData.get('state'),
      pincode: formData.get('pincode'),
      drug_license_number: formData.get('drug_license_number') || null,
    };
    try {
      const response = await api.post('/auth/register', userData);
      login(response.data.user, response.data.token);
      toast.success('Account created successfully');
    } catch (error) {
      toast.error(error.message || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">

      {/* Left panel — desktop only */}
      <div className="hidden md:flex w-[42%] bg-sidebar flex-col p-8 relative overflow-hidden flex-shrink-0">
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full border-[40px] border-brand/[0.08]" />
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full border-[28px] border-brand/[0.06]" />
        <div className="flex items-center gap-2 relative z-10">
          <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
            <BrandIcon cls="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">PharmaCare</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-10 relative z-10 text-center">
          <div>
            <h2 className="text-[28px] font-bold text-white leading-tight mb-3">Run your pharmacy<br/>with confidence</h2>
            <p className="text-sm text-white/45 leading-relaxed max-w-[260px] mx-auto">Billing, inventory, purchases, compliance<br/>and GST — all in one place.</p>
          </div>
          <div className="flex flex-col items-center gap-3">
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
      </div>

      {/* Right panel — form */}
      <div className="flex-1 bg-sidebar md:bg-page flex flex-col items-center justify-center p-6 relative overflow-hidden">
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <Link to="/forgot-password" className="text-xs font-medium text-brand" data-testid="forgot-password-link">
                        Forgot password?
                      </Link>
                    </div>
                    <Input id="login-password" name="password" type="password" required className="h-12 md:h-9" data-testid="login-password-input" />
                  </div>
                  <AppButton type="submit" className="w-full h-12 md:h-9 text-[15px] md:text-sm" disabled={loading} data-testid="login-submit-btn">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </AppButton>
                </form>
              </TabsContent>

              <TabsContent value="register" data-testid="register-form">
                <div className="flex items-center gap-2 mb-4 text-xs font-medium text-gray-500">
                  <span className={registerStep === REGISTER_STEP.ACCOUNT ? 'text-brand' : ''}>1. Your account</span>
                  <span className="flex-1 h-px bg-gray-200" />
                  <span className={registerStep === REGISTER_STEP.PHARMACY ? 'text-brand' : ''}>2. Your pharmacy</span>
                </div>

                {registerStep === REGISTER_STEP.ACCOUNT ? (
                  <form onSubmit={handleAccountStepNext} className="space-y-4" data-testid="register-step-account">
                    <div>
                      <Label htmlFor="register-name">Full Name</Label>
                      <Input id="register-name" name="name" type="text" placeholder="John Doe" required defaultValue={accountInfo?.name} className="h-12 md:h-9" data-testid="register-name-input" />
                    </div>
                    <div>
                      <Label htmlFor="register-email">Email</Label>
                      <Input id="register-email" name="email" type="email" placeholder="john@pharmacy.com" required defaultValue={accountInfo?.email} className="h-12 md:h-9" data-testid="register-email-input" />
                    </div>
                    <div>
                      <Label htmlFor="register-password">Password</Label>
                      <Input id="register-password" name="password" type="password" required defaultValue={accountInfo?.password} className="h-12 md:h-9" data-testid="register-password-input" />
                    </div>
                    <div>
                      <Label htmlFor="register-phone">Phone</Label>
                      <Input id="register-phone" name="phone" type="tel" placeholder="9876543210" required defaultValue={accountInfo?.phone} className="h-12 md:h-9" data-testid="register-phone-input" />
                    </div>
                    <AppButton type="submit" className="w-full h-12 md:h-9 text-[15px] md:text-sm" data-testid="register-next-btn">
                      Continue
                    </AppButton>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4" data-testid="register-step-pharmacy">
                    <div>
                      <Label htmlFor="register-pharmacy-name">Pharmacy Name</Label>
                      <Input id="register-pharmacy-name" name="pharmacy_name" type="text" placeholder="City Medical Store" required className="h-12 md:h-9" data-testid="register-pharmacy-name-input" />
                    </div>
                    <div>
                      <Label htmlFor="register-address">Address</Label>
                      <Input id="register-address" name="address" type="text" placeholder="123 Main Street" required className="h-12 md:h-9" data-testid="register-address-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="register-city">City</Label>
                        <Input id="register-city" name="city" type="text" placeholder="Bengaluru" required className="h-12 md:h-9" data-testid="register-city-input" />
                      </div>
                      <div>
                        <Label htmlFor="register-state">State</Label>
                        <Input id="register-state" name="state" type="text" placeholder="Karnataka" required className="h-12 md:h-9" data-testid="register-state-input" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="register-pincode">Pincode</Label>
                        <Input id="register-pincode" name="pincode" type="text" placeholder="560001" required pattern="\d{6}" className="h-12 md:h-9" data-testid="register-pincode-input" />
                      </div>
                      <div>
                        <Label htmlFor="register-dl">Drug License No.</Label>
                        <Input id="register-dl" name="drug_license_number" type="text" placeholder="KA-BLR-12345" className="h-12 md:h-9" data-testid="register-dl-input" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <AppButton type="button" variant="outline" className="h-12 md:h-9" onClick={() => setRegisterStep(REGISTER_STEP.ACCOUNT)} data-testid="register-back-btn">
                        Back
                      </AppButton>
                      <AppButton type="submit" className="flex-1 h-12 md:h-9 text-[15px] md:text-sm" disabled={loading} data-testid="register-submit-btn">
                        {loading ? 'Creating account...' : 'Create Account'}
                      </AppButton>
                    </div>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
