import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validateLicense } from '../../src/infrastructure/licensing/license';

/**
 * Verifica que el formato de firma que emite el servicio de licencias (nube)
 * —`machineId|issuedTo|expiresUtc` con RSA-SHA256— sea aceptado por el POS
 * (pública embebida). Se salta si no está la llave privada del keygen.
 */
const KEY_PATH = path.join(
  __dirname,
  '../../../wayne-fusion-api/tools/keygen/bin/Debug/net8.0/private.pem',
);
const hasKey = fs.existsSync(KEY_PATH);
const suite = hasKey ? describe : describe.skip;

suite('Compatibilidad de firma (nube ↔ POS)', () => {
  it('una licencia firmada con la llave del keygen valida con la pública embebida', () => {
    const machineId = 'AB12-CD34-EF56-7890';
    const issuedTo = 'Cliente';
    const expiresUtc = '';
    const privateKey = fs.readFileSync(KEY_PATH, 'utf8');

    // Mismo formato que SigningService.sign del servicio de licencias.
    const signature = crypto
      .sign(
        'RSA-SHA256',
        Buffer.from(`${machineId}|${issuedTo}|${expiresUtc}`, 'utf8'),
        privateKey,
      )
      .toString('base64');

    const licensePath = path.join(os.tmpdir(), `compat-${Date.now()}.key`);
    fs.writeFileSync(
      licensePath,
      JSON.stringify({ machineId, issuedTo, expiresUtc, signature }),
    );

    try {
      const result = validateLicense(licensePath, { machineId });
      expect(result.ok).toBe(true);
    } finally {
      fs.rmSync(licensePath, { force: true });
    }
  });
});
