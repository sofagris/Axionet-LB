import { z } from "zod";
import { IdentityUserSchema } from "./identity";

export const UserSchema = IdentityUserSchema;

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  user: UserSchema,
});

export type User = z.infer<typeof UserSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
