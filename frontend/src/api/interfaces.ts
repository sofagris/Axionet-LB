import { apiFetch } from "./client";
import {
  InterfaceRescanSchema,
  PhysicalInterfaceSchema,
  type InterfaceRescan,
  type PhysicalInterface,
} from "../types/interfaces";
import { z } from "zod";

export function fetchInterfaces(): Promise<PhysicalInterface[]> {
  return apiFetch("/api/v1/interfaces", (data) => z.array(PhysicalInterfaceSchema).parse(data));
}

export function rescanInterfaces(): Promise<InterfaceRescan> {
  return apiFetch("/api/v1/interfaces/rescan", (data) => InterfaceRescanSchema.parse(data), {
    method: "POST",
  });
}
