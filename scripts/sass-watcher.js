const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎨 Starting SASS watcher...');

// Ensure output directory exists
const outDir = 'out/src/Public';
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Start SASS watcher
const sassProcess = spawn('npx', ['sass', '--watch', 'src/Public/style.scss:out/src/Public/style.css'], {
    stdio: 'inherit',
    shell: true
});

// Handle process cleanup
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping SASS watcher...');
    sassProcess.kill('SIGTERM');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping SASS watcher...');
    sassProcess.kill('SIGTERM');
    process.exit(0);
});

sassProcess.on('error', (error) => {
    console.error('❌ SASS watcher error:', error);
});

sassProcess.on('exit', (code) => {
    if (code !== 0) {
        console.error(`❌ SASS watcher exited with code ${code}`);
    }
});

console.log('✅ SASS watcher started!');
console.log('📝 Watching for changes in src/Public/style.scss');
console.log('🎨 Output: out/src/Public/style.css');
console.log('\nPress Ctrl+C to stop the watcher');
