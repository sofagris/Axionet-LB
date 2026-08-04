import { designerRoleSchema, type DesignerPropField } from "../catalog/designerManifests";

export type ComponentPropField = DesignerPropField;

/** Default editable props per component role (from Catalog designer manifests). */
export function defaultComponentProps(role: string): Record<string, string> {
  const schema = designerRoleSchema(role);
  if (!schema) return {};
  const out: Record<string, string> = {};
  for (const field of schema.props) {
    out[field.key] = field.default ?? "";
  }
  return out;
}

export function componentPropFields(role: string): ComponentPropField[] {
  return designerRoleSchema(role)?.props ?? [];
}
