const readline = require('readline');
const { spawn } = require('child_process');
const path = require('path');

// Helper to prompt securely without displaying the Master Key on screen
function askMasterKey(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const onData = (char) => {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.pause();
          break;
        default:
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(query + '*'.repeat(rl.line.length));
          break;
      }
    };

    process.stdin.on('data', onData);

    rl.question(query, (value) => {
      process.stdin.off('data', onData);
      rl.close();
      resolve(value);
    });
  });
}

async function main() {
  console.log('=== BCPOS Backend Secure Test Runner ===');
  const masterKey = await askMasterKey('Ingrese la Master Key (Keymaster): ');
  console.log('\n');

  if (!masterKey || masterKey.trim().length === 0) {
    console.error('ERROR: La Master Key no puede estar vacía.');
    process.exit(1);
  }

  // Ask how to start: Development or Production mode
  const modeRl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  modeRl.question('Seleccione modo (1: Desarrrollo (start:dev), 2: Producción (dist/main.js)) [1]: ', (mode) => {
    modeRl.close();
    
    let command;
    let args = [];

    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    const nodeCmd = 'node';

    if (mode === '2') {
      console.log('Iniciando en modo Producción...');
      command = nodeCmd;
      args = [path.join(__dirname, 'dist', 'src', 'main.js')];
    } else {
      console.log('Iniciando en modo Desarrollo...');
      command = npmCmd;
      args = ['run', 'start:dev'];
    }

    // Spawn child process with KEYMASTER env variable set in memory
    const childEnv = { ...process.env, KEYMASTER: masterKey };
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: childEnv,
      shell: true
    });

    child.on('close', (code) => {
      console.log(`El servidor finalizó con código: ${code}`);
      process.exit(code);
    });
  });
}

main();
