export type ApiErrorKind = "not_found" | "invalid" | "rate_limited" | "network" | "server";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 404) return "not_found";
  if (status === 400) return "invalid";
  if (status === 429) return "rate_limited";
  return "server";
}
