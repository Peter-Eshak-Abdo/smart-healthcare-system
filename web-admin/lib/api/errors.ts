import type { ProblemDetails } from '@smarthealth/contracts';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: Partial<ProblemDetails>;

  constructor(status: number, problem: Partial<ProblemDetails>) {
    super(problem.detail ?? problem.title ?? problem.code ?? `HTTP_${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = problem.code ?? 'INTERNAL_ERROR';
    this.problem = problem;
  }
}

export function isApiErrorCode(err: unknown, code: string): boolean {
  return err instanceof ApiRequestError && err.code === code;
}
