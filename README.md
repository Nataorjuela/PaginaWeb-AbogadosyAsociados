# AbogadosAsociados

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.8.

## Development server

To start a local development server, run:

```bash
npm run start:api
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

The allies/referrals API runs on `http://localhost:3000` by default and the Angular dev server proxies `/api` to it.

## QA / preproduction with demo data

Use this mode when you want to review the platform with seeded mock data without touching the production/local database:

```bash
npm run start:api:qa
npm run start:qa
```

Open `http://localhost:4200/ingresar`. The QA API uses `./data/orjuela-qa.db` and seeds these demo users automatically:

- Aliado: `aliado@orjuela.demo` / `Aliado123!`
- Cliente: `cliente@orjuela.demo` / `Cliente123!`
- Admin: `admin@orjuela.demo` / `Admin123!`

To generate a QA build that can be served by the Express server:

```bash
npm run build:qa
npm run start:api:qa
```

Then open `http://localhost:3000/ingresar`. QA settings should be provided through local shell variables or your deployment secret manager, never through versioned `.env` examples.

## Allies and referrals module

Runtime variables are configured outside the repository. Use your OS shell, CI/CD secret manager, or hosting provider settings:

```bash
PORT=3000
DB_FILE=./data/orjuela.db
ADMIN_EMAIL=contacto@orjuelaabogados.com
ADMIN_REGISTRATION_CODE=internal-code-for-admin-signup
JWT_SECRET=long-random-secret
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=orjuela@yourdomain.com
```

Public form:

- `Programa de aliados` is shown in the main page.
- Allies register through `/api/allies`.
- Referrals are created through `/api/referrals`.

Administrative panel:

- Open `/admin/login`.
- Log in with an authorized admin user.
- Manage leads, clients, cases, payments, allies, commissions, resources, goals and reports from `/admin/dashboard`.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
