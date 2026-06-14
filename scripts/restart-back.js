/**
 * restart-back.js – Kills any process on backend port (4001),
 * then starts backend fresh. Leaves the frontend alone.
 *
 * Usage: npm run restart:back
 */
const { execSync, spawn } = require('child_process');
const path = require('path');

const BACKEND_PORT = 4001;

function killPort(port) {
  try {
    // Windows: find PID on port and kill it
    const result = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const pids = new Set();
    result.split('\n').forEach((line) => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && !isNaN(pid)) {
        pids.add(pid);
      }
    });

    pids.forEach((pid) => {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
        console.log(`\x1b[33m[KILL]\x1b[0m Killed process ${pid} on port ${port}`);
      } catch {
        // process may already be gone
      }
    });

    if (pids.size === 0) {
      console.log(`\x1b[90m[KILL]\x1b[0m No process found on port ${port}`);
    }
  } catch {
    console.log(`\x1b[90m[KILL]\x1b[0m No process found on port ${port}`);
  }
}

console.log('\n\x1b[1m--- Restarting backend ---\x1b[0m\n');

// Kill only the backend server (Express on 4001)
killPort(BACKEND_PORT);

// Wait a moment for ports to free up
setTimeout(() => {
  console.log('\x1b[32m[START]\x1b[0m Starting backend...\n');

  const backend = spawn('node', ['src/server.js'], {
    cwd: path.resolve(__dirname, '..', 'backend'),
    stdio: 'inherit',
    shell: true,
  });

  backend.on('close', (code) => {
    console.log(`\n\x1b[35m[BACK]\x1b[0m Backend exited with code ${code}`);
  });

  // Forward Ctrl-C
  process.on('SIGINT', () => {
    backend.kill();
    process.exit(0);
  });
}, 1000);
