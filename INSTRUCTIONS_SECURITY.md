# Guía de Seguridad y Despliegue - BCPOS Backend

Este documento explica cómo encriptar las variables de entorno, realizar pruebas locales de forma segura e instalar la aplicación como un servicio de Windows sin exponer la clave maestra (`KEYMASTER`) en los historiales de la consola.

---

## 1. Encriptar las Variables de Entorno (.env)

El archivo `.env` original contiene credenciales sensibles y no debe estar expuesto en texto plano en entornos de producción.

1. Asegúrate de tener tu archivo `.env` configurado en el directorio raíz de `bcpos_backend`.
2. Ejecuta el script encriptador:
   ```bash
   node encrypt_env.js
   ```
3. La consola te pedirá ingresar la **Master Key (Keymaster)**. La entrada estará enmascarada con asteriscos (`****`) para mayor seguridad.
4. Una vez completado, se generará el archivo cifrado **`.env.enc`**.
5. **IMPORTANTE:** Elimina el archivo `.env` original de texto plano de forma permanente:
   ```bash
   # En Linux / macOS:
   rm .env

   # En Windows (Command Prompt):
   del .env
   ```

---

## 2. Ejecutar Pruebas Locales de Forma Segura (sin servicio)

Para levantar el backend localmente sin exponer la contraseña en el historial del terminal:

1. Ejecuta el cargador seguro interactivo:
   ```bash
   node run_secure.js
   ```
2. Introduce la **Master Key** correspondiente para desencriptar el archivo `.env.enc` en memoria.
3. Elige la opción del modo de ejecución:
   * **`1`** (Por defecto): Modo **Desarrollo** (`pnpm run start:dev` con recarga en caliente).
   * **`2`**: Modo **Producción** (`node dist/src/main.js`).
4. El servidor se iniciará cargando las variables en memoria sin dejar rastros de la clave en el historial de comandos del shell.

---

## 3. Instalación como Servicio de Windows (Producción)

Para instalar el backend como servicio de Windows usando **NSSM (Non-Sucking Service Manager)** de manera automática y segura:

### Requisitos Previos:
- Tener instalado Node.js en el servidor Windows.
- Colocar el ejecutable `nssm.exe` dentro de la carpeta raíz de `bcpos_backend`.
- Haber generado el archivo compilado `dist` ejecutando previamente:
  ```bash
  pnpm run build
  ```
### Proceso de Instalación:
1. Abre **PowerShell como Administrador**.
2. Dirígete a la carpeta `bcpos_backend`.
3. Ejecuta el script de instalación:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   .\install_service.ps1
   ```
4. El script te pedirá ingresar de forma segura la **Master Key** (los caracteres se ocultarán automáticamente).
5. El instalador creará el servicio de Windows llamado **`backend-bcpos-app`**, inyectará la clave maestra directamente a las variables de entorno de NSSM y dejará el servicio corriendo en segundo plano.
6. El servicio iniciará la ejecución de **`dist/src/main.js`**.
