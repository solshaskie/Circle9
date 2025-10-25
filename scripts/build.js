const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building Circle9...');

try {
    // Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    if (fs.existsSync('out')) {
        fs.rmSync('out', { recursive: true, force: true });
    }

    // Compile TypeScript
    console.log('📝 Compiling TypeScript...');
    execSync('npx tsc', { stdio: 'inherit' });

    // Compile SASS
    console.log('🎨 Compiling SASS...');
    execSync('npx sass src/Public/style.scss out/src/Public/style.css', { stdio: 'inherit' });

    // Copy static files
    console.log('📋 Copying static files...');
    if (!fs.existsSync('out/src/Public')) {
        fs.mkdirSync('out/src/Public', { recursive: true });
    }
    
    // Copy HTML file
    fs.copyFileSync('src/index.html', 'out/src/index.html');

    // Build with Tauri
    console.log('🚀 Building with Tauri...');
    execSync('npx tauri build', { stdio: 'inherit' });

    console.log('✅ Build completed successfully!');
    console.log('📦 Executable location: src-tauri/target/release/circle9.exe');

} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}
