import { HTTPException } from "hono/http-exception";

export class InternalServerErrorException extends HTTPException {
  constructor(message?: string, cause?: unknown) {
    super(500, { message: message || "Internal server error", cause });
  }
}
