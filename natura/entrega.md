# Preparación de Natura para entrega

Natura debe tener todos sus archivos de código, imágenes, automatizaciones, Apps Script y documentación dentro de su propia carpeta y, tras la migración, dentro de su repositorio independiente.

Los workflows de GitHub Actions solo se ejecutan si están situados en `.github/workflows/` en la raíz del repositorio. Por ello los workflows actualmente operativos de `stock/.github/workflows/` deben permanecer allí hasta crear el repositorio independiente `natura`.

Google Drive será la fuente de los archivos de trabajo; la sincronización normal debe ser de Drive hacia GitHub. No ejecutar simultáneamente dos publicadores de Apps Script.

La copia del repositorio no transfiere secretos, permisos, datos externos, cuentas de Google, despliegues ni dominios. Documentar y reconectar de forma segura estas dependencias antes de entregar el proyecto.

Cuenta futura prevista: `grupo` (pendiente de registro y confirmación).
