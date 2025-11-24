
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Mic, Send, X, Sparkles, User as UserIcon, Bot, CheckCircle, AlertTriangle, Loader2, Filter, Volume2 } from 'lucide-react';
import { Organization, Asset, SystemConfig, FilterState, ApiConfig } from '../types';
import { formatDate } from '../utils';
import { CATEGORIES, CLASSES, AREAS, DORS, SOURCES } from '../mockData';

// --- TYPES & INTERFACES ---

interface AiAssistantProps {
  mode: 'hidden' | 'panel' | 'voice';
  onClose: () => void;
  org: Organization;
  assets: Asset[]; // Current filtered asset view
  onApplyUpdates: (updates: Partial<Asset>[]) => void; // Callback to apply changes
  onApplyFilter: (filters: Partial<FilterState>) => void; // Callback to filter view
  systemConfig: SystemConfig;
  apis?: ApiConfig[]; // To lookup auth keys
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  isConfirmation?: boolean;
  proposedUpdates?: any[];
  proposedFilters?: Partial<FilterState>;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ mode, onClose, org, assets, onApplyUpdates, onApplyFilter, systemConfig, apis = [] }) => {
  const [messages, setMessages] = useState<Message[]>([
      { id: 'init', role: 'ai', text: `Hello! I'm your PFA Assistant for ${org.name}.` }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Critical: Use a ref to track messages so asynchronous voice callbacks access the latest state
  const messagesRef = useRef(messages);

  const isOpen = mode !== 'hidden';

  // Keep ref synced with state
  useEffect(() => {
      messagesRef.current = messages;
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
      if (mode === 'panel') {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
  }, [messages, mode]);

  // Auto Start Listening when entering Voice Mode
  useEffect(() => {
      if (mode === 'voice') {
          // Speak greeting then listen if it's the first interaction in this session
          if (messages.length === 1) {
             speakResponse("Hello, I'm ready. What would you like to do?");
          } else {
             // If re-entering voice mode, just listen
             handleVoiceInput();
          }
      } else {
          // Stop listening/speaking if switched away
          window.speechSynthesis.cancel();
          setIsListening(false);
      }
  }, [mode]);

  // --- SPEECH SYNTHESIS (TTS) ---
  const speakResponse = (text: string) => {
      if (mode !== 'voice') return; // Only speak in voice mode
      
      window.speechSynthesis.cancel(); // Stop previous
      
      // 1. Natural Date Processing: Convert YYYY-MM-DD to "Month Day, Year"
      let cleanText = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (match, y, m, d) => {
          const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      });

      // 2. Clean text for speech (remove markdown symbols like *, #, `, -)
      cleanText = cleanText.replace(/[*#`_]/g, ' ').replace(/\s+/g, ' ').trim();
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      const voices = window.speechSynthesis.getVoices();
      let selectedVoice: SpeechSynthesisVoice | undefined;

      // 1. Priority: System Configured Voice
      if (systemConfig.voiceURI) {
          selectedVoice = voices.find(v => v.voiceURI === systemConfig.voiceURI);
      }

      // 2. Priority: "Google US English" (High quality standard in Chrome)
      if (!selectedVoice) {
          selectedVoice = voices.find(v => v.name === 'Google US English');
      }

      // 3. Priority: Microsoft "Natural" voices (Edge/Windows)
      if (!selectedVoice) {
          selectedVoice = voices.find(v => v.name.includes('Natural') && v.lang.startsWith('en'));
      }

      // 4. Priority: Any Google English Voice
      if (!selectedVoice) {
          selectedVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
      }

      // 5. Fallback: Any English Voice
      if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.startsWith('en'));
      }

      if (selectedVoice) {
          utterance.voice = selectedVoice;
      }

      utterance.lang = 'en-US';
      // Slightly slower rate for robot/google voices to sound more natural, 
      // or normal rate for Natural voices.
      utterance.rate = selectedVoice?.name.includes('Google') ? 1.0 : 1.05; 
      utterance.pitch = 1.0;

      // CONTINUOUS CONVERSATION LOOP:
      // When AI finishes speaking, start listening for user input again.
      utterance.onend = () => {
          if (mode === 'voice') {
              // Small delay to ensure audio buffer clears
              setTimeout(() => handleVoiceInput(), 200);
          }
      };

      window.speechSynthesis.speak(utterance);
  };

  // --- SPEECH RECOGNITION ---
  const handleVoiceInput = () => {
      if (!('webkitSpeechRecognition' in window)) {
          console.warn("Voice input not supported in this browser.");
          return;
      }
      
      // If already listening, don't start another instance
      if (isListening) return;

      try {
          const recognition = new (window as any).webkitSpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = 'en-US';

          recognition.onstart = () => setIsListening(true);
          recognition.onend = () => setIsListening(false);
          
          recognition.onresult = (event: any) => {
              const transcript = event.results[0][0].transcript;
              // Auto-send in voice mode if meaningful input
              if (mode === 'voice' && transcript.trim()) {
                  setInput(transcript);
                  handleSend(transcript);
              }
          };

          recognition.start();
      } catch (e) {
          console.error("Speech recognition error", e);
          setIsListening(false);
      }
  };

  // --- CORE AI LOGIC ---
  const handleSend = async (overrideInput?: string) => {
      const textToSend = overrideInput || input;
      if (!textToSend.trim()) return;

      // --- INTERCEPT CONFIRMATIONS (Using Ref to avoid stale state in Voice Callback) ---
      // Check if the LAST message was a confirmation request from the AI
      const currentMessages = messagesRef.current;
      const lastMessage = currentMessages[currentMessages.length - 1];
      
      if (lastMessage?.role === 'ai' && lastMessage.isConfirmation) {
          const lowerText = textToSend.toLowerCase();
          const confirmKeywords = ['yes', 'sure', 'confirm', 'ok', 'okay', 'do it', 'proceed', 'apply', 'go ahead', 'correct', 'yeah', 'yep', 'right', 'make the change'];
          const cancelKeywords = ['no', 'cancel', 'stop', 'don\'t', 'wait', 'nope', 'incorrect', 'abort'];

          // Check for confirmation
          if (confirmKeywords.some(word => lowerText.includes(word))) {
              // Add user's "Yes" message
              setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: textToSend }]);
              setInput('');
              // Execute Action immediately
              confirmAction(lastMessage.id);
              return;
          }

          // Check for cancellation
          if (cancelKeywords.some(word => lowerText.includes(word))) {
              const cancelText = "Action cancelled.";
              setMessages(prev => [
                  ...prev, 
                  { id: Date.now().toString(), role: 'user', text: textToSend },
                  { id: (Date.now() + 1).toString(), role: 'ai', text: cancelText }
              ]);
              setInput('');
              // Remove confirmation flag from previous message
              setMessages(prev => prev.map(m => m.id === lastMessage.id ? { ...m, isConfirmation: false } : m));
              speakResponse(cancelText);
              return;
          }
      }
      // --------------------------------

      // 1. Add User Message
      const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToSend };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsProcessing(true);

      try {
          // Determine API Key based on Org
          const apiConfig = apis.find(a => a.id === org.aiConnectionId);
          // Fallback to env if no specific config found (dev mode), or use config value
          const apiKey = apiConfig?.authValue || process.env.API_KEY;

          if (!apiKey) {
              const err = "Error: No AI API Configuration found for this organization.";
              setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: err }]);
              setIsProcessing(false);
              speakResponse(err);
              return;
          }

          // Initialize Client Dynamically
          const ai = new GoogleGenAI({ apiKey: apiKey });

          const isReadOnly = org.features.aiAccessLevel === 'read-only';

          // 2. Construct Prompt Context
          const globalRules = systemConfig.aiGlobalRules?.length > 0 
              ? `SYSTEM GLOBAL RULES (MUST FOLLOW): \n${systemConfig.aiGlobalRules.map(r => `- ${r}`).join('\n')}` 
              : '';
          const orgRules = org.aiRules.length > 0 
              ? `ORGANIZATION RULES:\n${org.aiRules.map(r => `- ${r}`).join('\n')}` 
              : '';
          
          // Enhanced Data Snapshot - Include Index for easy referencing
          const dataSummary = JSON.stringify(assets.slice(0, 50).map(a => ({
              id: a.id,
              pfaId: a.pfaId,
              cat: a.category,
              class: a.class,
              status: a.isActualized ? 'Actual' : 'Forecast',
              forecastEnd: a.forecastEnd.toISOString().split('T')[0],
              actualEnd: a.actualEnd.toISOString().split('T')[0],
              rate: a.source === 'Rental' ? a.monthlyRate : 0
          }))); 

          let capabilitiesText = `
          CAPABILITIES:
          1. **FILTER VIEW**: Change filters.
          2. **ANSWER QUESTIONS**: Analyze data.
          `;

          if (!isReadOnly) {
              capabilitiesText += `3. **UPDATE DATA**: Modify dates, rates, etc.\n`;
          }

          let restrictionText = '';
          if (isReadOnly) {
              restrictionText = `
              CRITICAL RESTRICTION: READ-ONLY mode. You CANNOT propose "update" actions. Refuse modification requests.
              `;
          }

          const systemInstruction = `You are an expert PFA Assistant for "${org.name}".
          
          ${globalRules}
          ${orgRules}
          
          DATA CONTEXT (Partial Snapshot):
          ${dataSummary}
          
          ${capabilitiesText}
          ${restrictionText}

          **IMPORTANT: HANDLING UPDATES**
          If the user asks to change, update, extend, or shorten data (e.g., "Change end date to..."), you MUST:
          1. Identify the target record(s) from the context.
          2. Determine the field to update based on status:
             - If status is 'Actual', you can ONLY update 'actualEnd'.
             - If status is 'Forecast', you update 'forecastEnd' or 'forecastStart'.
          3. **CRITICAL:** You CANNOT execute changes. You MUST return a JSON proposal with action: "update". 
          4. The system will present a confirmation dialog to the user based on your JSON.
          
          **DATE FORMATS:**
          Always convert relative dates ("next month", "end of year") to 'YYYY-MM-DD'.

          **OUTPUT FORMAT (JSON ONLY FOR ACTIONS):**
          
          For UPDATES:
          \`\`\`json
          {
            "action": "update",
            "description": "I will update the [field] for [PFA ID] to [Value]. Do you want to proceed?",
            "changes": [ { "id": "...", "fieldToUpdate": "...", "value": "..." } ]
          }
          \`\`\`

          For FILTERS:
          \`\`\`json
          {
            "action": "filter",
            "description": "Filtering view...",
            "filters": { "key": ["value"] } 
          }
          \`\`\`
          
          For conversational answers, just reply with text.
          `;

          // 3. Call Gemini
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                  { role: 'user', parts: [{ text: systemInstruction + "\n\nUser Query: " + userMsg.text }] }
              ]
          });

          const text = response.text || "I couldn't process that request.";
          let displayText = text;
          
          // 4. Check for JSON (Action Proposal)
          const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
          
          if (jsonMatch) {
              try {
                  const proposal = JSON.parse(jsonMatch[1]);
                  
                  if (proposal.action === 'update') {
                      if (isReadOnly) {
                           displayText = "I apologize, but this organization is configured for read-only AI access. I cannot modify records.";
                      } else {
                          displayText = proposal.description; // The "Are you sure?" message
                          setMessages(prev => [...prev, {
                              id: Date.now().toString(),
                              role: 'ai',
                              text: proposal.description,
                              isConfirmation: true,
                              proposedUpdates: proposal.changes
                          }]);
                      }
                  } else if (proposal.action === 'filter') {
                      if (proposal.filters.reset) {
                          onApplyFilter({ 
                              search: '', category: CATEGORIES, classType: CLASSES, source: SOURCES, dor: DORS, status: ['Forecast', 'Actuals'], areaSilo: AREAS, startDateFrom: '', startDateTo: '', endDateFrom: '', endDateTo: '' 
                          });
                      } else {
                          onApplyFilter(proposal.filters);
                      }
                      displayText = `✅ ${proposal.description || 'Filters applied.'}`;
                      setMessages(prev => [...prev, {
                          id: Date.now().toString(),
                          role: 'ai',
                          text: displayText
                      }]);
                  } else {
                      displayText = text.replace(/```json[\s\S]*```/, '').trim();
                      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: displayText }]);
                  }
              } catch (e) {
                  console.error("JSON Parse Error", e);
                  setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: text }]);
              }
          } else {
              setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: text }]);
          }

          // Voice Output
          if (mode === 'voice') {
              speakResponse(displayText);
          }

      } catch (error) {
          console.error("AI Error:", error);
          const errMsg = "Sorry, I encountered an error connecting to the AI service.";
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: errMsg }]);
          speakResponse(errMsg);
      } finally {
          setIsProcessing(false);
      }
  };

  const confirmAction = (msgId: string) => {
      // Note: We use messagesRef.current here if checking state, but find is safe on current state if passed from UI
      // But since this can be called from Voice Loop (async), let's use Ref
      const currentMessages = messagesRef.current;
      const message = currentMessages.find(m => m.id === msgId);
      
      if (message && message.proposedUpdates && message.proposedUpdates.length > 0) {
          // Process Updates: Convert date strings to Date objects and map flat structure
          const processedUpdates: Partial<Asset>[] = [];
          
          message.proposedUpdates.forEach((change: any) => {
              const updateObj: any = { id: change.id };
              let value = change.value;
              
              // Safe Date Parsing for ISO Strings (YYYY-MM-DD)
              if (change.fieldToUpdate && (change.fieldToUpdate.toLowerCase().includes('start') || change.fieldToUpdate.toLowerCase().includes('end'))) {
                  // Handle direct strings or ISO
                  if (typeof value === 'string') {
                      const parts = value.split('-');
                      if (parts.length === 3) {
                          // Construct date in local time safely
                          value = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                      } else {
                          value = new Date(value);
                      }
                  }
              }
              
              if (change.fieldToUpdate) {
                  updateObj[change.fieldToUpdate] = value;
                  processedUpdates.push(updateObj);
              }
          });

          onApplyUpdates(processedUpdates);

          setMessages(prev => prev.map(m => 
              m.id === msgId 
              ? { ...m, isConfirmation: false, text: m.text + " (Confirmed & Executed)" } 
              : m
          ));
          
          const confirmMsg = `Done. I've updated ${processedUpdates.length} record(s).`;
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: confirmMsg }]);
          speakResponse(confirmMsg);
      } else {
          const err = "Error: No changes found to apply.";
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: err }]);
          speakResponse(err);
      }
  };

  if (!isOpen) return null;

  // --- RENDER: HEADLESS VOICE MODE ---
  // In voice mode, we return null because the UI is handled by the parent's glowing button
  // and the interactions are purely audio-based.
  if (mode === 'voice') {
      return null;
  }

  // --- RENDER: PANEL MODE ---
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-600 rounded-lg shadow-lg shadow-violet-500/20">
                    <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Side Brain</h3>
                    <p className="text-[10px] text-slate-500">AI Assistant for {org.name}</p>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-black/20">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                        msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-none shadow-sm'
                    }`}>
                        <div className="mb-1 opacity-50 text-[10px] uppercase font-bold flex items-center gap-1">
                            {msg.role === 'user' ? <UserIcon className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                            {msg.role === 'user' ? 'You' : 'AI Assistant'}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                        {/* Action Confirmation Card */}
                        {msg.isConfirmation && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold text-xs mb-2">
                                    <AlertTriangle className="w-4 h-4" /> Confirmation Required
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                    This action will modify data in the current view.
                                </p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => confirmAction(msg.id)}
                                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1"
                                    >
                                        <CheckCircle className="w-3 h-3" /> Yes, Confirm
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isConfirmation: false, text: m.text + " (Cancelled)" } : m));
                                        }}
                                        className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
            {isProcessing && (
                <div className="flex justify-start animate-pulse">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                        <span className="text-xs text-slate-500">Thinking...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
            <div className="relative flex items-center gap-2">
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={org.features.aiAccessLevel === 'read-only' ? "Ask me about the data..." : "Ask, command, or filter..."}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 border-transparent focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 rounded-xl px-4 py-2.5 text-sm outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                />
                <button 
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isProcessing}
                    className="p-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl shadow-lg shadow-violet-600/20 transition-all flex-none"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 text-center">
                {org.features.aiAccessLevel === 'read-only' ? 'AI is in Read-Only Mode. Updates disabled.' : 'AI can update records and control cockpit filters.'}
            </div>
        </div>
    </div>
  );
};
