# Preparación de Natura para entrega

Natura debe tener todos sus archivos de código, imágenes, automatizaciones, Apps Script y documentación dentro de su propia carpeta y, tras la migración, dentro de su repositorio independiente.

Los workflows de GitHub Actions solo se ejecutan si están situados en `.github/workflows/` en la raíz del repositorio. Por ello los workflows actualmente operativos de `stock/.github/workflows/` deben permanecer allí hasta crear el repositorio independiente `natura`.

Decisión temporal 2026-10-11: trabajar el código únicamente en GitHub; no escribir ni sincronizar con Google Drive en esta fase. La elección definitiva de GitHub como fuente principal requiere validación. Nunca habilitar simultáneamente dos publicadores de Apps Script.

La copia del repositorio no transfiere secretos, permisos, datos externos, cuentas de Google, despliegues ni dominios. Documentar y reconectar de forma segura estas dependencias antes de entregar el proyecto.

Cuenta actual que se conservará: `irenismb`. Más adelante se valorará renombrar esta misma cuenta a `grupo`, si está disponible, sin abrir una cuenta nueva.

## Estado de preparación al 2026-10-11

- La estructura de código está reunida en `stock/natura/`; no existe todavía un repositorio separado de Natura.
- Las fuentes web, `apps-script/`, `logos/` y el paquete auxiliar `.github/` están incluidos en GitHub. El inventario de Drive se utiliza solo como referencia previa; no se modificó durante esta etapa.
- Los cuatro workflows de publicación o integración contenidos en `natura/.github/workflows/` exigen la variable `NATURA_PUBLICACION_HABILITADA=true`. Permanecen inactivos dentro de `stock` porque allí están anidados.
- El nuevo `verificar-fuentes-natura.yml` solo ejecuta pruebas y validaciones locales; no usa secretos ni escribe en Drive, Apps Script o el inventario.
- Los publicadores anteriores de `stock/.github/workflows/` siguen siendo la ruta operativa hasta comprobar la sustitución.

## Dependencias técnicas comprobadas en GitHub

- **GitHub Pages y enlaces públicos:** `catalogo.html`, `sitemap.xml`, `robots.txt`, `catalogo-carrito-pedido.js`, `catalogo-herramientas.js` y las pruebas contienen o verifican referencias a la ruta actual `https://irenismb.github.io/stock/natura/catalogo.html`. No modificar estas referencias antes de publicar y comprobar un destino nuevo.
- **Workflows:** los flujos operativos del monorrepositorio se alojan en `stock/.github/workflows/`. Los de `stock/natura/.github/workflows/` están preparados para la raíz del futuro repositorio, pero actualmente no ejecutan GitHub Actions.
- **Apps Script:** hay cuatro proyectos autorizados en `apps-script/google-projects.json`, más el directorio auxiliar del lector público. El lector y el administrador comparten `scriptId`. La versión futura del publicador del lector abortará sin escribir en Google si detecta esa coincidencia; se requiere resolverla antes de activarlo.
- **Credenciales:** los secretos como `CLASPRC_JSON`, las variables de GitHub Actions, los permisos de Google y los deployments no se trasladan automáticamente al crear el repositorio. Comprobarlos sin registrar sus valores en archivos.
- **Verificación:** el archivo `.github/workflows/verificar-fuentes-natura.yml` valida sintaxis, manifiestos y pruebas de integración sin enviar datos ni publicar. Como está anidado, no se ejecuta desde `stock`; falta probarlo desde un repositorio autónomo.
- **Restricción de la conexión:** el conector de GitHub disponible permite editar archivos y ramas, pero no crear repositorios. Para continuar con el repositorio independiente, hará falta crearlo en la cuenta personal existente por una vía autorizada. No iniciar el traslado ni retirar `stock` hasta disponer del destino.

## Secuencia pendiente para independizar Natura

1. Confirmar cuál es la versión vigente de los archivos que difieran entre GitHub y Drive; no sobrescribir ninguno por defecto.
2. Crear el repositorio individual `natura` en la misma cuenta, manteniendo los repositorios existentes y sin renombrar todavía la cuenta.
3. Llevar el contenido de `natura/` a la raíz del nuevo repositorio, incluida `.github/workflows/`, conservando el historial de la subcarpeta cuando sea viable.
4. Ejecutar primero la validación de solo lectura; resolver las rutas relativas, referencias externas, Pages, secretos, permisos y conexiones Apps Script antes de activar cualquier publicador.
5. Validar que el nuevo repositorio sirve el catálogo y que los servicios de Google se mantienen correctos. Solo entonces, y con autorización, sustituir las rutas de publicación anteriores.
6. Decidir el cambio definitivo de fuente principal y diseñar una sincronización GitHub → Drive selectiva, con detección de conflictos y sin escribir datos comerciales.

Criterio de cierre: repositorio independiente verificable, pruebas aprobadas, publicaciones sin interrupción ni duplicidad y origen de sincronización documentado. Ningún paso pendiente autoriza cambios automáticos en servicios externos.
