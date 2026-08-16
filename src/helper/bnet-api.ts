import { ServerResponse } from "@taskeren/bungie-api-ts/app";
import { PlatformErrorCodes } from "@taskeren/bungie-api-ts/destiny2";
import { HTTPException } from "hono/http-exception";

export function unwrapResponse<T>(response: ServerResponse<T>): T {
  if (response.ErrorCode !== PlatformErrorCodes.Success) {
    console.error("Can't unwrap a response!", response);
    console.error(new Error("Can't unwrap a ServerResponse").stack);
    throw new HTTPException(500, { message: response.Message });
  }
  return response.Response;
}
