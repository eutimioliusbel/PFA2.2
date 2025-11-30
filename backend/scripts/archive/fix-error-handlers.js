const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');

// Read all TypeScript files in controllers directory
const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.ts'));

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Pattern 1: handleControllerError(error, res, ', error); followed by malformed if/else
  const pattern1 = /handleControllerError\(error, res, ',\s*error\);\s*\n\s*\n\s*if\s*\(error\.(?:message|code)[^\)]*',\s*'[^']*'\);\s*\n[^}]*\}\s*else\s*\{[^}]*\}\s*\n\s*\}/g;

  // Count occurrences before replacement
  const matches1 = content.match(pattern1);
  if (matches1) {
    console.log(`File: ${file} - Found ${matches1.length} instances of pattern 1`);

    // Extract controller name from file
    const controllerName = file.replace('Controller.ts', '').replace(/^./, c => c.toUpperCase()) + 'Controller';

    // We need to determine the method name contextually
    // For now, let's use a simpler approach - just clean up the error handling
    content = content.replace(pattern1, (match) => {
      // Try to extract method name from context
      const beforeMatch = content.substring(0, content.indexOf(match));
      const methodMatch = beforeMatch.match(/async\s+(\w+)\s*\([^)]*\)\s*:\s*Promise<void>/g);

      let methodName = 'unknownMethod';
      if (methodMatch && methodMatch.length > 0) {
        const lastMethod = methodMatch[methodMatch.length - 1];
        const nameMatch = lastMethod.match(/async\s+(\w+)/);
        if (nameMatch) {
          methodName = nameMatch[1];
        }
      }

      totalFixed++;
      return `handleControllerError(error, res, '${controllerName}.${methodName}');\n    }`;
    });
  }

  // Write back to file
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log(`\nTotal patterns fixed: ${totalFixed}`);
console.log('Done!');
