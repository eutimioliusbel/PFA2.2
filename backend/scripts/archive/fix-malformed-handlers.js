const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all controller files
const files = glob.sync('src/controllers/*.ts', { cwd: __dirname });

console.log(`Fixing malformed error handlers in ${files.length} controller files...\n`);

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Extract controller name from file name
  const fileName = path.basename(file, '.ts');
  const controllerName = fileName.charAt(0).toUpperCase() + fileName.slice(1).replace('Controller', '') + 'Controller';

  // Pattern 1: Fix malformed handlers with 2-4 arguments followed by orphaned `});` and extra `}`
  // Example:
  // } catch (error: unknown) {
  //   handleControllerError(error, res, 'message', 'Controller.method');
  // });
  //   }
  // }
  content = content.replace(
    /(\s+)\} catch \(error: unknown\) \{\s+handleControllerError\(error, res, '[^']*', '([^']+)\.([^']+)'\);\s+\}\);\s+\}\s+\}/g,
    (match, indent, ctrl, method) => {
      totalFixed++;
      console.log(`${file}: Fixed malformed handler in ${method}`);
      return `${indent}} catch (error: unknown) {\n${indent}  handleControllerError(error, res, '${ctrl}.${method}');\n${indent}}\n${indent.substring(2)}}`;
    }
  );

  // Pattern 2: Fix malformed handlers with 2 arguments followed by orphaned `});` and extra `}`
  // } catch (error: unknown) {
  //   handleControllerError(error, res, 'Controller.method');
  // });
  //   }
  // }
  content = content.replace(
    /(\s+)\} catch \(error: unknown\) \{\s+handleControllerError\(error, res, '([^']+)'\);\s+\}\);\s+\}\s+\}/g,
    (match, indent, methodName) => {
      totalFixed++;
      console.log(`${file}: Fixed malformed handler with orphaned closing in ${methodName}`);
      return `${indent}} catch (error: unknown) {\n${indent}  handleControllerError(error, res, '${methodName}');\n${indent}}\n${indent.substring(2)}}`;
    }
  );

  // Pattern 3: Fix orphaned `});` after handleControllerError
  //   handleControllerError(error, res, '...', '...');
  // });
  content = content.replace(
    /handleControllerError\(error, res, '[^']*', '([^']+)'\);\s+\}\);/g,
    (match, methodName) => {
      totalFixed++;
      console.log(`${file}: Removed orphaned });`);
      return `handleControllerError(error, res, '${methodName}');`;
    }
  );

  // Pattern 4: Fix 3-argument handleControllerError calls (reduce to 2 arguments)
  content = content.replace(
    /handleControllerError\(error, res, '[^']*', '([^']+)'\)/g,
    (match, methodName) => {
      return `handleControllerError(error, res, '${methodName}')`;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${file}: Fixed\n`);
  }
});

console.log(`\n✅ Total fixes applied: ${totalFixed}`);
