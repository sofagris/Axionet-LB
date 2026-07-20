import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  user: UserSchema,
});

export type User = z.infer<typeof UserSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
