import { spawn } from 'node:child_process';

const n = 3;
console.log(`Starting REPL test with ${n} messages.`);

//const repl = spawn(
  //'node',
  //['./reproduction-child.mjs', String(n)],
//);
const repl = spawn(
  'bash',
  ['./reproduction-child.sh'],
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
  // Uncomment this `await new Promise(...);` to stop reproducing the issue
  // await new Promise((resolve) => { setTimeout(resolve, 100); });
  console.log(`parent: Sending hello ${i}`);
  repl.stdin.write(`"hello ${i}"\n`);
}

await new Promise((resolve) => {
  setTimeout(resolve, 1000);
});

repl.stdin.end();
