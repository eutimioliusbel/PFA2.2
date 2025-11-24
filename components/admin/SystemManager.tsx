
import React, { useState, useEffect } from 'react';
import { SystemConfig } from '../../types';
import { Settings, Upload, ShieldCheck, Monitor, Moon, Sun, Save, Type, Link2, Image as ImageIcon, Sparkles, Volume2 } from 'lucide-react';

interface SystemManagerProps {
  config: SystemConfig;
  setConfig: (config: SystemConfig) => void;
}

export const SystemManager: React.FC<SystemManagerProps> = ({ config, setConfig }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [logoInputType, setLogoInputType] = useState<'file' | 'url'>('url');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
      const loadVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          setAvailableVoices(voices);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleSave = () => {
      setConfig(localConfig);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setLocalConfig({ ...localConfig, loginLogoUrl: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5" /> System Settings
            </h2>
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
            >
                <Save className="w-4 h-4" /> Save Configuration
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* General Settings */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> General Appearance
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Application Name</label>
                        <input 
                            type="text" 
                            value={localConfig.appName} 
                            onChange={e => setLocalConfig({...localConfig, appName: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Login Logo</label>
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <div className="flex gap-2">
                                    <button onClick={() => setLogoInputType('url')} className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${logoInputType === 'url' ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600' : 'border-transparent text-slate-400'}`}>URL</button>
                                    <button onClick={() => setLogoInputType('file')} className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${logoInputType === 'file' ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600' : 'border-transparent text-slate-400'}`}>Upload</button>
                                </div>
                                {logoInputType === 'url' ? (
                                    <div className="relative">
                                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text" 
                                            value={localConfig.loginLogoUrl || ''}
                                            onChange={(e) => setLocalConfig({ ...localConfig, loginLogoUrl: e.target.value })}
                                            placeholder="https://..."
                                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                        />
                                    </div>
                                ) : (
                                    <label className="flex items-center gap-2 w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
                                        <Upload className="w-4 h-4" />
                                        <span>Choose File</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                    </label>
                                )}
                            </div>
                            
                            <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-600">
                                {localConfig.loginLogoUrl ? (
                                    <img src={localConfig.loginLogoUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <ImageIcon className="w-6 h-6 text-slate-400" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Default Theme</label>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setLocalConfig({...localConfig, defaultTheme: 'light'})}
                                className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg border text-sm font-bold transition-all ${localConfig.defaultTheme === 'light' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                <Sun className="w-4 h-4" /> Light
                            </button>
                            <button 
                                onClick={() => setLocalConfig({...localConfig, defaultTheme: 'dark'})}
                                className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg border text-sm font-bold transition-all ${localConfig.defaultTheme === 'dark' ? 'bg-slate-700 border-slate-500 text-white' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                <Moon className="w-4 h-4" /> Dark
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Login Screen Text Configuration */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Type className="w-4 h-4" /> Login Screen Text
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Headline Main</label>
                        <input 
                            type="text" 
                            value={localConfig.loginHeadline || ''} 
                            onChange={e => setLocalConfig({...localConfig, loginHeadline: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                            placeholder="Building the Future,"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Headline Accent (Highlighted)</label>
                         <input 
                            type="text" 
                            value={localConfig.loginHeadlineAccent || ''} 
                            onChange={e => setLocalConfig({...localConfig, loginHeadlineAccent: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-orange-500 font-bold"
                            placeholder="Today."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description / Tagline</label>
                        <textarea 
                            value={localConfig.loginDescription || ''} 
                            onChange={e => setLocalConfig({...localConfig, loginDescription: e.target.value})}
                            className="w-full h-24 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none"
                            placeholder="Access your project plans..."
                        />
                    </div>
                </div>
            </div>

            {/* Global AI Rules */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm lg:col-span-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Global AI Rules
                        </h3>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System-Wide Behavior Directives</label>
                            <textarea 
                                value={localConfig.aiGlobalRules?.join('\n') || ''} 
                                onChange={e => setLocalConfig({...localConfig, aiGlobalRules: e.target.value.split('\n')})}
                                className="w-full h-40 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none font-mono text-slate-800 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Enter one rule per line. These apply to ALL organizations and users."
                            />
                            <p className="text-[10px] text-slate-400">
                                Define strict rules for the AI assistant. e.g., "Users cannot see data from other organizations", "Actualized records are read-only except for End Date".
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Volume2 className="w-4 h-4" /> Voice & Audio Settings
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">AI Voice Personality</label>
                                <select 
                                    value={localConfig.voiceURI || ''}
                                    onChange={e => setLocalConfig({...localConfig, voiceURI: e.target.value})}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Default Browser Voice</option>
                                    {availableVoices.map(voice => (
                                        <option key={voice.voiceURI} value={voice.voiceURI}>
                                            {voice.name} ({voice.lang})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Select a preferred voice for the AI Assistant's speech output. Note: Available voices depend on the user's browser and OS.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
