import { z } from "zod";
import { apiFetch } from "./client";

export const ServiceDefinitionSchema = z.object({
  service_type: z.string(),
  display_name: z.string(),
  description: z.string(),
  container_image: z.string(),
  default_version: z.string(),
  enabled: z.boolean(),
  supported_actions: z.array(z.string()),
});

export type ServiceDefinition = z.infer<typeof ServiceDefinitionSchema>;

export function fetchServiceDefinitions(): Promise<ServiceDefinition[]> {
  return apiFetch("/api/v1/service-definitions", (data) =>
    z.array(ServiceDefinitionSchema).parse(data),
  );
}

export function fetchServiceDefinition(serviceType: string): Promise<ServiceDefinition> {
  return apiFetch(`/api/v1/service-definitions/${serviceType}`, (data) =>
    ServiceDefinitionSchema.parse(data),
  );
}
