export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class SyllabusReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyllabusReadError";
  }
}

export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelError";
  }
}
