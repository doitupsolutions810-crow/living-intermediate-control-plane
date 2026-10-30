/**
 * @typedef {{id: string, version?: string, kind?: string, registeredAt?: string, digest?: string}} PlatformComponent
 * @typedef {{status: 'available', components: PlatformComponent[]} | {status: 'unavailable', httpStatus?: number, error?: string} | {status: 'invalid'}} ComponentRegistrySnapshot
 */

/**
 * @param {unknown} value
 * @returns {value is PlatformComponent}
 */
function isPlatformComponent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const component = value;
  return (
    typeof component.id === 'string' &&
    component.id.length > 0 &&
    (component.version === undefined || typeof component.version === 'string') &&
    (component.kind === undefined || typeof component.kind === 'string') &&
    (component.registeredAt === undefined || typeof component.registeredAt === 'string') &&
    (component.digest === undefined || typeof component.digest === 'string')
  );
}

/**
 * @param {unknown} value
 * @returns {ComponentRegistrySnapshot}
 */
export function parseComponentRegistry(value) {
  if (!Array.isArray(value) || !value.every(isPlatformComponent)) {
    return { status: 'invalid' };
  }
  return { status: 'available', components: value };
}
