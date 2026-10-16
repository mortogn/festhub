import { HTTPException } from "hono/http-exception";

export class AuthException extends HTTPException {
  constructor(message?: string) {
    super(401, {
      message: message || "Unauthorized! Please log in to continue",
    });
  }
}
