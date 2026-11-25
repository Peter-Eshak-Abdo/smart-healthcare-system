import {
  RefDrugsQuerySchema,
  RefSearchQuerySchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import { sql } from 'kysely';
import type { AppDeps } from '../../app-deps.js';
import { withUserTx } from '../../db/with-user-tx.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../shared/errors.js';

export function refRoutes(deps: AppDeps): Router {
  const router = Router();

  const requirePools = () => {
    if (!deps.pools) {
      throw new AppError('INTERNAL_ERROR', { detail: 'database_not_configured' });
    }
    return deps.pools;
  };

  router.get(
    '/ref/drugs',
    requirePermission('drug_catalog:read'),
    validate({ query: RefDrugsQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as {
          query?: string;
          equivalent_to?: string;
          limit: number;
        };
        const pools = requirePools();

        const data = await withUserTx(pools, auth, async (tx) => {
          const pattern = query.query ? `%${query.query.toLowerCase()}%` : null;

          const rows = query.equivalent_to
            ? (
                await sql<{
                  id: string;
                  code: string;
                  brand_name: string;
                  generic_name: string;
                  strength: string;
                  dosage_form: string;
                  route: string;
                  base_unit: string;
                  is_controlled: boolean;
                }>`
                  with target as (
                    select array_agg((di.ingredient_code || ':' || coalesce(di.strength_value::text, '') || ':' || coalesce(di.strength_unit, '')) order by di.ingredient_code) as sig
                      from ref.drug_ingredients di
                     where di.drug_id = ${query.equivalent_to}::uuid
                  )
                  select d.id, d.code, d.brand_name, d.generic_name, d.strength, d.dosage_form, d.route, d.base_unit, d.is_controlled
                    from ref.drugs d
                    join ref.drug_ingredients di on di.drug_id = d.id
                   where d.is_active
                     and d.id <> ${query.equivalent_to}::uuid
                   group by d.id
                  having array_agg((di.ingredient_code || ':' || coalesce(di.strength_value::text, '') || ':' || coalesce(di.strength_unit, '')) order by di.ingredient_code)
                       = (select sig from target)
                   order by d.brand_name asc
                   limit ${query.limit}
                `.execute(tx)
              ).rows
            : (
                await sql<{
                  id: string;
                  code: string;
                  brand_name: string;
                  generic_name: string;
                  strength: string;
                  dosage_form: string;
                  route: string;
                  base_unit: string;
                  is_controlled: boolean;
                }>`
                  select id, code, brand_name, generic_name, strength, dosage_form, route, base_unit, is_controlled
                    from ref.drugs
                   where is_active
                     and (lower(brand_name) like ${pattern} or lower(generic_name) like ${pattern} or lower(code) like ${pattern})
                   order by brand_name asc
                   limit ${query.limit}
                `.execute(tx)
              ).rows;

          if (rows.length === 0) return [];

          const ids = rows.map((r) => r.id);
          const ingRes = await sql<{
            drug_id: string;
            code: string;
            name: string;
            strength_value: string | null;
            strength_unit: string | null;
          }>`
            select di.drug_id, i.code, i.name_en as name, di.strength_value::text, di.strength_unit
              from ref.drug_ingredients di
              join ref.ingredients i on i.code = di.ingredient_code
             where di.drug_id = any(${ids}::uuid[])
          `.execute(tx);

          const ingMap = new Map<string, Array<{ code: string; name: string; strength: string | null }>>();
          for (const ing of ingRes.rows) {
            const list = ingMap.get(ing.drug_id) ?? [];
            list.push({
              code: ing.code,
              name: ing.name,
              strength: ing.strength_value ? `${ing.strength_value} ${ing.strength_unit ?? ''}`.trim() : null,
            });
            ingMap.set(ing.drug_id, list);
          }

          return rows.map((d) => ({
            ...d,
            ingredients: ingMap.get(d.id) ?? [],
          }));
        });

        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/ref/icd10',
    requirePermission('drug_catalog:read'),
    validate({ query: RefSearchQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as { query: string; limit: number };
        const pools = requirePools();
        const pattern = `%${query.query.toLowerCase()}%`;

        const data = await withUserTx(pools, auth, async (tx) => {
          const rows = await sql<{
            code: string;
            title_en: string;
            title_ar: string | null;
            is_chronic_default: boolean;
          }>`
            select code, title_en, title_ar, is_chronic_default
              from ref.icd10_codes
             where lower(code) like ${pattern}
                or lower(title_en) like ${pattern}
                or coalesce(lower(title_ar), '') like ${pattern}
             order by code asc
             limit ${query.limit}
          `.execute(tx);

          return rows.rows.map((r) => ({
            code: r.code,
            name: { en: r.title_en, ar: r.title_ar ?? r.title_en },
            is_chronic_default: r.is_chronic_default,
          }));
        });

        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/ref/allergens',
    validate({ query: RefSearchQuerySchema }),
    async (_req, res, next) => {
      try {
        const auth = res.locals.auth!;
        const query = res.locals.validated!.query as { query: string; limit: number };
        const pools = requirePools();
        const pattern = `%${query.query.toLowerCase()}%`;

        const data = await withUserTx(pools, auth, async (tx) => {
          const rows = await sql<{
            type: 'ingredient' | 'drug_class';
            code: string;
            name_en: string;
            name_ar: string | null;
          }>`
            select 'ingredient'::text as type, code, name_en, name_ar
              from ref.ingredients
             where lower(code) like ${pattern} or lower(name_en) like ${pattern} or coalesce(lower(name_ar), '') like ${pattern}
            union all
            select 'drug_class'::text as type, code, name_en, name_ar
              from ref.drug_classes
             where lower(code) like ${pattern} or lower(name_en) like ${pattern} or coalesce(lower(name_ar), '') like ${pattern}
             order by name_en asc
             limit ${query.limit}
          `.execute(tx);

          return rows.rows.map((r) => ({
            type: r.type,
            code: r.code,
            name: { en: r.name_en, ar: r.name_ar ?? r.name_en },
          }));
        });

        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/ref/specialties', async (_req, res, next) => {
    try {
      const auth = res.locals.auth!;
      const pools = requirePools();

      const data = await withUserTx(pools, auth, async (tx) => {
        const rows = await tx
          .selectFrom('ref.specialties')
          .select(['code', 'name_en', 'name_ar', 'sort_order'])
          .orderBy('sort_order', 'asc')
          .execute();
        return rows.map((r) => ({
          code: r.code,
          name: { en: r.name_en, ar: r.name_ar },
          sort_order: r.sort_order,
        }));
      });

      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
