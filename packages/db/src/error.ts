import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError } from "pg";

export type DBError = DrizzleQueryError & { cause: DatabaseError };

export const isDBError = (error: unknown): error is DBError => {
  return (
    error instanceof DrizzleQueryError && error.cause instanceof DatabaseError
  );
};
