import React, { useState } from 'react';
import { Lock, AlertTriangle, ArrowRight } from 'lucide-react';

interface ForcePasswordChangeModalProps {
  onSave: (password: string) => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ onSave }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
        setError("Password must be at least 4 characters.");
        return;
    }
    if (password !== confirm) {
        setError("Passwords do not match.");
        return;
    }
    onSave(password);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Security Update Required</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Your administrator has set a temporary password for your account. Please set a new secure password to continue.
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </div>
            )}
            
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">New Password</label>
                <input 
                    type="password" 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    placeholder="Enter new password"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Confirm Password</label>
                <input 
                    type="password" 
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    placeholder="Confirm new password"
                />
            </div>

            <button 
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 mt-6"
            >
                <span>Update Password & Login</span>
                <ArrowRight className="w-4 h-4" />
            </button>
        </form>
      </div>
    </div>
  );
};