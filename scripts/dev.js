/**
 * dev.js – Starts both backend and frontend dev servers concurrently.
 * Forwards stdout/stderr from both processes with colored prefixes.
 * Ctrl-C kills everything.
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PURPLE = '\x1b[35m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';

function run(label, color, cwd, command, args) {
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  const prefix = `${color}[${label}]${RESET} `;

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) process.stdout.write(prefix + line + '\n');
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim()) process.stderr.write(prefix + line + '\n');
    });
  });

  child.on('close', (code) => {
    console.log(`${prefix}exited with code ${code}`);
  });

  return child;
}

const backend  = run('BACK',  PURPLE, path.join(ROOT, 'backend'),  'node', ['src/server.js']);
const frontend = run('FRONT', CYAN,   path.join(ROOT, 'frontend'), 'npx',  ['vite', '--port', '5174']);

// Kill both on Ctrl-C
process.on('SIGINT', () => {
  backend.kill();
  frontend.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  backend.kill();
  frontend.kill();
  process.exit(0);
});
