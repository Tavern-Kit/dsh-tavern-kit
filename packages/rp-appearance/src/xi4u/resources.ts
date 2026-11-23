import { BufferGeometry, Material, Mesh, Points, Line, Texture, ShaderMaterial, type Scene } from 'three';

/** Shared source materials/textures occur in thousands of meshes and must only be released once. */
export function disposeGardenResources(scene: Scene, registered: Iterable<unknown>): void {
  const resources = new Set<BufferGeometry | Material | Texture>();
  const collect = (value: unknown) => {
    if (value instanceof BufferGeometry || value instanceof Material || value instanceof Texture) resources.add(value);
  };
  for (const value of registered) collect(value);
  scene.traverse(object => {
    if (!(object instanceof Mesh || object instanceof Points || object instanceof Line)) return;
    collect(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) collect(material);
  });
  for (const resource of resources) {
    if (!(resource instanceof Material)) continue;
    for (const value of Object.values(resource) as unknown[]) if (value instanceof Texture) collect(value);
    if (resource instanceof ShaderMaterial) for (const uniform of Object.values(resource.uniforms)) collect(uniform.value);
  }
  for (const resource of resources) resource.dispose();
  scene.clear();
}
