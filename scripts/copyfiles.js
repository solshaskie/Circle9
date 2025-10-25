const fs = require('fs');
const path = require('path');

console.log('📋 Copying static files...');

// Ensure output directory exists
const outDir = 'out/src';
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Copy HTML file
if (fs.existsSync('src/index.html')) {
    fs.copyFileSync('src/index.html', 'out/src/index.html');
    console.log('✅ Copied index.html');
}

// Copy any other static files
const staticFiles = [
    'src/favicon.ico',
    'src/manifest.json'
];

staticFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const dest = path.join(outDir, path.basename(file));
        fs.copyFileSync(file, dest);
        console.log(`✅ Copied ${path.basename(file)}`);
    }
});

console.log('📋 Static files copied successfully!');
