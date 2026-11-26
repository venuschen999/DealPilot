// Raised when a provider responds with something we cannot use. The search
// route catches it per source so one bad provider never blocks the others.
export class SourceResponseError extends Error {
  constructor(
    readonly source: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${source}: ${message}`);
    this.name = "SourceResponseError";
  }
}
