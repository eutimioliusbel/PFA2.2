const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all controller files
const files = glob.sync('src/controllers/*.ts', { cwd: __dirname });

console.log(`Checking ${files.length} controller files for malformed error handlers...\n`);

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Extract controller name from file name
  const fileName = path.basename(file, '.ts');
  const controllerName = fileName.charAt(0).toUpperCase() + fileName.slice(1);

  // Pattern 1: Fix malformed error handlers with extra });
  // Example: handleControllerError(error, res, 'message', 'Controller.UnknownFunction');\n    });\n  }
  const pattern1 = /handleControllerError\(error, res, '[^']*', '[^']*\.UnknownFunction'\);\s*\}\);\s*\}/g;

  // Find all function names in the file
  const functionPattern = /export (?:async )?(?:const|function) (\w+)/g;
  const functions = [];
  let match;
  while ((match = functionPattern.exec(originalContent)) !== null) {
    functions.push(match[1]);
  }

  // Replace malformed handlers
  let modified = false;

  // Pattern: handleControllerError with UnknownFunction followed by orphaned code
  content = content.replace(
    /}\s*catch\s*\(error:\s*unknown\)\s*\{\s*handleControllerError\(error,\s*res,\s*'[^']*',\s*'[^']+\.UnknownFunction'\);\s*\}\);\s*\}/g,
    (match, offset) => {
      // Find which function this belongs to
      let funcName = 'unknown';
      for (const fn of functions) {
        const funcPos = originalContent.lastIndexOf(`export`, offset);
        const funcMatch = originalContent.substring(funcPos, offset).match(new RegExp(`export (?:async )?(?:const|function) (${fn})`));
        if (funcMatch) {
          funcName = fn;
          break;
        }
      }

      modified = true;
      totalFixed++;
      console.log(`${file}: Fixed error handler in ${funcName}`);

      return `} catch (error: unknown) {\n    handleControllerError(error, res, '${controllerName}.${funcName}');\n  }\n}`;
    }
  );

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${file}: Fixed\n`);
  }
});

console.log(`\n✅ Total fixed: ${totalFixed} malformed handlers`);
