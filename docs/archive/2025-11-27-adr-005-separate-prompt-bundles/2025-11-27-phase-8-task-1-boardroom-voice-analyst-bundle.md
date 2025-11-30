# Phase 8 Task 8.1: Boardroom Voice Analyst (UC 21) - Complete Prompt Bundle

**Agent Assignment**: `ai-systems-architect`
**Estimated Duration**: 0.5 days
**Status**: Ready for Execution
**Dependencies**: Phase 6 Complete (AI Foundation)

---

## 🎯 Executive Summary

**Mission**: Implement a voice-enabled conversational BI interface that allows BEO executives (CFOs, COOs) to ask natural language questions about portfolio performance and receive intelligent, contextual responses in both voice and text formats.

**Business Value**:
- **Executive Time Savings**: 80% faster than navigating dashboards manually
- **Accessibility**: Voice queries enable hands-free operation during meetings
- **Actionable Insights**: AI identifies root causes and recommends actions
- **Persona Adaptation**: CFO gets financial emphasis, COO gets operational emphasis

**Key Deliverables**:
1. `BeoAnalyticsService.ts` - Portfolio query processing with AI
2. `VoiceAnalyst.tsx` - Voice-enabled frontend component with Web Speech API
3. Voice-to-text + text-to-speech integration
4. Executive persona detection and response adaptation
5. Follow-up question context preservation
6. Sub-3-second query response time

---

## 📋 Context & Requirements

### Use Case 21: Boardroom Voice Analyst

**User Story**:
> As a **CFO** (BEO user with portfolio access),
> I want to **ask natural language questions via voice or text** (e.g., "Which projects are over budget?"),
> so that I can **get instant portfolio insights without navigating complex dashboards** during board meetings.

**Key Features**:

1. **Voice Input** (Web Speech API):
   - Large microphone button with waveform animation during recording
   - Real-time speech-to-text transcription displayed to user
   - Text fallback for accessibility or noisy environments
   - Keyboard shortcut: `Ctrl+M` to activate microphone

2. **Conversational BI**:
   - Natural language query parsing: "Which projects are over budget?"
   - AI analyzes portfolio-wide data across all organizations
   - Responds in conversational tone with executive-level language
   - Example response: "Three of your seven projects are trending over budget this quarter: HOLNG (+$450K), RIO (+$280K), PEMS (+$95K)..."

3. **Voice Output** (Text-to-Speech):
   - Audio playback button for AI responses
   - Optimized for TTS: Avoids "$" symbols, uses "dollars"
   - Concise responses (<500 chars for voice, full details in card)

4. **Executive Persona Adaptation**:
   - Detects user role (CFO vs. COO) from user profile
   - CFO responses emphasize: Budget, variance, financial impact
   - COO responses emphasize: Schedule, delays, operational issues

5. **Follow-up Context**:
   - Preserves conversation context for multi-turn queries
   - User asks: "Which projects are over budget?" → AI responds
   - User follows up: "Tell me more about HOLNG" → AI provides deep dive

6. **Performance**:
   - Query response time: **<3 seconds** (executive experience requirement)
   - Latency budget: 1s backend query + 1s AI processing + 1s UI render

---

## 🛠️ Technical Specifications

### Backend Implementation

**File**: `backend/src/services/ai/BeoAnalyticsService.ts`

**Core Methods**:

