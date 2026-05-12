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

## Allies and referrals module

Environment variables are configured from `.env` using the keys shown in `.env.example`:

```bash
PORT=3000
DB_FILE=./data/orjuela.db
ADMIN_EMAIL=contacto@orjuelaabogados.com
ADMIN_PASSWORD=change-this-password
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

- Open `/admin`.
- Log in with `ADMIN_PASSWORD`.
- Manage ally statuses and referral statuses.

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
