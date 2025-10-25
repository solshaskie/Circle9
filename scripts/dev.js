const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Circle9 development server...');

// Check if required files exist
const requiredFiles = [
    'src/index.html',
    'src/index.ts',
    'src-tauri/Cargo.toml',
    'package.json'
];

for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
        console.error(`❌ Required file missing: ${file}`);
        process.exit(1);
    }
}

// Start development processes
const processes = [];

// Start TypeScript compiler in watch mode
console.log('📝 Starting TypeScript compiler...');
const tscProcess = spawn('npx', ['tsc', '--watch'], { 
    stdio: 'inherit',
    shell: true 
});
processes.push(tscProcess);

// Start SASS compiler in watch mode
console.log('🎨 Starting SASS compiler...');
const sassProcess = spawn('npx', ['sass', '--watch', 'src/Public/style.scss:out/src/Public/style.css'], { 
    stdio: 'inherit',
    shell: true 
});
processes.push(sassProcess);

// Start Tauri development server
console.log('🦀 Starting Tauri development server...');
const tauriProcess = spawn('npx', ['tauri', 'dev'], { 
    stdio: 'inherit',
    shell: true 
});
processes.push(tauriProcess);

// Handle process cleanup
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development server...');
    processes.forEach(proc => {
        if (proc && !proc.killed) {
            proc.kill('SIGTERM');
        }
    });
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down development server...');
    processes.forEach(proc => {
        if (proc && !proc.killed) {
            proc.kill('SIGTERM');
        }
    });
    process.exit(0);
});

// Handle process errors
processes.forEach((proc, index) => {
    proc.on('error', (error) => {
        console.error(`❌ Process ${index} error:`, error);
    });
    
    proc.on('exit', (code) => {
        if (code !== 0) {
            console.error(`❌ Process ${index} exited with code ${code}`);
        }
    });
});

console.log('✅ Development server started!');
console.log('🌐 Application will open automatically');
console.log('📝 TypeScript and SASS are watching for changes');
console.log('🦀 Tauri is running in development mode');
console.log('\nPress Ctrl+C to stop the development server');
