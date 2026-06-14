/**
 * kill-all.js – Kills both backend (port 4001) and frontend (port 5174).
 *
 * Usage: npm run kill
 */
const { execSync } = require('child_process');

const PORTS = [4001, 5174];

function killPort(port) {
  try {
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
        // already gone
      }
    });

    if (pids.size === 0) {
      console.log(`\x1b[90m[KILL]\x1b[0m No process found on port ${port}`);
    }
  } catch {
    console.log(`\x1b[90m[KILL]\x1b[0m No process found on port ${port}`);
  }
}

console.log('\n\x1b[1m--- Killing all servers ---\x1b[0m\n');

PORTS.forEach(killPort);

console.log('\n\x1b[32mDone.\x1b[0m\n');