```typescript
export class BeoAnalyticsService {
  /**
   * Answer portfolio-level queries with conversational voice interface
   *
   * @param params.userId - User making the query (must have BEO access)
   * @param params.query - Natural language query (e.g., "Which projects are over budget?")
   * @param params.responseFormat - 'conversational' (for voice) or 'structured' (for charts)
   * @param params.context - Optional queryId from previous query for follow-up questions
   *
   * @returns {Object} AI-generated response with narrative, metrics, and breakdown
   */
  async answerPortfolioQuery(params: {
    userId: string;
    query: string;
    responseFormat: 'conversational' | 'structured';
    context?: string; // Previous queryId for follow-up questions
  }): Promise<{
    queryId: string; // For context preservation
    narrative: string; // Conversational summary (2-3 sentences)
    voiceResponse?: string; // TTS-optimized version (<500 chars, no "$")
    executiveSummary: {
      portfolioVariance: string; // e.g., "+$825K"
      projectsAtRisk: number; // Count of over-budget projects
      totalSpend: string; // e.g., "$11.2M"
      organization?: string; // For drill-down queries
    };
    detailedBreakdown: Array<{
      organizationCode: string;
      variance: number;
      variancePercent: number;
      reason: string; // Root cause (e.g., "Weather delays")
      actions?: string[]; // Recommended actions
    }>;
    confidence: number; // 0-1 confidence score for AI response
  }>;

  /**
   * Verify user has BEO portfolio access
   *
   * BEO users must have:
   * - Role: 'admin' or 'beo_viewer'
   * - Permission: 'perm_ViewAllOrgs' capability
   */
  private async verifyBeoAccess(userId: string): Promise<boolean>;

  /**
   * Get portfolio-wide data across all organizations
   *
   * Aggregates:
   * - Total Plan vs. Forecast vs. Actual costs
   * - Variance by organization
   * - Variance by category (cranes, scaffolds, etc.)
   * - Recent audit log activity (for root cause detection)
   */
  private async getPortfolioData(): Promise<PortfolioData>;

  /**
   * Detect executive persona from user profile
   *
   * Checks user.jobTitle or user.role:
   * - CFO, Finance Director → 'cfo' (emphasize financials)
   * - COO, Operations Manager → 'coo' (emphasize schedule)
   * - Default → 'executive' (balanced)
   */
  private detectPersona(userId: string): Promise<'cfo' | 'coo' | 'executive'>;

  /**
   * Generate AI prompt based on persona
   *
   * CFO Prompt Template:
   * "You are a CFO's executive assistant analyzing construction portfolio data.
   *  Focus on budget variance, financial impact, and cost trends.
   *  Query: '{query}'
   *  Portfolio Data: {portfolioData}
   *  Generate a conversational response emphasizing financial metrics."
   *
   * COO Prompt Template:
   * "You are a COO's operations assistant analyzing construction schedules.
   *  Focus on project delays, equipment availability, and resource utilization.
   *  Query: '{query}'
   *  Portfolio Data: {portfolioData}
   *  Generate a conversational response emphasizing operational metrics."
   */
  private generatePrompt(query: string, persona: string, portfolioData: any): string;

  /**
   * Convert text response to TTS-optimized format
   *
   * Transformations:
   * - "$450K" → "four hundred fifty thousand dollars"
   * - "18 cranes" → "eighteen cranes"
   * - "+12%" → "twelve percent increase"
   * - Remove technical jargon
   * - Keep <500 characters for natural speech flow
   */
  private toVoiceResponse(narrative: string): string;
}
```

**Database Schema Requirements**:

```prisma
model AiQueryLog {
  id              String   @id @default(cuid())
  queryId         String   @unique // For context preservation
  userId          String
  query           String
  response        Json     // Full AI response
  persona         String   // 'cfo', 'coo', 'executive'
  confidence      Float
  responseTime    Int      // Milliseconds
  createdAt       DateTime @default(now())

  // Relations
  user            User     @relation(fields: [userId], references: [id])

  @@index([userId, createdAt]) // For recent queries UI
}
```

**API Endpoints**:

```typescript
// POST /api/beo/query
router.post('/query', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const { query, responseFormat, context } = req.body;

  const result = await beoAnalyticsService.answerPortfolioQuery({
    userId: req.user!.id,
    query,
    responseFormat: responseFormat || 'conversational',
    context,
  });

  res.json(result);
});

// GET /api/beo/recent-queries
router.get('/recent-queries', requirePermission('perm_ViewAllOrgs'), async (req, res) => {
  const queries = await prisma.aiQueryLog.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json(queries);
});
```

---

### Frontend Implementation

**File**: `components/beo/VoiceAnalyst.tsx`

**Component Structure**:

