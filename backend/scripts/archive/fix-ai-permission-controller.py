import re

file_path = 'src/controllers/aiPermissionController.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all functions and their error handlers
lines = content.split('\n')
new_lines = []
current_function = None
i = 0

while i < len(lines):
    line = lines[i]

    # Detect function declarations
    func_match = re.match(r'^export async function (\w+)\(', line)
    if func_match:
        current_function = func_match.group(1)
        print(f"Found function: {current_function}")

    # Detect malformed error handler
    if "handleControllerError(error, res, '," in line:
        print(f"  > Fixing error handler in {current_function} at line {i+1}")

        # Replace this line
        new_lines.append(f"    handleControllerError(error, res, 'AiPermissionController.{current_function}');")

        # Skip the malformed lines that follow
        i += 1
        while i < len(lines):
            if lines[i].strip() == '}' and i + 1 < len(lines) and lines[i+1].strip() == '}':
                # Found the double closing brace - add one back
                new_lines.append('  }')
                i += 1  # Skip the second brace
                break
            i += 1
    else:
        new_lines.append(line)

    i += 1

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print("\n✓ Fixed all error handlers in aiPermissionController.ts")
