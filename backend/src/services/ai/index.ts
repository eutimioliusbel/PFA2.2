// backend/src/services/ai/index.ts
/**
 * AI Services Index
 *
 * Exports all AI-related services for the PFA Vanguard application.
 * Implements ADR-005 Multi-Tenant Access Control AI features.
 */

// ============================================================================
// Phase 7 - UX Intelligence Services
// ============================================================================

// UC-16: Context-Aware Access Explanation
export {
  PermissionExplanationService,
  default as permissionExplanationService,
} from './PermissionExplanationService';

// UC-17: Financial Data Masking
export { financialMaskingService } from './FinancialMaskingService';

// UC-18: Semantic Audit Search
export { semanticAuditSearchService } from './SemanticAuditSearchService';

// UC-19: Role Drift Detection
export { roleDriftDetectionService } from './RoleDriftDetectionService';

// UC-20: Behavioral Quiet Mode (Notification Timing)
export { notificationTimingService } from './NotificationTimingService';

// ============================================================================
// Phase 6 - AI Foundation Services
// ============================================================================

// AI Permission Suggestions
export { PermissionSuggestionService } from './PermissionSuggestionService';

// Anomaly Detection
export { AnomalyDetectionService } from './AnomalyDetectionService';

// Natural Language Permissions
export { NaturalLanguagePermissionService } from './NaturalLanguagePermissionService';

// Financial Access Monitoring
export { FinancialAccessMonitoringService } from './FinancialAccessMonitoringService';

// ============================================================================
// Phase 9 - AI Optimization Services
// ============================================================================

// 9.1: Model Selection & Performance Tuning
export {
  ModelSelector,
  modelSelector,
  default as modelSelectorDefault,
  type ModelConfig,
  type UseCaseRequirements,
  type CostReport,
} from './ModelSelector';

// 9.1: A/B Testing
export {
  AbTestService,
  abTestService,
  default as abTestServiceDefault,
  type AbTestConfig,
  type AbTestResult,
} from './AbTestService';

// 9.1: Performance Monitoring
export {
  PerformanceMonitor,
  performanceMonitor,
  default as performanceMonitorDefault,
  type PerformanceMetrics,
  type PerformanceSummary,
} from './PerformanceMonitor';

// 9.2: Prompt Template Management
export {
  PromptTemplateManager,
  promptTemplateManager,
  default as promptTemplateManagerDefault,
  type PromptTemplate,
  type InterpolatedPrompt,
} from './PromptTemplateManager';

// 9.3: Response Caching
export {
  AIResponseCache,
  aiResponseCache,
  default as aiResponseCacheDefault,
  type CacheEntry,
  type CacheConfig,
  type CacheStats,
} from './AIResponseCache';

// 9.4: Circuit Breaker & Fallbacks
export {
  AICircuitBreaker,
  aiCircuitBreaker,
  default as aiCircuitBreakerDefault,
  type CircuitState,
  type ProviderHealth,
  type FallbackResponse,
} from './AICircuitBreaker';
