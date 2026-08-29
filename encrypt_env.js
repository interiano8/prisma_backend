const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

// Password masking readline interface helper
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
  const normalPath = path.join(__dirname, '.env');
  const encPath = path.join(__dirname, '.env.enc');

  if (!fs.existsSync(normalPath)) {
    console.error('ERROR: No se encontró el archivo .env en el directorio actual para encriptar.');
    process.exit(1);
  }

  // Ask keymaster securely
  console.log('--- Encriptador de Variables de Entorno BCPOS ---');
  const masterKey = await askMasterKey('Ingrese la Master Key (Keymaster): ');
  console.log('\n');

  if (!masterKey || masterKey.trim().length === 0) {
    console.error('ERROR: La Master Key no puede estar vacía.');
    process.exit(1);
  }

  try {
    const envContent = fs.readFileSync(normalPath, 'utf8');
    
    // Generate IV and derive 32-byte key using sha256
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(masterKey).digest();

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(envContent, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Save as hex format iv:encrypted
    const result = iv.toString('hex') + ':' + encrypted.toString('hex');
    fs.writeFileSync(encPath, result, 'utf8');

    console.log('===========================================================');
    console.log('¡ÉXITO! Se ha creado el archivo encriptado: .env.enc');
    console.log('Ahora puede eliminar el archivo .env original de forma segura.');
    console.log('Para iniciar la aplicación, debe proveer la clave usando:');
    console.log('  Linux:   KEYMASTER="su_clave" npm run start:prod');
    console.log('  Windows: set KEYMASTER=su_clave && npm run start:prod');
    console.log('===========================================================');
  } catch (err) {
    console.error('Ocurrió un error al encriptar el archivo:', err);
  }
}

main();
