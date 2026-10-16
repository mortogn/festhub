import { HTTPException } from "hono/http-exception";
import { sign, verify } from "hono/jwt";

const issuer = "festhub/api";

type JWTPayload = {
  jid: string;
  familyId: string;
  sub: string;
  role: string;
  iss: string;
  exp: number;
  iat: number;
};

function generateAccessToken(
  payload: Omit<JWTPayload, "exp" | "iat" | "iss" | "familyId" | "jid">,
): Promise<string> {
  const secretKey = process.env.ACCESS_TOKEN_SECRET;
  if (!secretKey) {
    throw new Error("JWT secret key is not defined");
  }

  const finalPayload: Omit<JWTPayload, "familyId" | "jid"> = {
    ...payload,
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + 60 * 15, // 15 minutes
    iat: Math.floor(Date.now() / 1000),
  };

  return sign(finalPayload, secretKey);
}

function generateRefreshToken(
  payload: Omit<JWTPayload, "exp" | "iat" | "iss">,
): Promise<string> {
  const secretKey = process.env.REFRESH_TOKEN_SECRET;
  if (!secretKey) {
    throw new Error("JWT secret key is not defined");
  }

  const finalPayload: JWTPayload = {
    ...payload,
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    iat: Math.floor(Date.now() / 1000),
  };

  return sign(finalPayload, secretKey);
}

async function verifyToken(
  token: string,
  secretKey: string,
): Promise<JWTPayload> {
  const decodedPayload = await verify(token, secretKey, "HS256");

  if (
    decodedPayload.iss !== issuer ||
    !decodedPayload.iat ||
    decodedPayload.iat > Math.floor(Date.now() / 1000) ||
    !decodedPayload.exp ||
    decodedPayload.exp < Math.floor(Date.now() / 1000)
  ) {
    throw new HTTPException(401, {
      message: "Invalid or expired token",
    });
  }

  return decodedPayload as JWTPayload;
}

async function verifyAccessToken(token: string) {
  const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;

  if (!accessTokenSecret) {
    throw new Error("Missing ACCESS_TOKEN_SECRET env variable");
  }

  return verifyToken(token, accessTokenSecret);
}

async function verifyRefreshToken(token: string) {
  const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!refreshTokenSecret) {
    throw new Error("Missing REFRESH_TOKEN_SECRET env variable");
  }

  return verifyToken(token, refreshTokenSecret);
}

export {
  type JWTPayload,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
