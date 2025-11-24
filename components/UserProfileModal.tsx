
import React, { useState } from 'react';
import { User, Organization, UserRole } from '../types';
import { X, Save, Upload, User as UserIcon, Shield, Building2, Mail, Briefcase, Sun, Lock, CheckSquare, Square, Sparkles, Loader2 } from 'lucide-react';

interface UserProfileModalProps {
  user: Partial<User>;
  currentUser: User;
  orgs: Organization[];
  onClose: () => void;
  onSave: (userData: Partial<User>, password?: string) => void;
  onGenerateAiAvatar?: () => Promise<string | null>;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUser,
  orgs,
  onClose,
  onSave,
  onGenerateAiAvatar
}) => {
  const [formData, setFormData] = useState<Partial<User>>({ 
      allowedOrganizationIds: [], 
      ...user 
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const isAdminMode = currentUser.role === 'admin' && (currentUser.id !== user.id || user.id === undefined);
  const currentOrg = orgs.find(o => o.id === formData.organizationId);

  const handleSave = () => {
    if (password && password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    onSave(formData, password);
    onClose();
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAvatar = async () => {
      if (!onGenerateAiAvatar) return;
      setIsGenerating(true);
      const url = await onGenerateAiAvatar();
      if (url) {
          setFormData({ ...formData, avatarUrl: url });
      }
      setIsGenerating(false);
  };

  const toggleAllowedOrg = (orgId: string) => {
      const currentIds = formData.allowedOrganizationIds || [];
      const newIds = currentIds.includes(orgId) 
          ? currentIds.filter(id => id !== orgId)
          : [...currentIds, orgId];
      
      let newActiveId = formData.organizationId;
      if (formData.organizationId === orgId && !newIds.includes(orgId)) {
           newActiveId = newIds.length > 0 ? newIds[0] : undefined;
      }

      setFormData({ 
          ...formData, 
          allowedOrganizationIds: newIds,
          organizationId: newActiveId
      });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
               <UserIcon className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                 {user.id ? 'Edit Profile' : 'New User'}
               </h2>
               <p className="text-xs text-slate-500 dark:text-slate-400">
                 {user.id ? `Managing settings for ${formData.username || 'user'}` : 'Create a new system user'}
               </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           <div className="flex flex-col md:flex-row min-h-full">
              
              {/* Left Sidebar: Identity & Avatar */}
              <div className="w-full md:w-1/3 bg-slate-50 dark:bg-slate-800/50 p-6 border-r border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                  <div className="relative group mb-6">
                      <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          {formData.avatarUrl ? (
                              <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                              <UserIcon className="w-16 h-16 text-slate-400" />
                          )}
                      </div>
                      <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors border-2 border-white dark:border-slate-800">
                          <Upload className="w-4 h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      </label>
                  </div>
                  
                  {onGenerateAiAvatar && (
                      <button 
                        onClick={handleGenerateAvatar}
                        disabled={isGenerating}
                        className="mb-6 text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 flex items-center gap-1 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-full transition-colors"
                      >
                          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          Generate AI Avatar
                      </button>
                  )}

                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{formData.name || 'User Name'}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{formData.jobTitle || 'No Job Title'}</p>
                  
                  {/* Active Organization Card */}
                  <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                      <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3 text-left flex items-center gap-2">
                          <Building2 className="w-3 h-3" /> Active Organization Context
                      </div>
                      <div className="flex items-center gap-3">
                          {currentOrg?.logoUrl ? (
                              <img src={currentOrg.logoUrl} className="w-10 h-10 object-contain rounded bg-slate-50 dark:bg-slate-800 p-1 border border-slate-100 dark:border-slate-700" />
                          ) : (
                              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded flex items-center justify-center">
                                  <Building2 className="w-5 h-5" />
                              </div>
                          )}
                          <div className="text-left min-w-0">
                              <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{currentOrg?.name || 'No Active Org'}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{currentOrg?.id || 'N/A'}</div>
                          </div>
                      </div>
                  </div>

              </div>

              {/* Right Content: Form */}
              <div className="w-full md:w-2/3 p-8 space-y-8">
                  
                  {/* Section: Personal Info */}
                  <section>
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                          <UserIcon className="w-4 h-4" /> Personal Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Display Name</label>
                              <input 
                                  type="text" 
                                  value={formData.name || ''} 
                                  onChange={e => setFormData({...formData, name: e.target.value})}
                                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Job Title</label>
                              <div className="relative">
                                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                  <input 
                                      type="text" 
                                      value={formData.jobTitle || ''} 
                                      onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white"
                                      placeholder="e.g. Project Manager"
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Email Address</label>
                              <div className="relative">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                  <input 
                                      type="email" 
                                      value={formData.email || ''} 
                                      onChange={e => setFormData({...formData, email: e.target.value})}
                                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white"
                                      placeholder="user@company.com"
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Username</label>
                              <input 
                                  type="text" 
                                  value={formData.username || ''} 
                                  onChange={e => setFormData({...formData, username: e.target.value})}
                                  disabled={!isAdminMode && !!formData.id}
                                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 dark:text-white"
                              />
                          </div>
                      </div>
                  </section>

                  <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                  {/* Section: Access & Security */}
                  <section>
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                          <Shield className="w-4 h-4" /> Security & Access
                      </h4>
                      <div className="grid grid-cols-1 gap-5 mb-6">
                           
                           {isAdminMode && (
                               <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Allowed Organizations</label>
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                       {orgs.map(org => {
                                           const isSelected = formData.allowedOrganizationIds?.includes(org.id);
                                           return (
                                               <div 
                                                    key={org.id} 
                                                    onClick={() => toggleAllowedOrg(org.id)}
                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${isSelected ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                               >
                                                   {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                                                   <div className="min-w-0">
                                                       <div className={`text-xs font-bold truncate ${isSelected ? 'text-slate-800 dark:text-white' : 'text-slate-500'}`}>{org.name}</div>
                                                   </div>
                                               </div>
                                           );
                                       })}
                                   </div>
                               </div>
                           )}

                           <div>
                               <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Default / Active Organization</label>
                               <select 
                                    value={formData.organizationId || ''} 
                                    onChange={e => setFormData({...formData, organizationId: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 dark:text-white"
                                >
                                    <option value="" disabled>Select an organization</option>
                                    {orgs
                                        .filter(o => isAdminMode || formData.allowedOrganizationIds?.includes(o.id)) 
                                        .map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                           </div>

                           <div>
                               <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">System Role</label>
                               <select 
                                    value={formData.role} 
                                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                                    disabled={!isAdminMode}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 dark:text-white"
                                >
                                    <option value="user">Standard User</option>
                                    <option value="admin">System Administrator</option>
                                </select>
                           </div>

                           <div className="mt-2 bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30">
                               <label className="block text-xs font-bold text-orange-800 dark:text-orange-400 uppercase mb-3 flex items-center gap-2">
                                   <Lock className="w-3 h-3" /> Change Password
                               </label>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <input 
                                       type="password" 
                                       value={password} 
                                       onChange={e => setPassword(e.target.value)}
                                       className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-900/50 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/50 outline-none text-slate-900 dark:text-white"
                                       placeholder="New Password"
                                   />
                                   <input 
                                       type="password" 
                                       value={confirmPassword} 
                                       onChange={e => setConfirmPassword(e.target.value)}
                                       className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-900/50 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/50 outline-none text-slate-900 dark:text-white"
                                       placeholder="Confirm Password"
                                   />
                               </div>
                           </div>
                      </div>
                  </section>

                  <div className="h-px bg-slate-100 dark:bg-slate-800"></div>

                   <section>
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                          <Sun className="w-4 h-4" /> Preferences
                      </h4>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Interface Theme</label>
                         <div className="grid grid-cols-3 gap-2">
                             {['light', 'dark', 'system'].map((theme) => (
                                 <button
                                    key={theme}
                                    onClick={() => setFormData({...formData, themePreference: theme as any})}
                                    className={`py-2.5 rounded-xl border text-sm font-bold transition-all capitalize
                                        ${formData.themePreference === theme 
                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm' 
                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }
                                    `}
                                 >
                                     {theme}
                                 </button>
                             ))}
                         </div>
                      </div>
                   </section>

              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
             <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
             <button onClick={handleSave} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-transform active:scale-95 flex items-center gap-2">
                 <Save className="w-4 h-4" /> Save Profile
             </button>
        </div>

      </div>
    </div>
  );
};
