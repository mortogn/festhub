import { JWTPayload } from "../utils/jwt.js";

export type AuthenticatedUser = {
  id: JWTPayload["sub"];
  role: JWTPayload["role"];
  authenticated: false;
};

export type UnAuthenticatedUser = {
  authenticated: false;
};

export type Variables = {
  user: AuthenticatedUser | UnAuthenticatedUser;
};

export type AppVars = {
  Variables: Variables;
};
