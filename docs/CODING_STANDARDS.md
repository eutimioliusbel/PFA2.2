# PFA Vanguard Coding Standards

**Enterprise-Grade Code Quality Standards for React + TypeScript + Express + Prisma**

> **Purpose:** This document defines the code quality standards that all contributors must follow to maintain enterprise-grade code quality in the PFA Vanguard codebase.

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [TypeScript Standards](#2-typescript-standards)
3. [React Standards](#3-react-standards)
4. [Backend Standards (Express)](#4-backend-standards-express)
5. [Database Standards (Prisma)](#5-database-standards-prisma)
6. [File Organization](#6-file-organization)
7. [Naming Conventions](#7-naming-conventions)
8. [Error Handling](#8-error-handling)
9. [Security Standards](#9-security-standards)
10. [Performance Standards](#10-performance-standards)
11. [Code Documentation](#11-code-documentation)
12. [Testing Standards](#12-testing-standards)
13. [Import/Export Conventions](#13-importexport-conventions)
14. [Async/Await Patterns](#14-asyncawait-patterns)
15. [Project-Specific Patterns](#15-project-specific-patterns)
16. [Common Pitfalls](#16-common-pitfalls)
17. [Code Review Checklist](#17-code-review-checklist)

---

## 1. Core Principles

### The Five Pillars of Code Quality

1. **Type Safety First**
   - TypeScript strict mode enabled
   - No `any` types without explicit justification
   - Explicit return types on all functions

2. **Simplicity Over Cleverness**
   - Prefer readable code over clever one-liners
   - Avoid unnecessary abstractions
   - Code should be self-documenting

3. **Security by Default**
   - Never trust user input
   - Validate at boundaries
   - Sanitize outputs

4. **Performance Conscious**
   - Avoid unnecessary re-renders
   - Optimize database queries
   - Profile before optimizing

5. **Testability**
   - Pure functions where possible
   - Dependency injection
   - Avoid side effects in business logic

### The 20-Line Rule

**No function should exceed 20 lines of code.**

If a function is longer:
1. Break it into smaller, single-purpose functions
2. Extract complex logic into utility functions
3. Use early returns to reduce nesting

**Exceptions:**
- JSX render functions (but still keep under 50 lines)
- Configuration objects
- Large switch statements (consider object lookup instead)

---

## 2. TypeScript Standards

### 2.1 Strict Mode

**Always use TypeScript strict mode.**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

### 2.2 No `any` Type

**L NEVER use `any` without explicit justification.**

```typescript
// L BAD
function processData(data: any) {
  return data.map((item: any) => item.value);
}

//  GOOD
function processData(data: PfaRecord[]) {
  return data.map((item) => item.forecastCost);
}

//   ACCEPTABLE (with comment explaining why)
function handleLegacyAPI(response: any) { // Legacy API has no types
  return response as PemsApiResponse;
}
```

### 2.3 Explicit Return Types

**All functions must have explicit return types.**

```typescript
// L BAD
function calculateCost(record: PfaRecord, days: number) {
  if (record.source === 'Rental') {
    return (days / 30.44) * record.monthlyRate;
  }
  return record.purchasePrice;
}

//  GOOD
function calculateCost(record: PfaRecord, days: number): number {
  if (record.source === 'Rental') {
    return (days / 30.44) * record.monthlyRate;
  }
  return record.purchasePrice;
}
```

### 2.4 Interface vs. Type

**Use `interface` for object shapes, `type` for unions/intersections.**

```typescript
//  GOOD - Use interface for object shapes
interface PfaRecord {
  id: string;
  organizationId: number;
  forecastStart: Date;
  forecastEnd: Date;
}

//  GOOD - Use type for unions
type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

//  GOOD - Use type for complex compositions
type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: string;
};
```

### 2.5 Avoid Type Assertions

**Minimize use of `as` type assertions. Use type guards instead.**

```typescript
// L BAD
const value = response.data as PfaRecord;

//  GOOD
function isPfaRecord(value: unknown): value is PfaRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'organizationId' in value
  );
}

if (isPfaRecord(response.data)) {
  // TypeScript knows this is PfaRecord
  const record = response.data;
}
```

### 2.6 Enums vs. Union Types

**Prefer union types over enums for string constants.**

```typescript
// L AVOID (runtime overhead)
enum Status {
  Pending = 'PENDING',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED'
}

//  PREFER
type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

//  GOOD - With const object for iteration
const STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
} as const;

type Status = typeof STATUSES[keyof typeof STATUSES];
```

### 2.7 Utility Types

**Use TypeScript utility types for type transformations.**

```typescript
//  GOOD - Use Partial for optional fields
type UpdatePfaRequest = Partial<PfaRecord>;

//  GOOD - Use Pick for subset
type PfaTimeline = Pick<PfaRecord, 'id' | 'forecastStart' | 'forecastEnd'>;

//  GOOD - Use Omit to exclude fields
type PfaWithoutDates = Omit<PfaRecord, 'forecastStart' | 'forecastEnd'>;

//  GOOD - Use Required to make all fields required
type CompletePfaRecord = Required<PfaRecord>;
```

---

## 3. React Standards

### 3.1 Component Structure

**Order component elements consistently.**

```typescript
//  GOOD - Consistent component structure
export const Timeline: React.FC<TimelineProps> = ({
  assets,
  onUpdateAsset,
  scale
}) => {
  // 1. Hooks (in order: Context, State, Refs, Effects)
  const { currentUser } = useAuth();
  const [dragOverrides, setDragOverrides] = useState<Map<string, DragUpdate>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Effect logic
  }, [dependencies]);

  // 2. Event handlers
  const handleMouseDown = (event: React.MouseEvent): void => {
    // Handler logic
  };

  // 3. Render helpers
  const renderTimelineBars = (): JSX.Element => {
    // Render logic
  };

  // 4. Early returns
  if (!assets.length) {
    return <EmptyState message="No records to display" />;
  }

  // 5. Main render
  return (
    <div className="timeline-container">
      {/* JSX */}
    </div>
  );
};
```

### 3.2 Functional Components Only

**Use functional components with hooks. No class components.**

```typescript
// L BAD - Class components
class Timeline extends React.Component<TimelineProps> {
  render() {
    return <div>Timeline</div>;
  }
}

//  GOOD - Functional component
export const Timeline: React.FC<TimelineProps> = ({ assets }) => {
  return <div>Timeline</div>;
};
```

### 3.3 Props Interface

**Define props interface explicitly. Export for reuse.**

```typescript
//  GOOD
export interface TimelineProps {
  assets: PfaRecord[];
  onUpdateAsset: (id: string, updates: Partial<PfaRecord>) => void;
  onUpdateAssets: (updates: Array<{ id: string; updates: Partial<PfaRecord> }>) => void;
  scale: 'Day' | 'Week' | 'Month' | 'Year';
  className?: string; // Optional props last
}

export const Timeline: React.FC<TimelineProps> = (props) => {
  // Component
};
```

### 3.4 Hooks Rules

**Follow React hooks rules strictly.**

```typescript
//  GOOD - Hooks at top level
const Component: React.FC = () => {
  const [state, setState] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Effect
  }, [dependency]);

  return <div />;
};

// L BAD - Conditional hooks
const Component: React.FC = () => {
  if (condition) {
    const [state, setState] = useState(0); // L NEVER
  }
  return <div />;
};
```

### 3.5 Event Handlers

**Event handlers should be properly typed.**

```typescript
//  GOOD - Explicit event types
const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
  event.preventDefault();
  // Handler logic
};

const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
  setValue(event.target.value);
};

//  GOOD - Custom event data
const handleRecordUpdate = (id: string, updates: Partial<PfaRecord>): void => {
  onUpdateAsset(id, updates);
};
```

### 3.6 Avoid Inline Functions in JSX

**Define functions outside JSX to prevent unnecessary re-renders.**

```typescript
// L BAD - Creates new function on every render
return (
  <button onClick={() => handleClick(record.id)}>
    Click
  </button>
);

//  GOOD - Memoized callback
const handleButtonClick = useCallback(() => {
  handleClick(record.id);
}, [record.id]);

return (
  <button onClick={handleButtonClick}>
    Click
  </button>
);

//  ALSO GOOD - For simple cases with many items
return items.map(item => (
  <button key={item.id} onClick={() => handleClick(item.id)}>
    {item.name}
  </button>
));
```

### 3.7 Conditional Rendering

**Use early returns and logical operators cleanly.**

```typescript
//  GOOD - Early return for loading
if (isLoading) {
  return <LoadingSpinner />;
}

if (error) {
  return <ErrorMessage error={error} />;
}

//  GOOD - Logical AND for conditional render
return (
  <div>
    {user && <UserProfile user={user} />}
    {records.length > 0 && <RecordsList records={records} />}
  </div>
);

// L BAD - Ternary with null
return (
  <div>
    {user ? <UserProfile user={user} /> : null}
  </div>
);
```

### 3.8 Key Props

**Always use stable, unique keys for lists.**

```typescript
// L BAD - Index as key
records.map((record, index) => (
  <RecordRow key={index} record={record} />
));

// L BAD - Non-unique key
records.map((record) => (
  <RecordRow key={record.category} record={record} />
));

//  GOOD - Unique, stable ID
records.map((record) => (
  <RecordRow key={record.id} record={record} />
));
```

### 3.9 Refs Usage

**Use refs for DOM manipulation, not state.**

```typescript
//  GOOD - Ref for DOM access
const inputRef = useRef<HTMLInputElement>(null);

const focusInput = (): void => {
  inputRef.current?.focus();
};

return <input ref={inputRef} />;

// L BAD - Using ref for state
const countRef = useRef(0);
countRef.current++; // Use useState instead
```

### 3.10 Custom Hooks

**Extract reusable logic into custom hooks.**

```typescript
//  GOOD - Custom hook
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Usage
const Component: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    // Search with debounced value
  }, [debouncedSearch]);

  return <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />;
};
```

---

## 4. Backend Standards (Express)

### 4.1 Route Handler Structure

**Consistent structure for all route handlers.**

```typescript
//  GOOD
export const syncPemsData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract and validate parameters
    const { organizationId, syncType } = req.body;

    if (!organizationId) {
      res.status(400).json({
        error: 'Organization ID required',
        code: 'VALIDATION_MISSING_FIELD'
      });
      return;
    }

    // 2. Check authorization
    if (req.user.organizationId !== organizationId) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'AUTH_FORBIDDEN'
      });
      return;
    }

    // 3. Business logic (delegate to service)
    const result = await PemsSyncService.startSync(organizationId, syncType);

    // 4. Success response
    res.status(200).json({
      syncId: result.syncId,
      status: 'running',
      message: 'Sync started successfully'
    });
  } catch (error) {
    next(error); // Pass to error handler middleware
  }
};
```

### 4.2 Service Layer

**Separate business logic from HTTP concerns.**

```typescript
//  GOOD - Service layer
export class PemsSyncService {
  static async startSync(
    organizationId: number,
    syncType: 'full' | 'incremental'
  ): Promise<{ syncId: string; status: string }> {
    // Business logic here
    // No HTTP concerns (req, res, status codes)

    const syncId = generateSyncId();

    // Start background sync
    this.processSyncInBackground(syncId, organizationId, syncType);

    return { syncId, status: 'running' };
  }

  private static async processSyncInBackground(
    syncId: string,
    organizationId: number,
    syncType: 'full' | 'incremental'
  ): Promise<void> {
    // Background processing
  }
}
```

### 4.3 Error Handling

**Use centralized error handling middleware.**

```typescript
// middleware/errorHandler.ts
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err instanceof ValidationError) {
    res.status(400).json({
      error: err.message,
      code: 'VALIDATION_ERROR',
      details: err.details
    });
    return;
  }

  if (err instanceof AuthorizationError) {
    res.status(403).json({
      error: 'Forbidden',
      code: 'AUTH_FORBIDDEN'
    });
    return;
  }

  // Default error
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};
```

### 4.4 Middleware Order

**Apply middleware in correct order.**

```typescript
// server.ts
const app = express();

// 1. Security middleware first
app.use(helmet());
app.use(cors(corsOptions));

// 2. Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Logging
app.use(requestLogger);

// 4. Rate limiting
app.use('/api/', rateLimiter);

// 5. Authentication (for protected routes)
app.use('/api/protected', authenticateJWT);

// 6. Routes
app.use('/api/auth', authRoutes);
app.use('/api/pems', pemsRoutes);

// 7. Error handling last
app.use(errorHandler);
```

### 4.5 Async Route Handlers

**Always use try-catch or async middleware wrapper.**

```typescript
//  GOOD - Try-catch with next()
export const getRecords = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const records = await RecordService.getAll();
    res.json(records);
  } catch (error) {
    next(error);
  }
};

//  ALSO GOOD - Async wrapper
const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const getRecords = asyncHandler(async (req: Request, res: Response) => {
  const records = await RecordService.getAll();
  res.json(records);
});
```

---

## 5. Database Standards (Prisma)

### 5.1 Schema Naming

**Use PascalCase for models, camelCase for fields.**

```prisma
//  GOOD
model PfaRecord {
  id              Int      @id @default(autoincrement())
  organizationId  Int
  forecastStart   DateTime
  forecastEnd     DateTime
  monthlyRate     Float?

  organization    Organization @relation(fields: [organizationId], references: [id])
}
```

### 5.2 Query Optimization

**Always select only needed fields. Use include/select.**

```typescript
// L BAD - Fetches all fields
const records = await prisma.pfaRecord.findMany({
  where: { organizationId }
});

//  GOOD - Select only needed fields
const records = await prisma.pfaRecord.findMany({
  where: { organizationId },
  select: {
    id: true,
    forecastStart: true,
    forecastEnd: true,
    forecastCost: true
  }
});

//  GOOD - Include related data efficiently
const records = await prisma.pfaRecord.findMany({
  where: { organizationId },
  include: {
    organization: {
      select: {
        id: true,
        name: true
      }
    }
  }
});
```

### 5.3 Transactions

**Use transactions for multi-step operations.**

```typescript
//  GOOD - Transaction for atomic operations
const result = await prisma.$transaction(async (tx) => {
  // Update API configuration
  const config = await tx.apiConfiguration.update({
    where: { id: configId },
    data: {
      lastSyncAt: new Date(),
      lastSyncRecordCount: recordCount
    }
  });

  // Create audit log
  await tx.auditLog.create({
    data: {
      action: 'SYNC_COMPLETED',
      entityType: 'API_CONFIGURATION',
      entityId: configId,
      userId: req.user.id
    }
  });

  return config;
});
```

### 5.4 Batch Operations

**Use batch operations for performance.**

```typescript
// L BAD - Multiple individual queries
for (const record of records) {
  await prisma.pfaRecord.create({ data: record });
}

//  GOOD - Single batch insert
await prisma.pfaRecord.createMany({
  data: records,
  skipDuplicates: true
});

//  GOOD - Batch update
await prisma.pfaRecord.updateMany({
  where: {
    organizationId,
    isDiscontinued: false
  },
  data: {
    updatedAt: new Date()
  }
});
```

### 5.5 Error Handling

**Handle Prisma-specific errors.**

```typescript
//  GOOD
import { Prisma } from '@prisma/client';

try {
  const user = await prisma.user.create({ data: userData });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      throw new ValidationError('Username already exists');
    }

    // Foreign key constraint violation
    if (error.code === 'P2003') {
      throw new ValidationError('Invalid organization ID');
    }
  }

  throw error;
}
```

### 5.6 Soft Deletes

**Use soft deletes for important data.**

```prisma
// schema.prisma
model PfaRecord {
  id              Int       @id @default(autoincrement())
  isDeleted       Boolean   @default(false)
  deletedAt       DateTime?
}
```

```typescript
//  GOOD - Soft delete
await prisma.pfaRecord.update({
  where: { id },
  data: {
    isDeleted: true,
    deletedAt: new Date()
  }
});

//  GOOD - Query excluding deleted
const records = await prisma.pfaRecord.findMany({
  where: {
    organizationId,
    isDeleted: false
  }
});
```

---

## 6. File Organization

### 6.1 Frontend Structure

```
src/
   components/           # React components
      admin/           # Admin-specific components
         ApiConnectivity.tsx
         SystemManager.tsx
      common/          # Shared components
         Button.tsx
         Modal.tsx
         LoadingSpinner.tsx
      Timeline.tsx     # Major feature components
      CommandDeck.tsx
      README.md        # Component catalog

   contexts/            # React contexts
      AuthContext.tsx

   hooks/               # Custom hooks
      useDebounce.ts
      useAuth.ts

   services/            # API clients
      apiClient.ts
      pemsClient.ts

   utils/               # Pure utility functions
      calculations.ts
      dates.ts
      formatting.ts

   types.ts             # Shared TypeScript types
   constants.ts         # Application constants
   App.tsx              # Root component
```

### 6.2 Backend Structure

```
backend/
   prisma/
      schema.prisma    # Database schema
      migrations/      # Migration files
      seed.ts          # Seed data

   src/
      config/          # Configuration
         database.ts
         env.ts
   
      controllers/     # Route handlers
         authController.ts
         pemsSyncController.ts
   
      services/        # Business logic
         AuthService.ts
         PemsSyncService.ts
   
      middleware/      # Express middleware
         auth.ts
         errorHandler.ts
         rateLimiter.ts
   
      routes/          # Route definitions
         auth.ts
         pems.ts
   
      utils/           # Utilities
         logger.ts
         encryption.ts
   
      types/           # TypeScript types
         express.d.ts
   
      server.ts        # App entry point

   package.json
```

### 6.3 File Naming

- **Components:** PascalCase (e.g., `Timeline.tsx`, `CommandDeck.tsx`)
- **Utilities:** camelCase (e.g., `apiClient.ts`, `dateUtils.ts`)
- **Types:** camelCase (e.g., `types.ts`, `apiTypes.ts`)
- **Constants:** UPPER_SNAKE_CASE in file (e.g., `MAX_RECORDS = 800`)

---

## 7. Naming Conventions

### 7.1 Variables

```typescript
//  GOOD - Descriptive, camelCase
const userRecords: PfaRecord[] = [];
const isLoading: boolean = false;
const recordCount: number = 0;

// L BAD - Abbreviations, unclear
const recs = [];
const loading = false;
const cnt = 0;
```

### 7.2 Functions

```typescript
//  GOOD - Verb + noun, describes action
function calculateTotalCost(records: PfaRecord[]): number { }
function fetchUserData(userId: number): Promise<User> { }
function isValidEmail(email: string): boolean { }

// L BAD - Unclear purpose
function process(data: any) { }
function handler() { }
function doIt() { }
```

### 7.3 Components

```typescript
//  GOOD - PascalCase, descriptive noun
export const Timeline: React.FC<TimelineProps> = () => { };
export const CommandDeck: React.FC = () => { };
export const LoadingSpinner: React.FC = () => { };

// L BAD - Verb names, unclear
export const DoTimeline = () => { };
export const Show = () => { };
```

### 7.4 Boolean Variables

```typescript
//  GOOD - is/has/can prefix
const isLoading: boolean = true;
const hasError: boolean = false;
const canEdit: boolean = user.role === 'admin';

// L BAD - Ambiguous
const loading = true;
const error = false;
const edit = true;
```

### 7.5 Event Handlers

```typescript
//  GOOD - handle + Event + OptionalContext
const handleClick = (): void => { };
const handleRecordUpdate = (id: string): void => { };
const handleFormSubmit = (event: React.FormEvent): void => { };

// L BAD - Unclear
const click = () => { };
const update = () => { };
const onSubmit = () => { }; // "on" prefix for props, "handle" for handlers
```

### 7.6 Constants

```typescript
//  GOOD - UPPER_SNAKE_CASE for module-level constants
export const MAX_RECORDS_PER_PAGE = 800;
export const API_BASE_URL = 'http://localhost:3001';
export const DEFAULT_TIMEOUT_MS = 5000;

//  GOOD - PascalCase for config objects
export const DatabaseConfig = {
  host: 'localhost',
  port: 5432
} as const;
```

---

## 8. Error Handling

### 8.1 Custom Error Classes

```typescript
//  GOOD - Typed error classes
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// Usage
if (!isValid) {
  throw new ValidationError('Invalid email format', 'email');
}
```

### 8.2 Try-Catch Blocks

```typescript
//  GOOD - Specific error handling
try {
  const data = await fetchData();
  return processData(data);
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', { error: error.message, field: error.field });
    throw error; // Re-throw if caller should handle
  }

  if (error instanceof Error) {
    logger.error('Unexpected error', { error: error.message, stack: error.stack });
  }

  throw new Error('Failed to process data');
}

// L BAD - Silent failures
try {
  await saveData();
} catch (error) {
  console.log(error); // L Never use console.log for errors
}
```

### 8.3 Error Boundaries (React)

```typescript
//  GOOD - Error boundary for component trees
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('React error boundary caught error', {
      error: error.message,
      componentStack: errorInfo.componentStack
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>Something went wrong. Please refresh the page.</div>
      );
    }

    return this.props.children;
  }
}
```

### 8.4 Promise Error Handling

```typescript
//  GOOD - Always handle promise rejections
async function loadData(): Promise<void> {
  try {
    const data = await fetchData();
    setState(data);
  } catch (error) {
    setError(error);
  }
}

// L BAD - Unhandled promise rejection
function loadData() {
  fetchData().then(data => setState(data)); // L No catch
}
```

---

## 9. Security Standards

### 9.1 Input Validation

**Validate ALL user input at API boundaries.**

```typescript
//  GOOD - Input validation
import { z } from 'zod';

const CreatePfaSchema = z.object({
  organizationId: z.number().positive(),
  category: z.string().min(1).max(100),
  forecastStart: z.string().datetime(),
  monthlyRate: z.number().positive().optional()
});

export const createPfaRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validatedData = CreatePfaSchema.parse(req.body);

    // Process validated data
    const record = await PfaService.create(validatedData);

    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
      return;
    }
    throw error;
  }
};
```

### 9.2 SQL Injection Prevention

**Always use Prisma parameterization. NEVER string concatenation.**

```typescript
//  GOOD - Prisma handles parameterization
const records = await prisma.pfaRecord.findMany({
  where: {
    category: userInput // Safe - Prisma parameterizes
  }
});

// L BAD - Raw SQL with string interpolation
await prisma.$executeRawUnsafe(
  `SELECT * FROM PfaRecord WHERE category = '${userInput}'` // L SQL injection risk
);

//  GOOD - Raw SQL with parameters
await prisma.$executeRaw`
  SELECT * FROM PfaRecord WHERE category = ${userInput}
`; // Safe - parameterized
```

### 9.3 XSS Prevention

**React escapes by default. Be careful with dangerouslySetInnerHTML.**

```typescript
//  GOOD - React escapes automatically
return <div>{userInput}</div>;

//   DANGEROUS - Only use with sanitized HTML
import DOMPurify from 'dompurify';

const sanitizedHTML = DOMPurify.sanitize(userHTML);
return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;

// L NEVER - Raw HTML without sanitization
return <div dangerouslySetInnerHTML={{ __html: userHTML }} />;
```

### 9.4 Authentication & Authorization

**Check authorization on every protected route.**

```typescript
//  GOOD - Authorization middleware
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
};

// Usage
router.post('/admin/users', requireAdmin, createUser);
```

### 9.5 Secrets Management

**NEVER hardcode secrets. Use environment variables.**

```typescript
// L BAD - Hardcoded secrets
const JWT_SECRET = 'my-secret-key-123';
const API_KEY = 'AIzaSyC...';

//  GOOD - Environment variables
const JWT_SECRET = process.env.JWT_SECRET!;
const API_KEY = process.env.GEMINI_API_KEY!;

//  GOOD - Validation at startup
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### 9.6 Rate Limiting

**Protect endpoints with rate limiting.**

```typescript
import rateLimit from 'express-rate-limit';

//  GOOD - Rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply to routes
app.use('/api/', apiLimiter);
```

---

## 10. Performance Standards

### 10.1 Avoid Unnecessary Re-renders

**Use React.memo, useMemo, useCallback appropriately.**

```typescript
//  GOOD - Memo for expensive renders
export const RecordRow = React.memo<RecordRowProps>(({ record }) => {
  return <div>{record.category}</div>;
});

//  GOOD - useMemo for expensive calculations
const totalCost = useMemo(() => {
  return records.reduce((sum, r) => sum + calculateCost(r), 0);
}, [records]);

//  GOOD - useCallback for stable function reference
const handleUpdate = useCallback((id: string, updates: Partial<PfaRecord>) => {
  onUpdateAsset(id, updates);
}, [onUpdateAsset]);
```

### 10.2 Virtual Scrolling

**Use virtual scrolling for large lists (>100 items).**

```typescript
//  GOOD - Virtual scrolling for performance
import { FixedSizeList } from 'react-window';

export const GridLab: React.FC = ({ records }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <RecordRow record={records[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={records.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

### 10.3 Debouncing

**Debounce expensive operations (search, API calls).**

```typescript
//  GOOD - Debounced search
import { useState, useEffect } from 'react';

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// Usage
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearchTerm) {
    performSearch(debouncedSearchTerm);
  }
}, [debouncedSearchTerm]);
```

### 10.4 Lazy Loading

**Lazy load routes and heavy components.**

```typescript
//  GOOD - Lazy loaded routes
import { lazy, Suspense } from 'react';

const Timeline = lazy(() => import('./components/Timeline'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

export const App: React.FC = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route path="/timeline" element={<Timeline />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  </Suspense>
);
```

### 10.5 Database Query Optimization

**Index frequently queried fields.**

```prisma
// schema.prisma
model PfaRecord {
  id              Int      @id @default(autoincrement())
  organizationId  Int
  category        String
  isDiscontinued  Boolean  @default(false)

  //  GOOD - Indexes for common queries
  @@index([organizationId])
  @@index([organizationId, isDiscontinued])
  @@index([category])
}
```

---

## 11. Code Documentation

### 11.1 JSDoc Comments

**Document public APIs and complex logic.**

```typescript
/**
 * Calculates the total cost for a PFA record based on source type.
 *
 * For Rental: Cost = (days / 30.44) × monthlyRate
 * For Purchase: Cost = purchasePrice
 *
 * @param record - The PFA record to calculate cost for
 * @param days - Number of days for rental calculation
 * @returns The total cost in USD
 *
 * @example
 * ```ts
 * const cost = calculateCost(record, 90);
 * // Returns: 29500 for 90-day rental at $10,000/month
 * ```
 */
export function calculateCost(record: PfaRecord, days: number): number {
  if (record.source === 'Rental') {
    return (days / 30.44) * (record.monthlyRate || 0);
  }
  return record.purchasePrice || 0;
}
```

### 11.2 Inline Comments

**Explain WHY, not WHAT.**

```typescript
//  GOOD - Explains rationale
// Use 30.44 days per month (365.25 / 12) for accurate annual calculations
const monthlyDays = 30.44;

// Prevent race condition by clearing overrides before applying updates
setDragOverrides(new Map());

// L BAD - States the obvious
// Set i to 0
let i = 0;

// Loop through records
for (const record of records) { }
```

### 11.3 TODO Comments

**Format TODOs consistently.**

```typescript
//  GOOD - Tracked TODO
// TODO(DEV-150): Add support for saving filter presets
// TODO(username): Refactor this to use custom hook
// FIXME(DEV-124): Race condition when dragging multiple items

// L BAD - Untracked TODO
// TODO: fix this later
// HACK: this needs work
```

### 11.4 Complex Logic

**Document complex algorithms or business rules.**

```typescript
/**
 * Smart bulk time shift operation.
 *
 * Business Rules:
 * - Forecasts: Shift both start and end dates
 * - Actuals: Can only extend end date (billing already started)
 * - Plan: Never modified (locked baseline)
 *
 * Rationale: Actuals represent billing reality. Once equipment
 * arrives on-site (actualStart), we can't retroactively change
 * the start date. We can only adjust when it leaves (actualEnd).
 */
export const shiftTime = (records: PfaRecord[], days: number): PfaRecord[] => {
  return records.map(record => {
    if (record.isActualized) {
      // Actuals: Only extend end date
      return {
        ...record,
        actualEnd: addDays(record.actualEnd, days)
      };
    } else {
      // Forecasts: Shift both dates
      return {
        ...record,
        forecastStart: addDays(record.forecastStart, days),
        forecastEnd: addDays(record.forecastEnd, days)
      };
    }
  });
};
```

---

## 12. Testing Standards

### 12.1 Test File Organization

```
src/
   utils/
      calculations.ts
      calculations.test.ts

   components/
      Timeline.tsx
      Timeline.test.tsx

backend/src/
   services/
      AuthService.ts
      AuthService.test.ts
```

### 12.2 Unit Test Structure

**Use AAA pattern: Arrange, Act, Assert.**

```typescript
//  GOOD - Clear AAA structure
describe('calculateCost', () => {
  it('should calculate rental cost correctly', () => {
    // Arrange
    const record: PfaRecord = {
      id: '1',
      source: 'Rental',
      monthlyRate: 10000,
      // ... other required fields
    };
    const days = 90;

    // Act
    const result = calculateCost(record, days);

    // Assert
    expect(result).toBeCloseTo(29565.22, 2);
  });

  it('should return purchase price for purchase source', () => {
    // Arrange
    const record: PfaRecord = {
      id: '2',
      source: 'Purchase',
      purchasePrice: 50000,
      // ... other required fields
    };
    const days = 90; // Should be ignored

    // Act
    const result = calculateCost(record, days);

    // Assert
    expect(result).toBe(50000);
  });
});
```

### 12.3 Test Naming

```typescript
//  GOOD - Descriptive test names
describe('PemsSyncService', () => {
  describe('startSync', () => {
    it('should create sync record with pending status', async () => { });
    it('should throw error if organization not found', async () => { });
    it('should start background sync process', async () => { });
  });
});

// L BAD - Unclear test names
describe('PemsSyncService', () => {
  it('test 1', () => { });
  it('works', () => { });
});
```

### 12.4 Mock Data

```typescript
//  GOOD - Factory functions for test data
export const createMockPfaRecord = (overrides?: Partial<PfaRecord>): PfaRecord => ({
  id: 'test-1',
  organizationId: 1,
  category: 'Excavators',
  forecastStart: new Date('2025-01-01'),
  forecastEnd: new Date('2025-03-31'),
  source: 'Rental',
  monthlyRate: 10000,
  isActualized: false,
  isDiscontinued: false,
  ...overrides
});

// Usage in tests
const record = createMockPfaRecord({ monthlyRate: 15000 });
```

---

## 15. Project-Specific Patterns

### 15.1 Sandbox Pattern

**Critical pattern for undo/redo functionality.**

```typescript
//  GOOD - Proper sandbox pattern usage
const allPfaRef = useRef<PfaRecord[]>([]); // Working sandbox
const baselinePfaRef = useRef<PfaRecord[]>([]); // Committed truth

const updatePfaRecords = (fn: (records: PfaRecord[]) => PfaRecord[]): void => {
  pushHistory(); // Save for undo
  allPfaRef.current = fn(allPfaRef.current); // Mutate sandbox
  setDataVersion(v => v + 1); // Trigger re-render
};

const handleSubmitChanges = (): void => {
  baselinePfaRef.current = cloneAssets(allPfaRef.current); // Commit
};

const handleDiscardChanges = (): void => {
  allPfaRef.current = cloneAssets(baselinePfaRef.current); // Reset
  setDataVersion(v => v + 1);
};
```

### 15.2 Multi-Organization Isolation

**Always filter by organizationId.**

```typescript
//  GOOD - Organization filtering
const visiblePfaRecords = useMemo(() => {
  return allPfaRef.current.filter(record =>
    record.organizationId === currentUser.organizationId
  );
}, [dataVersion, currentUser.organizationId]);

//  GOOD - Backend organization check
const records = await prisma.pfaRecord.findMany({
  where: {
    organizationId: req.user.organizationId // Always filter
  }
});
```

### 15.3 Drag-and-Drop Pattern

**Use dragOverrides Map for live preview.**

```typescript
//  GOOD - Drag-and-drop with atomic updates
const [dragOverrides, setDragOverrides] = useState<Map<string, DragUpdate>>(new Map());

const handleMouseMove = (event: React.MouseEvent): void => {
  if (!isDragging) return;

  // Update preview (no data mutation)
  const newOverrides = new Map(dragOverrides);
  selectedIds.forEach(id => {
    newOverrides.set(id, {
      start: calculateNewStart(event),
      end: calculateNewEnd(event)
    });
  });
  setDragOverrides(newOverrides);
};

const handleMouseUp = (): void => {
  if (dragOverrides.size > 0) {
    // Apply all updates atomically
    onUpdateAssets(Array.from(dragOverrides.entries()).map(([id, update]) => ({
      id,
      updates: { forecastStart: update.start, forecastEnd: update.end }
    })));
  }
  setDragOverrides(new Map()); // Clear
  setIsDragging(false);
};
```

---

## 16. Common Pitfalls

### 16.1 Avoid

```typescript
// L AVOID - Mutating props
const Component: React.FC<{ items: Item[] }> = ({ items }) => {
  items.push(newItem); // L NEVER mutate props
};

//  CORRECT
const Component: React.FC<{ items: Item[] }> = ({ items, onAddItem }) => {
  onAddItem(newItem); // Parent handles state update
};
```

### 16.2 Avoid

```typescript
// L AVOID - Using index as key
{items.map((item, index) => (
  <div key={index}>{item.name}</div>
))}

//  CORRECT
{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

### 16.3 Avoid

```typescript
// L AVOID - Setting state in render
const Component: React.FC = () => {
  const [count, setCount] = useState(0);
  setCount(count + 1); // L Infinite loop
  return <div>{count}</div>;
};

//  CORRECT - Use useEffect
const Component: React.FC = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(count + 1);
  }, []); // Run once on mount

  return <div>{count}</div>;
};
```

### 16.4 Avoid

```typescript
// L AVOID - Comparing objects with ===
const isDifferent = obj1 === obj2; // Always false for different object references

//  CORRECT - Deep comparison or specific field checks
import isEqual from 'lodash/isEqual';
const isDifferent = !isEqual(obj1, obj2);
```

---

## 17. Code Review Checklist

### For Reviewers

**Functionality:**
- [ ] Code achieves stated goal
- [ ] Edge cases handled
- [ ] Error handling present
- [ ] No regressions

**Code Quality:**
- [ ] Follows these coding standards
- [ ] No code duplication
- [ ] Functions under 20 lines (with exceptions)
- [ ] Descriptive names
- [ ] TypeScript strict mode passing

**Architecture:**
- [ ] Follows project patterns (sandbox, multi-org)
- [ ] Proper separation of concerns
- [ ] Type safety maintained
- [ ] No unnecessary abstractions

**Security:**
- [ ] No hardcoded secrets
- [ ] Input validated
- [ ] SQL injection prevented (Prisma used)
- [ ] XSS prevented (no unsafe dangerouslySetInnerHTML)
- [ ] Authorization checked

**Performance:**
- [ ] No unnecessary re-renders
- [ ] Database queries optimized (select specific fields)
- [ ] Large lists virtualized
- [ ] API calls debounced/cached appropriately

**Testing:**
- [ ] Tests exist and pass
- [ ] Tests cover edge cases
- [ ] Tests are maintainable

**Documentation:**
- [ ] Complex logic documented
- [ ] JSDoc for public APIs
- [ ] TODOs tracked with ticket numbers
- [ ] README.md updated if needed

---

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Owner:** PFA Vanguard Project Team
**Related:** [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md), [CLAUDE.md](../CLAUDE.md)

---

## Quick Reference

### TypeScript
-  Strict mode enabled
-  Explicit return types
-  No `any` without justification
-  Interface for objects, type for unions

### React
-  Functional components only
-  Hooks at top level
-  Props interface exported
-  Early returns for conditionals
-  Stable keys for lists

### Backend
-  Try-catch with next()
-  Service layer for business logic
-  Centralized error handling
-  Input validation (zod)

### Database
-  Select only needed fields
-  Use transactions for multi-step
-  Batch operations for performance
-  Handle Prisma errors explicitly

### Security
-  Validate all user input
-  Never hardcode secrets
-  Use environment variables
-  Check authorization on every route
-  Rate limit API endpoints

### Performance
-  React.memo for expensive components
-  useMemo for expensive calculations
-  useCallback for stable references
-  Virtual scrolling for large lists
-  Debounce expensive operations

---

**Questions?** See [CLAUDE.md](../CLAUDE.md) or [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md)
