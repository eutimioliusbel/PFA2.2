/**
 * Migration Script: Error Handler Standardization
 *
 * Systematically updates all controller error handlers to use:
 * 1. Proper typing: catch (error: unknown)
 * 2. Winston logger instead of console.error
 * 3. Standardized handleControllerError() utility
 *
 * Usage: npx tsx backend/scripts/migrate-error-handlers.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const CONTROLLERS_DIR = path.join(__dirname, '../src/controllers');

interface _ErrorHandlerPattern {
  file: string;
  line: number;
  oldCode: string;
  newCode: string;
}

function findControllersWithOldPattern(): string[] {
  const files = fs.readdirSync(CONTROLLERS_DIR);
  return files
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(CONTROLLERS_DIR, f))
    .filter(filePath => {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.includes('catch (error: any)');
    });
}

function updateImports(content: string): string {
  // Check if handleControllerError is already imported
  if (content.includes('handleControllerError')) {
    return content;
  }

  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex === -1) {
    // No imports found, add at beginning
    return `import { handleControllerError } from '../utils/errorHandling';\n\n${content}`;
  }

  // Insert after last import
  lines.splice(
    lastImportIndex + 1,
    0,
    "import { handleControllerError } from '../utils/errorHandling';"
  );

  return lines.join('\n');
}

function extractContextName(content: string, errorPosition: number): string {
  // Extract the function name before this error handler
  const beforeError = content.substring(0, errorPosition);
  const functionMatch = beforeError.match(/static\s+async\s+(\w+)\s*\(/g);

  if (functionMatch && functionMatch.length > 0) {
    const lastMatch = functionMatch[functionMatch.length - 1];
    const nameMatch = lastMatch.match(/static\s+async\s+(\w+)/);
    if (nameMatch) {
      return nameMatch[1];
    }
  }

  return 'UnknownFunction';
}

function extractErrorMessage(catchBlock: string): string {
  // Extract the error message from the old pattern
  const errorMatch = catchBlock.match(/error:\s*['"]([^'"]+)['"]/);
  if (errorMatch) {
    return errorMatch[1];
  }
  return 'Operation failed';
}

function migrateErrorHandlers(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changeCount = 0;

  // Update imports first
  content = updateImports(content);

  // Pattern: catch (error: any) { ... }
  const catchPattern = /catch\s*\(error:\s*any\)\s*\{[\s\S]*?\n\s*\}/g;
  const matches = Array.from(content.matchAll(catchPattern));

  if (matches.length === 0) {
    return 0;
  }

  // Process matches in reverse order to maintain correct positions
  for (const match of matches.reverse()) {
    const catchBlock = match[0];
    const position = match.index!;

    // Extract error message
    const errorMessage = extractErrorMessage(catchBlock);

    // Extract context name
    const contextName = extractContextName(content, position);
    const className = path.basename(filePath, '.ts')
      .replace(/Controller$/, '')
      .split(/(?=[A-Z])/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') + 'Controller';

    const context = `${className}.${contextName}`;

    // Create new error handler
    const newHandler = `catch (error: unknown) {\n      handleControllerError(error, res, '${errorMessage}', '${context}');\n    }`;

    // Replace old with new
    content = content.substring(0, position) + newHandler + content.substring(position + catchBlock.length);
    changeCount++;
  }

  // Write updated content
  fs.writeFileSync(filePath, content, 'utf-8');
  return changeCount;
}

function main() {
  console.log('🔍 Finding controllers with old error handling pattern...\n');

  const controllersToUpdate = findControllersWithOldPattern();

  if (controllersToUpdate.length === 0) {
    console.log('✅ No controllers need updating. All are using the new pattern!');
    return;
  }

  console.log(`Found ${controllersToUpdate.length} controllers to update:\n`);

  let totalChanges = 0;
  const results: { file: string; changes: number }[] = [];

  for (const filePath of controllersToUpdate) {
    const fileName = path.basename(filePath);
    console.log(`📝 Processing ${fileName}...`);

    const changes = migrateErrorHandlers(filePath);
    totalChanges += changes;
    results.push({ file: fileName, changes });

    console.log(`   ✓ Updated ${changes} error handler(s)\n`);
  }

  console.log('━'.repeat(50));
  console.log('📊 Migration Summary:\n');
  results.forEach(r => {
    console.log(`   ${r.file}: ${r.changes} handler(s)`);
  });
  console.log(`\n✅ Total: ${totalChanges} error handlers migrated`);
  console.log('━'.repeat(50));
}

main();