```tsx
import { Mic, MicOff, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClient } from '../../services/apiClient';

interface BeoQueryResponse {
  queryId: string;
  narrative: string;
  voiceResponse?: string;
  executiveSummary: {
    portfolioVariance: string;
    projectsAtRisk: number;
    totalSpend: string;
    organization?: string;
  };
  detailedBreakdown: Array<{
    organizationCode: string;
    variance: number;
    variancePercent: number;
    reason: string;
    actions?: string[];
  }>;
  confidence: number;
}

export function VoiceAnalyst() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState<BeoQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [contextQueryId, setContextQueryId] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState(false);

  // Load recent queries on mount
  useEffect(() => {
    loadRecentQueries();
  }, []);

  // Keyboard shortcut: Ctrl+M to activate microphone
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        startListening();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const loadRecentQueries = async () => {
    const queries = await apiClient.getBeoRecentQueries();
    setRecentQueries(queries.map((q: any) => q.query));
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    setListening(true);
    setTranscript('');

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);

      if (event.results[current].isFinal) {
        submitQuery(transcriptText);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };

  const stopListening = () => {
    setListening(false);
    // Recognition will auto-stop via onend handler
  };

  const submitQuery = async (query: string) => {
    setLoading(true);
    setListening(false);

    try {
      const result = await apiClient.queryBeoAnalytics({
        query,
        responseFormat: 'conversational',
        context: contextQueryId,
      });

      setResponse(result);
      setContextQueryId(result.queryId); // Preserve context for follow-ups
      setRecentQueries([query, ...recentQueries.slice(0, 9)]); // Add to recent

      // Text-to-speech playback
      if (result.voiceResponse) {
        playVoiceResponse(result.voiceResponse);
      }
    } catch (error) {
      console.error('Query failed:', error);
      alert('Failed to process query. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const playVoiceResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="voice-analyst p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">💼 Executive Dashboard</h1>
        <p className="text-gray-600 mt-1">Ask questions about your portfolio performance</p>
      </div>

      {/* Voice Input Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          🎤 Ask a Question
        </h2>

        {/* Microphone Button */}
        <div className="flex flex-col items-center mb-4">
          <button
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              listening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {listening ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
          </button>

          <p className="text-sm text-gray-600 mt-2">
            {listening ? '🔴 Listening...' : 'Tap to speak or type below'}
          </p>
          <p className="text-xs text-gray-500">Keyboard: Ctrl+M</p>
        </div>

        {/* Waveform Animation (when listening) */}
        {listening && (
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-500 rounded animate-waveform"
                style={{
                  height: `${Math.random() * 40 + 10}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Live Transcript */}
        {transcript && (
          <div className="bg-blue-50 p-3 rounded mb-4">
            <p className="text-sm text-gray-700">"{transcript}"</p>
          </div>
        )}

        {/* Text Input Fallback */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type your question..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                submitQuery(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = (e.currentTarget.previousSibling as HTMLInputElement);
              if (input.value.trim()) {
                submitQuery(input.value);
                input.value = '';
              }
            }}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Ask
          </button>
        </div>

        {/* Recent Queries */}
        {recentQueries.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Recent Queries:</p>
            <ul className="space-y-1">
              {recentQueries.slice(0, 3).map((query, i) => (
                <li key={i}>
                  <button
                    onClick={() => submitQuery(query)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    • {query}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing portfolio data...</p>
        </div>
      )}

      {/* AI Response Card */}
      {response && !loading && (
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Response Header */}
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              🤖 Portfolio Variance Analysis
            </h2>
            <button
              onClick={() => playVoiceResponse(response.voiceResponse || response.narrative)}
              className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
            >
              <Volume2 className="w-4 h-4" />
              Play Audio
            </button>
          </div>

          {/* Narrative Summary */}
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="text-lg text-gray-800 leading-relaxed">{response.narrative}</p>
            {response.confidence < 0.8 && (
              <p className="text-xs text-orange-600 mt-2">
                ⚠️ Confidence: {Math.round(response.confidence * 100)}% - Verify critical decisions
              </p>
            )}
          </div>

          {/* Executive Summary Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-1">Portfolio Variance</h4>
              <p className="text-2xl font-bold text-red-600">
                {response.executiveSummary.portfolioVariance}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-1">Projects at Risk</h4>
              <p className="text-2xl font-bold text-orange-600">
                {response.executiveSummary.projectsAtRisk}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-600 mb-1">Total Spend</h4>
              <p className="text-2xl font-bold text-blue-600">
                {response.executiveSummary.totalSpend}
              </p>
            </div>
          </div>

          {/* Detailed Breakdown (Collapsible) */}
          <div className="border-t pt-4">
            <button
              onClick={() => setExpandedBreakdown(!expandedBreakdown)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="font-semibold text-gray-900">Detailed Breakdown</h3>
              {expandedBreakdown ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {expandedBreakdown && (
              <div className="mt-4 space-y-4">
                {response.detailedBreakdown.map((item, i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {i + 1}. {item.organizationCode}
                      </h4>
                      <span
                        className={`text-lg font-bold ${
                          item.variance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {item.variance > 0 ? '+' : ''}${item.variance.toLocaleString()} (
                        {item.variancePercent > 0 ? '+' : ''}
                        {item.variancePercent}%)
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Driver:</span> {item.reason}
                    </p>

                    {item.actions && item.actions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          💡 Recommended Actions:
                        </p>
                        <ul className="space-y-1">
                          {item.actions.map((action, j) => (
                            <li key={j} className="text-xs text-gray-700">
                              • {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition">
              📊 Export Report
            </button>
            <button
              onClick={() => {
                setResponse(null);
                setContextQueryId(null);
              }}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
            >
              💬 Ask Follow-up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**CSS Animations** (add to `globals.css`):

```css
@keyframes waveform {
  0%, 100% { height: 10px; }
  50% { height: 40px; }
}

.animate-waveform {
  animation: waveform 0.8s ease-in-out infinite;
}
```

---

## 🧪 Testing Requirements

### Test Suite Location
**File**: `backend/tests/integration/beoVoiceAnalyst.test.ts`

### Test Scenarios (from TEST_PLAN.md lines 1678-1783)

```typescript
describe('Use Case 21: Boardroom Voice Analyst', () => {
  let beoUser: User;
  let regularUser: User;

  beforeEach(async () => {
    // Create BEO user with portfolio access
    beoUser = await prisma.user.create({
      data: {
        username: 'cfo-test',
        passwordHash: await bcrypt.hash('test123', 10),
        jobTitle: 'CFO',
        userOrganizations: {
          create: {
            organizationId: 'ALL_ORGS',
            role: 'admin',
            capabilities: ['perm_ViewAllOrgs'],
          },
        },
      },
    });

    // Create regular user WITHOUT portfolio access
    regularUser = await prisma.user.create({
      data: {
        username: 'pm-test',
        passwordHash: await bcrypt.hash('test123', 10),
        userOrganizations: {
          create: {
            organizationId: 'HOLNG',
            role: 'user',
            capabilities: ['perm_View'],
          },
        },
      },
    });

    // Seed test PFA data with variances
    await prisma.pfaRecord.createMany({
      data: [
        {
          id: 'pfa-1',
          organizationId: 'HOLNG',
          planCost: 1000000,
          forecastCost: 1450000, // +$450K variance
          category: 'Crane - Mobile',
        },
        {
          id: 'pfa-2',
          organizationId: 'RIO',
          planCost: 800000,
          forecastCost: 1080000, // +$280K variance
          category: 'Generator',
        },
        {
          id: 'pfa-3',
          organizationId: 'PEMS_Global',
          planCost: 500000,
          forecastCost: 595000, // +$95K variance
          category: 'Scaffolding',
        },
      ],
    });
  });

  // Test 1: Portfolio Variance Query
  it('should answer "Which projects are over budget?"', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Which projects are trending over budget and why?',
        responseFormat: 'conversational',
      });

    expect(response.status).toBe(200);
    expect(response.body.narrative).toContain('Three of your seven projects');
    expect(response.body.executiveSummary.portfolioVariance).toContain('+$825K');
    expect(response.body.executiveSummary.projectsAtRisk).toBe(3);
    expect(response.body.detailedBreakdown.length).toBe(3);
    expect(response.body.confidence).toBeGreaterThan(0.9);
  });

  // Test 2: Voice Response Generation
  it('should generate natural voice response', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Portfolio status?',
        responseFormat: 'conversational',
      });

    expect(response.body.voiceResponse).toBeTruthy();
    expect(response.body.voiceResponse.length).toBeLessThan(500); // Concise for TTS
    expect(response.body.voiceResponse).not.toContain('$'); // No dollar signs (say "dollars")
  });

  // Test 3: Follow-up Question Context
  it('should handle follow-up "Tell me more about HOLNG"', async () => {
    const initial = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Which projects are over budget?',
        responseFormat: 'conversational',
      });

    const followup = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Tell me more about HOLNG',
        context: initial.body.queryId,
        responseFormat: 'conversational',
      });

    expect(followup.status).toBe(200);
    expect(followup.body.narrative).toContain('$450K');
    expect(followup.body.narrative).toContain('Weather');
    expect(followup.body.executiveSummary.organization).toBe('HOLNG');
  });

  // Test 4: Executive Persona Adaptation
  it('should adapt response for CFO vs. COO', async () => {
    // Create COO user
    const cooUser = await prisma.user.create({
      data: {
        username: 'coo-test',
        passwordHash: await bcrypt.hash('test123', 10),
        jobTitle: 'COO',
        userOrganizations: {
          create: {
            organizationId: 'ALL_ORGS',
            role: 'admin',
            capabilities: ['perm_ViewAllOrgs'],
          },
        },
      },
    });

    const cfoResponse = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({ query: 'Project status?', responseFormat: 'conversational' });

    const cooResponse = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(cooUser)}`)
      .send({ query: 'Project status?', responseFormat: 'conversational' });

    // CFO response emphasizes financials
    expect(cfoResponse.body.narrative).toContain('budget');
    expect(cfoResponse.body.narrative).toContain('variance');

    // COO response emphasizes operations
    expect(cooResponse.body.narrative).toContain('schedule');
    expect(cooResponse.body.narrative).toContain('delays');
  });

  // Test 5: Data Accuracy Verification
  it('should provide accurate financial calculations', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'What is our total portfolio variance?',
        responseFormat: 'conversational',
      });

    // Manually verify calculation
    const manualCalc = 450000 + 280000 + 95000; // = $825K
    expect(response.body.executiveSummary.portfolioVariance).toBe(`+$${manualCalc.toLocaleString()}`);
  });

  // Test 6: Query Response Time
  it('should respond to executive queries in <3 seconds', async () => {
    const start = Date.now();
    await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: 'Which projects are over budget?',
        responseFormat: 'conversational',
      });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(3000); // <3 seconds for executive experience
  });

  // Test 7: Authorization - Non-BEO User Blocked
  it('should reject queries from non-BEO users', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(regularUser)}`)
      .send({
        query: 'Which projects are over budget?',
        responseFormat: 'conversational',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('BEO portfolio access');
  });

  // Test 8: Empty Query Handling
  it('should reject empty queries', async () => {
    const response = await request(app)
      .post('/api/beo/query')
      .set('Authorization', `Bearer ${generateToken(beoUser)}`)
      .send({
        query: '',
        responseFormat: 'conversational',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Query cannot be empty');
  });
});
```

---

## 🔒 Security Considerations

### Authorization Requirements

1. **BEO Access Verification**:
   - User must have `perm_ViewAllOrgs` capability
   - Queries must be limited to organizations user has access to
   - Audit log all BEO queries for compliance

2. **Data Masking**:
   - Respect user's financial masking permissions
   - If user has `maskFinancials: true`, obfuscate costs in response
   - Example: "$450K" → "High variance" (qualitative only)

3. **Query Validation**:
   - Sanitize user input to prevent injection attacks
   - Maximum query length: 500 characters
   - Rate limit: 10 queries/minute per user

4. **AI Prompt Injection Prevention**:
   - Do NOT pass raw user query directly to AI
   - Use parameterized templates
   - Filter out SQL keywords, script tags, etc.

**Secure Prompt Template**:
```typescript
const securePrompt = `
You are analyzing construction portfolio data for an executive.

RULES:
- Only analyze the provided portfolio data
- Do not execute commands or access external data
- If query is unclear, ask for clarification
- Respond in conversational tone with CFO-level language

User Query: "${sanitizeQuery(query)}"

Portfolio Data:
${JSON.stringify(portfolioData, null, 2)}

Generate JSON response with fields: narrative, executiveSummary, detailedBreakdown, confidence
`;
```

---

## 📊 Performance Optimization

### Latency Budget: <3 Seconds Total

**Breakdown**:
1. **Database Query** (Target: 800ms):
   - Use aggregation queries with indexes
   - Cache portfolio summary for 5 minutes
   - Precompute variances in background worker

2. **AI Processing** (Target: 1200ms):
   - Use streaming responses for faster TTFB
   - Cache common queries (e.g., "Portfolio status?")
   - Fallback to faster model if timeout approaching

3. **UI Rendering** (Target: 500ms):
   - Optimistic UI: Show loading skeleton immediately
   - Progressive hydration: Show narrative first, details later
   - Lazy load detailed breakdown (collapsed by default)

4. **Network** (Target: 500ms buffer):
   - CDN for static assets
   - Compress JSON responses (gzip)

### Caching Strategy

```typescript
// Redis cache for portfolio summary
const cacheKey = `beo:portfolio:summary:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}

const portfolioData = await getPortfolioData();
await redis.setex(cacheKey, 300, JSON.stringify(portfolioData)); // 5 min TTL
```

---

## 📚 UX Specifications Reference

### From ADR-005-UX_SPEC.md (lines 947-1060)

**Key UX Requirements**:

1. **Visual Hierarchy**:
   - Large microphone button (96px × 96px) as primary CTA
   - Secondary text input below for accessibility
   - Recent queries as tertiary quick actions

2. **Feedback States**:
   - **Idle**: Blue microphone, "Tap to speak"
   - **Listening**: Red pulsing microphone, waveform animation
   - **Processing**: Spinner, "Analyzing portfolio data..."
   - **Response**: AI card with audio playback button

3. **Accessibility**:
   - Keyboard shortcut: `Ctrl+M` to activate microphone
   - Text input fallback for voice
   - Audio responses have text transcripts
   - Screen reader: "12 projects analyzed, 3 at risk"

4. **Responsive Design**:
   - **Desktop**: Side-by-side layout (query left, response right)
   - **Tablet**: Stacked layout (query top, response bottom)
   - **Mobile**: Single column, collapsible breakdown

5. **Color Coding**:
   - **Red**: Over budget, critical variance
   - **Orange**: Moderate variance, requires attention
   - **Blue**: Neutral info, total spend metrics
   - **Green**: Under budget, positive variance

---

## 🚀 Implementation Checklist

### Backend Tasks

- [ ] **Create `BeoAnalyticsService.ts`**:
  - [ ] Implement `answerPortfolioQuery()` method
  - [ ] Implement `verifyBeoAccess()` permission check
  - [ ] Implement `getPortfolioData()` aggregation
  - [ ] Implement `detectPersona()` based on user.jobTitle
  - [ ] Implement `generatePrompt()` with persona templates
  - [ ] Implement `toVoiceResponse()` TTS optimization

- [ ] **Database Schema**:
  - [ ] Create `AiQueryLog` model (Prisma schema)
  - [ ] Run migration: `npx prisma migrate dev --name add_ai_query_log`
  - [ ] Add indexes on `userId`, `createdAt`

- [ ] **API Routes**:
  - [ ] Create `POST /api/beo/query` endpoint
  - [ ] Create `GET /api/beo/recent-queries` endpoint
  - [ ] Add `requirePermission('perm_ViewAllOrgs')` middleware
  - [ ] Add rate limiting (10 queries/minute)

- [ ] **Performance**:
  - [ ] Add Redis caching for portfolio summary (5 min TTL)
  - [ ] Add database indexes on `pfaRecord.organizationId`
  - [ ] Optimize aggregation queries with EXPLAIN

### Frontend Tasks

- [ ] **Create `VoiceAnalyst.tsx` Component**:
  - [ ] Implement microphone button with Web Speech API
  - [ ] Implement waveform animation during listening
  - [ ] Implement text input fallback
  - [ ] Implement keyboard shortcut (`Ctrl+M`)
  - [ ] Implement TTS playback with `speechSynthesis`
  - [ ] Implement context preservation for follow-ups
  - [ ] Implement recent queries UI

- [ ] **API Client Methods**:
  - [ ] Add `queryBeoAnalytics()` to `apiClient.ts`
  - [ ] Add `getBeoRecentQueries()` to `apiClient.ts`

- [ ] **Styling**:
  - [ ] Add waveform animation keyframes to `globals.css`
  - [ ] Add responsive breakpoints (mobile, tablet, desktop)
  - [ ] Add loading skeleton for AI responses

### Testing Tasks

- [ ] **Unit Tests** (`beoAnalyticsService.test.ts`):
  - [ ] Test `verifyBeoAccess()` for BEO vs. regular users
  - [ ] Test `detectPersona()` for CFO vs. COO
  - [ ] Test `toVoiceResponse()` text transformations

- [ ] **Integration Tests** (`beoVoiceAnalyst.test.ts`):
  - [ ] Test 1: Portfolio variance query
  - [ ] Test 2: Voice response generation
  - [ ] Test 3: Follow-up question context
  - [ ] Test 4: Persona adaptation (CFO vs. COO)
  - [ ] Test 5: Data accuracy verification
  - [ ] Test 6: Query response time (<3s)
  - [ ] Test 7: Authorization (non-BEO blocked)
  - [ ] Test 8: Empty query handling

- [ ] **E2E Tests** (`voiceAnalystE2E.test.ts`):
  - [ ] Test voice input flow (requires headless browser with audio)
  - [ ] Test TTS playback
  - [ ] Test keyboard shortcuts

### Documentation Tasks

- [ ] **API Documentation**:
  - [ ] Document `POST /api/beo/query` in API_REFERENCE.md
  - [ ] Document request/response schemas
  - [ ] Add example queries and responses

- [ ] **User Guide**:
  - [ ] Add "Voice Analyst" section to USER_GUIDE.md
  - [ ] Include screenshots of voice input flow
  - [ ] List supported query types

---

## 🎯 Acceptance Criteria

### Functional Requirements

✅ **BEO users can ask natural language portfolio queries**
- Voice input via microphone button
- Text input fallback available
- Keyboard shortcut (`Ctrl+M`) works

✅ **AI provides accurate conversational responses**
- Narrative summary matches portfolio data
- Executive summary metrics are correct
- Detailed breakdown includes root causes

✅ **Persona adaptation works**
- CFO users see financial emphasis (budget, variance)
- COO users see operational emphasis (schedule, delays)

✅ **Follow-up questions preserve context**
- Initial query: "Which projects are over budget?"
- Follow-up: "Tell me more about HOLNG" → AI remembers context

✅ **Voice output works**
- Text-to-speech playback available
- Voice response optimized for TTS (<500 chars, no "$")

### Non-Functional Requirements

✅ **Performance**:
- Query response time: <3 seconds (95th percentile)
- Database queries: <800ms
- AI processing: <1200ms

✅ **Security**:
- Non-BEO users receive 403 error
- Query input sanitized (no injection attacks)
- Audit log records all queries

✅ **Accessibility**:
- Voice input has text fallback
- Audio responses have text transcripts
- Screen reader compatible
- WCAG 2.1 AA compliant

✅ **Reliability**:
- AI confidence score displayed
- Graceful degradation if AI fails (fallback to structured data)
- Rate limiting prevents abuse (10 queries/minute)

---

## 📝 Notes for Implementation

### AI Provider Recommendations

**Recommended**: Google Gemini Pro
- **Pros**: Fast (<1s latency), good at structured output, cost-effective
- **Cons**: Occasional hallucinations (mitigate with confidence scores)

**Fallback**: OpenAI GPT-4 Turbo
- **Pros**: Higher accuracy, better reasoning
- **Cons**: Slower (1.5-2s latency), more expensive

### Web Speech API Browser Support

**Supported**:
- Chrome/Edge: `webkitSpeechRecognition` ✅
- Safari: Partial support (iOS 14.5+) ✅

**Not Supported**:
- Firefox: ❌ (show alert, redirect to text input)

**Polyfill**: Consider using Azure Speech SDK for Firefox users.

### TTS Optimization Tips

**Convert**:
- "$450K" → "four hundred fifty thousand dollars"
- "+12%" → "twelve percent increase"
- "HOLNG" → "H O L N G" (spell acronyms)

**Avoid**:
- Technical jargon ("PFA", "DOR", "BEO")
- Long numbers (round to nearest thousand)
- Nested clauses (keep sentences short)

---

## 🔗 Related Documentation

- **ADR-005-AI_OPPORTUNITIES.md**: Use Case 21 specification
- **ADR-005-UX_SPEC.md**: Visual design mockups (lines 947-1060)
- **ADR-005-TEST_PLAN.md**: Test scenarios (lines 1678-1783)
- **ADR-005-IMPLEMENTATION_PLAN.md**: Technical specs (lines 3820-3990)

---

**End of Prompt Bundle: Task 8.1 - Boardroom Voice Analyst**

**Status**: Ready for Execution by `ai-systems-architect`
**Estimated Completion**: 0.5 days
**Next Task**: 8.2 - Narrative Variance Generator
