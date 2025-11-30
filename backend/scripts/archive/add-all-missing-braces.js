const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all controller files
const files = glob.sync('src/controllers/*.ts', { cwd: __dirname });

console.log(`Checking ${files.length} controller files for missing braces...\n`);

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  const originalContent = fs.readFileSync(filePath, 'utf8');
  const lines = originalContent.split('\n');

  let modified = false;
  let i = 0;

  while (i < lines.length) {
    //Look for handleControllerError followed by closing brace
    if (lines[i].includes('handleControllerError(error, res,')) {
      // Check if next line is closing brace for catch
      if (i + 1 < lines.length && lines[i + 1].trim() === '}') {
        // Check if line after that is NOT a closing brace for function
        if (i + 2 < lines.length) {
          const nextLine = lines[i + 2].trim();

          // If it's an empty line or a comment or an export, we probably need a closing brace
          if (nextLine === '' || nextLine.startsWith('/**') || nextLine.startsWith('export')) {
            console.log(`${file}: Adding closing brace after line ${i + 2}`);
            // Insert closing brace before the next line
            lines.splice(i + 2, 0, '}');
            modified = true;
            totalFixed++;
          }
        }
      }
    }
    i++;
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`✓ ${file}: Fixed\n`);
  }
});

console.log(`\n✅ Total fixed: ${totalFixed} missing braces`);
