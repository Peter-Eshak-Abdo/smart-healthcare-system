import type { RequestHandler } from 'express';
import type { z } from 'zod';

export interface ValidateSchemas<
  P extends z.ZodTypeAny = z.ZodTypeAny,
  Q extends z.ZodTypeAny = z.ZodTypeAny,
  B extends z.ZodTypeAny = z.ZodTypeAny,
> {
  params?: P;
  query?: Q;
  body?: B;
}

export interface ValidatedData<P = unknown, Q = unknown, B = unknown> {
  params: P;
  query: Q;
  body: B;
}

export function validate<
  P extends z.ZodTypeAny = z.ZodTypeAny,
  Q extends z.ZodTypeAny = z.ZodTypeAny,
  B extends z.ZodTypeAny = z.ZodTypeAny,
>(schemas: ValidateSchemas<P, Q, B>): RequestHandler {
  return (req, res, next) => {
    try {
      const params = schemas.params ? schemas.params.parse(req.params) : req.params;
      const query = schemas.query ? schemas.query.parse(req.query) : req.query;
      const body = schemas.body ? schemas.body.parse(req.body) : req.body;
      res.locals.validated = { params, query, body };
      next();
    } catch (err) {
      next(err);
    }
  };
}
