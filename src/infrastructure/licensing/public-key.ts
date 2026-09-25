/**
 * Clave pública RSA-2048 del proveedor, embebida en el backend para validar la
 * firma de license.key. Es la MISMA pública que usa wayne-fusion-api
 * (LicensePublicKey.cs). La clave PRIVADA vive SOLO en el keygen del proveedor
 * (wayne-fusion-api/tools/keygen/private.pem, nunca en el repo).
 * Para rotar: generar un par nuevo con wayne-keygen --generate y reemplazarla
 * AQUÍ y en LicensePublicKey.cs, luego reconstruir ambos backends.
 */
export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkhzVGUtB3PcIKtL5JlEI
YAtWjpi8e9rgH9wTHNamQfkIGcqNl5C3SJMnLzXQSEYVNJWj9qbH96qeUI1Df3TW
TbDaR9dOA0tWVWZngyoF+qHDD5y6z8ISZax64hgThaBKw5AjgZ08XYoWtXHRLz63
wWHtDM3J1ILq9+AbSiZNoXilkKT31u/rK46jMpRGga+idZ98214Z+HpM8ZgmVyTG
mhvfL6+unzBBZTNVQbHpcc/04EKS7I8Yv3tgt6T/jCDNMHVXX+HLzhJE+83DLVVI
5dHSruSyxefqYtnhrtkPG/QDzBC6W32JimO4N3r1rKaljXFqkncTtUmBIfd/bu0G
dQIDAQAB
-----END PUBLIC KEY-----`;
