// Runs the sync API (:4000) and the Vite dev server (:3000, proxies /api) together.
import { spawn } from 'node:child_process';

const shell = process.platform === 'win32';
const children = [
  spawn('npm', ['start', '--prefix', 'server'], { stdio: 'inherit', shell }),
  spawn('npm', ['run', 'dev', '--prefix', 'maternawell-app'], { stdio: 'inherit', shell })
];
const stop = () => { for (const child of children) child.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', code => { if (code) stop(); });
