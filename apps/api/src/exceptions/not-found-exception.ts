import { HTTPException } from "hono/http-exception";

export class NotFoundException extends HTTPException {
  constructor(message?: string) {
    super(404, { message: message || "Not found" });
  }
}
