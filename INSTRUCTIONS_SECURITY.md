# Guía de Seguridad y Despliegue — Backend POS (prisma_backend)

Este backend **ya no usa encriptación de variables de entorno** (se eliminó `.env.enc` /
`KEYMASTER`). Los secretos van en el `.env` en texto plano (o en variables de entorno del
servicio), y la **licencia por fingerprint** protege la ejecución en máquinas no autorizadas.

---

## 1. Variables de entorno

El backend carga `.env` (texto plano) desde la carpeta donde corre (`process.cwd()`), o usa
variables de entorno ya definidas (no sobreescribe las existentes).

```env
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/prisma
PORT=5012
JWT_SECRET=...
ADMIN_MASTER_PASSWORD=...
CORS_ORIGINS=http://localhost:3000,...
```

- `.env` está **gitignored** (no se sube al repo). Mantén un `.env.example` sin secretos.
- Si el servicio se corre con NSSM, se puede dejar `.env` junto al build; el proceso lo
  carga al arrancar.

---

## 2. Licencia (siempre activa)

El backend valida `license.key` al iniciar (fingerprint de hardware + firma RSA-2048).
Ver `MANUAL-LICENCIAS.md` en la raíz del repo para el flujo completo (emisión con
`wayne-keygen` y despliegue).

- Sin `license.key` válido, el backend **no arranca** y escribe `machine-id.txt` en
  `process.cwd()` (ese Machine ID se envía al proveedor para emitir la licencia).
- **Dev/tests:** `WAYNE_SKIP_LICENSE=1` desactiva la validación (nunca en producción).

---

## 3. Instalar como servicio Windows (NSSM)

1. Compilar: `pnpm run build` (genera `dist/`).
2. Ejecutar `install_service.ps1` como Administrador (debe estar `nssm.exe` junto al script).
3. El script crea el servicio `backend-bcpos-app` apuntando a `dist/src/main.js`.
4. Colocar `license.key` en la carpeta del backend antes de iniciar el servicio.

---

## 4. Notas

- El AES de `leal-crypto.ts` (credenciales de Leal) es **funcionalidad de negocio**, no
  configuración: se conserva.
- La licencia es por máquina: cambiar hardware cambia el Machine ID → reemitir licencia.