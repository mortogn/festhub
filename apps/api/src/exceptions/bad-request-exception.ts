import { HTTPException } from "hono/http-exception";

export class BadRequestException extends HTTPException {
  constructor(messaage?: string, cause?: unknown) {
    super(400, { message: messaage || "Bad Request", cause });
  }
}
