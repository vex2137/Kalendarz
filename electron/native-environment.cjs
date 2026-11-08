const path = require('node:path');

// Apply OmniCore's subprocess-isolation principle without altering the host environment:
// CUDA tools must not inherit unrelated AppImage loader libraries.
function nativeProcessEnvironment(environment = process.env) {
  const result = {...environment};
  if (!environment.APPDIR) return result;
  const root = path.resolve(environment.APPDIR);
  const original = environment.LD_LIBRARY_PATH_ORIG ?? environment.LD_LIBRARY_PATH ?? '';
  const entries = original.split(path.delimiter).filter(Boolean).filter(entry => {
    const relative = path.relative(root, path.resolve(entry));
    return relative !== '' && (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative));
  });
  const restored = [...new Set(entries)].join(path.delimiter);
  if (restored) { result.LD_LIBRARY_PATH = restored; result.LD_LIBRARY_PATH_ORIG = restored; }
  else { delete result.LD_LIBRARY_PATH; delete result.LD_LIBRARY_PATH_ORIG; }
  return result;
}
module.exports = {nativeProcessEnvironment};
