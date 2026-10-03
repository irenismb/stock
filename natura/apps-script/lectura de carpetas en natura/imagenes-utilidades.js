// Utilidades de carpetas, archivos, nombres y códigos de producto.

function isExcludedResourceFolder_(
  normalizedFolderName
) {
  return CONFIG.EXCLUDED_RESOURCE_FOLDERS
    .some(name =>
      normalizeFolderName_(name) ===
      normalizedFolderName
    );
}

function normalizeFolderName_(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

function fileInfo(file) {
  const id = file.getId();
  const modifiedTime = file.getLastUpdated();
  const version = modifiedTime instanceof Date
    ? String(modifiedTime.getTime())
    : String(Date.now());

  return {
    id: id,
    name: file.getName(),
    modifiedTime:
      modifiedTime instanceof Date
        ? modifiedTime.toISOString()
        : '',
    version: version,

    /*
     * URL utilizada por el catálogo.
     * La versión cambia automáticamente cuando Drive actualiza el archivo,
     * evitando que el navegador o Google reutilicen una imagen anterior.
     */
    url:
      'https://lh3.googleusercontent.com/d/' +
      encodeURIComponent(id) +
      '?v=' +
      encodeURIComponent(version)
  };
}

function extractProductCode(name) {
  const match = String(name).match(
    /^(\d{4})(?=_|[\s.-]|$)/
  );

  return match
    ? match[1]
    : '';
}

function isImage(file) {
  const name =
    String(file.getName())
      .toLowerCase();

  const extension =
    name.includes('.')
      ? name.split('.').pop()
      : '';

  return CONFIG.IMAGE_EXTENSIONS
    .includes(extension);
}
