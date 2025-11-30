const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/controllers/aiPermissionController.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Adding missing function closing braces...\n');

// Find lines that need closing braces added after them
// These are lines with handleControllerError calls followed immediately by comment blocks
const fixLocations = [
  { searchAfter: "handleControllerError(error, res, 'AiPermissionController.suggestPermissions');", funcName: 'suggestPermissions' },
  { searchAfter: "handleControllerError(error, res, 'AiPermissionController.acceptSuggestion');", funcName: 'acceptSuggestion' },
  { searchAfter: "handleControllerError(error, res, 'AiPermissionController.getSuggestionStats');", funcName: 'getSuggestionStats' },
  { searchAfter: "handleControllerError(error, res, 'AiPermissionController.getRoleTemplates');", funcName: 'getRoleTemplates' },
];

let modified = false;

for (const fix of fixLocations) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(fix.searchAfter)) {
      // Check if next line is closing brace for catch
      if (i + 1 < lines.length && lines[i + 1].trim() === '}') {
        // Check if line after that is NOT a closing brace for function
        if (i + 2 < lines.length && lines[i + 2].trim() !== '}') {
          console.log(`Adding closing brace for function ${fix.funcName} after line ${i + 2}`);
          // Insert closing brace
          lines.splice(i + 2, 0, '}');
          modified = true;
          break; // Move to next fix location
        }
      }
    }
  }
}

if (modified) {
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log('\n✓ Added all missing function closing braces');
} else {
  console.log('\n✓ No missing braces found - file already correct');
}
