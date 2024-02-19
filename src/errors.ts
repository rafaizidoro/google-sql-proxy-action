export enum ErrorType {
  TIMEOUT = "TIMEOUT",
  SOCKET = "SOCKET",
  INTERNAL = "INTERNAL",
}
export class ActionError extends Error {
  type: ErrorType;
  message: string;
  cause: any;

  constructor({
    type,
    message,
    cause,
  }: {
    type: ErrorType;
    message: string;
    cause?: any;
  }) {
    super();
    this.type = type;
    this.message = message;
    this.cause = cause;
  }
}
