// A JavaScript-based build script to use instead of TypeScript compiler
// This script copies all .ts files to .js files in the dist directory

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Create the dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Create the cache directory if it doesn't exist
if (!fs.existsSync('dist/cache')) {
  fs.mkdirSync('dist/cache', { recursive: true });
}

// Function to process .ts files
function processFile(sourcePath, targetPath) {
  // Read the content of the .ts file
  const content = fs.readFileSync(sourcePath, 'utf8');
  
  // Simple conversion: remove type annotations
  let jsContent = content
    // Remove interface declarations
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
    // Remove type imports
    .replace(/import\s+type[^;]*;/g, '')
    // Remove type annotations ': Type'
    .replace(/:\s*[\w<>[\],\s|&]+/g, '')
    // Remove generic type parameters '<Type>'
    .replace(/<[\w<>[\],\s|&]+>/g, '')
    // Fix any double semicolons created by our replacements
    .replace(/;{2,}/g, ';');
  
  // Write the content to the .js file
  fs.writeFileSync(targetPath, jsContent, 'utf8');
  console.log(`Converted: ${sourcePath} -> ${targetPath}`);
}

// Function to recursively process a directory
function processDirectory(sourceDir, targetDir) {
  // Create the target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Get all files and directories in the source directory
  const items = fs.readdirSync(sourceDir);
  
  // Process each item
  for (const item of items) {
    const sourcePath = path.join(sourceDir, item);
    const targetPath = path.join(targetDir, item);
    
    // Get the stats for the current item
    const stats = fs.statSync(sourcePath);
    
    if (stats.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(sourcePath, targetPath);
    } else if (stats.isFile() && sourcePath.endsWith('.ts')) {
      // Process .ts files
      const jsPath = targetPath.replace(/\.ts$/, '.js');
      processFile(sourcePath, jsPath);
    }
  }
}

// Start processing from the src directory to the dist directory
console.log('Starting JavaScript conversion process...');
processDirectory('src', 'dist');
console.log('Conversion complete!');

// Install production dependencies
console.log('Installing production dependencies...');
exec('npm install --only=production', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error installing dependencies: ${error.message}`);
    return;
  }
  console.log(`Dependencies installed: ${stdout}`);
});