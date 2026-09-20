# Apps Script de Natura

Esta carpeta de Google Drive es la fuente de trabajo del código Apps Script de Natura. GitHub conserva el historial y realiza la publicación automática hacia los proyectos reales de Google Apps Script.

## Proyectos oficiales

- `administrar precios natura`
- `pedidos natura`
- `lectura de carpetas en natura`
- `coordenadas de visitantes natura`

## Fuente maestra y sincronización

- **Google Drive `stock/natura/apps-script` es la fuente de trabajo del código Apps Script del proyecto.**
- El flujo normal y obligatorio es **Google Drive → GitHub → Google Apps Script**.
- Primero se modifica en Google Drive. Después se sincronizan a GitHub exactamente los mismos archivos. Finalmente GitHub Actions publica automáticamente en el mismo proyecto y deployment oficial de Apps Script.
- El proyecto real de Google Apps Script es un destino de ejecución y despliegue, no la fuente normal de edición.
- No se usa `clasp pull` para sobrescribir GitHub o Google Drive desde Apps Script dentro del flujo normal.
- La publicación automática valida el `scriptId`, el nombre del proyecto y el deployment oficial antes de ejecutar `clasp push --force`.
- La automatización no puede crear ni renombrar proyectos, cambiar `scriptId`, crear deployments sustitutos ni cambiar endpoints. Si una validación falla, la publicación afectada se detiene.

## Administración de precios

El proyecto `administrar precios natura` publica el servicio autenticado que permite administrar el catálogo. La edición se ejecuta como la cuenta de Google que accede y requiere que esa cuenta tenga permiso sobre el inventario oficial.

La escritura resuelve los campos por el texto actual de los encabezados, exige una coincidencia única del código y conserva el formato de las celdas.
