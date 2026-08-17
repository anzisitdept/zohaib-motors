const { spawn } = require('child_process');
const p = spawn('cmd', ['/c', 'cd', 'D:\\IT-dept-anziandco-git\\file-tracking-system-caruzen', '&', 'npx', 'tsc', '--noEmit', '--skipLibCheck'], {
  shell: true,
  stdio: 'pipe'
});

let stdout = '';
let stderr = '';

p.stdout.on('data', (data) => {
  stdout += data.toString();
});

p.stderr.on('data', (data) => {
  stderr += data.toString();
});

p.on('close', (code) => {
  console.log('Exit code:', code);
  console.log('STDOUT:', stdout.substring(0, 2000));
  console.log('STDERR:', stderr.substring(0, 2000));
});