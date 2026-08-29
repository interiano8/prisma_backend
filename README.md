<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests (requiere Postgres y .env configurado)
$ pnpm run test:e2e

# test coverage (aplica umbrales de cobertura)
$ pnpm run test:cov

# mutation testing (Stryker sobre domain/services y utils/datetime)
$ pnpm run test:mutation

# benchmark de rendimiento de servicios de dominio
$ pnpm run test:perf

# escaneo de secretos en el código + audit de dependencias de producción
$ pnpm run test:security
```

## Autenticación JWT

El backend emite **tokens JWT** en el login. Los endpoints sensibles
(`POST /api/auth/validate-admin`, `GET /api/auth/check-credit-validation/:storeId`
y `PUT /api/auth/preferences`) están protegidos por el `JwtAuthGuard` y exigen la
cabecera `Authorization: Bearer <token>`.

### 1. Obtener un token

```bash
# Login con usuario/contraseña
curl -X POST http://localhost:5009/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jdoe","password":"miClave","storeId":"001","posNo":"01"}'

# Login por RFID
curl -X POST http://localhost:5009/api/auth/login-rfid \
  -H "Content-Type: application/json" \
  -d '{"rfidCode":"123456","storeId":"001","posNo":"01"}'
```

Respuesta: `{ "user": {...}, "token": "<jwt>", "storeConfig": {...}, "shiftInfo": {...} }`

### 2. Usar el token

```bash
curl -X PUT http://localhost:5009/api/auth/preferences \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{"username":"jdoe","theme":"dark","accent":"#0070f3"}'
```

Sin token (o con token inválido/expirado) la API responde `401 Unauthorized`.

### 3. Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Secreto para firmar/verificar los tokens (obligatoria; sin ella falla el sign/verify). |
| `ADMIN_MASTER_PASSWORD` | Contraseña maestra de administrador validada en `validate-admin` (antes estaba hardcodeada en el código). |
| `CORS_ORIGINS` | Lista de orígenes permitidos separados por coma. Vacío = CORS deshabilitado (solo same-origin). |
| `KEYMASTER` | Clave maestra para descifrar `.env.enc` en producción. |

Los tokens expiran a las **8 horas** (`TOKEN_TTL` en `src/auth/token.service.ts`).

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
