import { spawn } from 'node:child_process';

const n = process.argv[2] ? parseInt(process.argv[2], 10) : 2;
console.log(`Starting REPL test with ${n} messages.`);

const repl = spawn(
  'node',
  ['./packages/command/dist/custard-repl.js', String(n)],
);

repl.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

repl.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

repl.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});

for (let i = 1; i <= n; i++) {
  console.log(`parent: Sending hello ${i}`);
  repl.stdin.write(`"hello ${i}"\n`);
}

await new Promise((resolve) => {
  setTimeout(resolve, 1000);
});

repl.stdin.end();
