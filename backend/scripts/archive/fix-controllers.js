const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all controller files
const files = glob.sync('src/controllers/*.ts', { cwd: __dirname });

console.log(`Found ${files.length} controller files\n`);

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  const originalContent = fs.readFileSync(filePath, 'utf8');
  let content = originalContent;
  let fileFixed = 0;

  // Extract controller name from filename
  const fileName = path.basename(file, '.ts');
  const controllerName = fileName.charAt(0).toUpperCase() + fileName.slice(1);

  // Find all occurrences of the malformed pattern
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    // Look for the malformed handleControllerError line
    if (lines[i].includes("handleControllerError(error, res, ',")) {
      console.log(`${file}: Found malformed error handler at line ${i + 1}`);

      // Find the method name by looking backwards
      let methodName = 'unknown';
      for (let j = i - 1; j >= 0 && j > i - 100; j--) {
        const methodMatch = lines[j].match(/async\s+(\w+)\s*\(/);
        if (methodMatch) {
          methodName = methodMatch[1];
          break;
        }
      }

      // Find the end of the malformed block (look for closing braces)
      let endIdx = i + 1;
      let braceCount = 0;
      let foundEnd = false;

      while (endIdx < lines.length && !foundEnd) {
        const line = lines[endIdx];

        if (line.includes('if (error.') || line.includes('} else {')) {
          // Part of the malformed block
          endIdx++;
          continue;
        }

        if (line.trim() === '}' && lines[endIdx + 1] && lines[endIdx + 1].trim() === '}') {
          // Found the end - two closing braces
          foundEnd = true;
          break;
        }

        endIdx++;
      }

      if (foundEnd) {
        // Replace the malformed block with clean error handling
        const fixedLine = `      handleControllerError(error, res, '${controllerName}.${methodName}');`;
        const closingBrace = '    }';

        // Remove all lines from i to endIdx and replace with fixed version
        const newLines = [
          ...lines.slice(0, i),
          fixedLine,
          closingBrace,
          ...lines.slice(endIdx + 2) // Skip the two closing braces
        ];

        lines.length = 0;
        lines.push(...newLines);

        fileFixed++;
        totalFixed++;
        console.log(`  → Fixed: ${controllerName}.${methodName}`);
      } else {
        console.log(`  ✗ Could not find end of malformed block`);
        i++;
      }
    } else {
      i++;
    }
  }

  if (fileFixed > 0) {
    const newContent = lines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ ${file}: Fixed ${fileFixed} error handler(s)\n`);
  }
});

console.log(`\n✅ Total fixed: ${totalFixed} error handlers`);
