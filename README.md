# Abogados Asociados

Aplicacion web de Orjuela Abogados & Asociados construida con Angular y un API Express.

## Desarrollo Local

Ejecuta el API y la aplicacion Angular en terminales separadas:

```bash
npm run start:api
npm start
```

La aplicacion se abre en el puerto local de Angular y el API corre en el puerto configurado para desarrollo.

## Configuracion

No guardes secretos, credenciales, tokens, variables de correo, claves JWT ni archivos `.env` en el repositorio.

La configuracion sensible debe vivir unicamente en:

- Variables locales del sistema operativo.
- Variables del proveedor de hosting.
- Secret manager de CI/CD.

La configuracion publica del navegador se define en `src/index.html` mediante `window.__ORJUELA_CONFIG__`. Solo debe contener valores publicos, como el ID publico de Google OAuth y la URL publica del API.

## Seguridad

- No versionar archivos `.env`.
- No publicar usuarios o contrasenas de prueba.
- No documentar claves internas reales en archivos del repositorio.
- Rotar cualquier credencial que haya sido expuesta por error.
- Mantener los usuarios administrativos creados desde el flujo autorizado del sistema.

## Build

```bash
npm run build
```

El resultado queda en `dist/`.

## QA

Para validar cambios visuales y de flujo:

- Revisar landing, acceso, login, recuperacion y paneles por rol.
- Confirmar que Google OAuth use el API correcto.
- Validar que no existan secretos en archivos versionados.
- Ejecutar build antes de subir cambios.
