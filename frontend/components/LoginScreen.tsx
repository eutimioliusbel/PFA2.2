
import React, { useState } from 'react';
import { Lock, User, ShieldCheck, FileSpreadsheet, Loader2 } from 'lucide-react';
import { SystemConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface LoginScreenProps {
  config: SystemConfig;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ config }) => {
  const { login, error: authError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Use error from AuthContext instead of local state
  const error = authError || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      // For empty field validation, we'll need to handle this differently
      // For now, just let the backend handle it
      return;
    }

    try {
      setIsLoading(true);
      await login(username, password);
      // Login successful - AuthContext will handle state updates
    } catch (err) {
      // Error is already set in AuthContext, no need to set it here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* Left Side: Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 text-white p-12 flex-col justify-between border-r border-slate-800">
         {/* Background Gradient Overlay */}
         <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 z-0"></div>
         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2670&auto=format&fit=crop')] opacity-5 bg-cover bg-center mix-blend-overlay z-0"></div>

         {/* Header / Logo Section - BIG & ROUND */}
         <div className="relative z-10 flex items-center gap-6 mt-8">
            <div className="w-28 h-28 bg-white/10 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center shadow-2xl p-4 overflow-hidden">
                 {config.loginLogoUrl ? (
                    <img src={config.loginLogoUrl} alt="Logo" className="w-full h-full object-contain rounded-full" />
                 ) : (
                    <FileSpreadsheet className="w-12 h-12 text-orange-500" />
                 )}
            </div>
            <div className="text-3xl font-bold tracking-tight">{config.appName}</div>
         </div>

         {/* Hero Text - Configurable */}
         <div className="relative z-10 max-w-lg mb-12">
            <h1 className="text-5xl font-bold leading-tight mb-6 text-white">
              {config.loginHeadline || 'Building the Future,'} <span className="text-orange-500">{config.loginHeadlineAccent || 'Today.'}</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              {config.loginDescription || 'Access your project plans, forecasts, and actuals in one unified timeline. Empowering decisions with real-time data.'}
            </p>
         </div>

         {/* Footer */}
         <div className="relative z-10 text-xs text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} {config.appName}. All rights reserved.
         </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-slate-950">
         <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            
            <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Sign in to your account</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Welcome back! Please enter your details.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && error.trim() && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm font-semibold text-center">
                    {error}
                  </div>
                )}

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                                type="text" 
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                                placeholder="Enter your username"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                                type="password" 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                                placeholder="Enter your password"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <input
                            id="remember-me"
                            type="checkbox"
                            className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded cursor-pointer"
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                            Remember me
                        </label>
                    </div>
                    <div className="text-sm">
                        <a href="#" className="font-medium text-orange-600 hover:text-orange-500">
                            Forgot Password?
                        </a>
                    </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-transform active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Logging in...</span>
                    </>
                  ) : (
                    'Login'
                  )}
                </button>

            </form>

            {/* SSO Section */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-slate-950 text-slate-500">Or continue with</span>
                </div>
            </div>

            <button 
                type="button"
                onClick={() => {
                    if (!config.ssoCertificate) {
                        alert("SSO Certificate not configured by administrator.");
                    } else {
                        alert("Redirecting to SSO Provider... (Mock)");
                    }
                }}
                className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 group text-sm"
             >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Sign in with SSO</span>
             </button>
         </div>
      </div>
    </div>
  );
};
