import {
  RefDrugsQuerySchema,
  RefSearchQuerySchema,
} from '@smarthealth/contracts';
import { Router } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { requireDb } from '../../firebase/firestore-helpers.js';
import {
  COLLECTIONS,
  type DrugReferenceDoc,
} from '../../firebase/firestore-types.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export function refRoutes(deps: AppDeps): Router {
  const router = Router();

  router.get(
    '/ref/drugs',
    requirePermission('drug_catalog:read'),
    validate({ query: RefDrugsQuerySchema }),
    async (_req, res, next) => {
      try {
        const query = res.locals.validated!.query as {
          query?: string;
          equivalent_to?: string;
          limit: number;
        };
        const db = requireDb(deps);
        const snap = await db
          .collection(COLLECTIONS.drugReference)
          .where('is_active', '==', true)
          .limit(200)
          .get();

        const allDrugs = snap.docs.map((d) => d.data() as DrugReferenceDoc);
        let filtered = allDrugs;

        if (query.equivalent_to) {
          const target = allDrugs.find((d) => d.id === query.equivalent_to);
          filtered = target
            ? allDrugs.filter(
                (d) =>
                  d.id !== target.id &&
                  d.active_ingredient.toLowerCase() === target.active_ingredient.toLowerCase() &&
                  d.strength.toLowerCase() === target.strength.toLowerCase(),
              )
            : [];
        } else if (query.query) {
          const needle = query.query.trim().toLowerCase();
          filtered = allDrugs.filter(
            (d) =>
              d.brand_name.toLowerCase().includes(needle) ||
              d.generic_name.toLowerCase().includes(needle) ||
              d.active_ingredient.toLowerCase().includes(needle),
          );
        }

        const data = filtered
          .sort((a, b) => a.brand_name.localeCompare(b.brand_name))
          .slice(0, query.limit)
          .map((d) => ({
            id: d.id,
            code: d.atc_code ?? d.id,
            brand_name: d.brand_name,
            generic_name: d.generic_name,
            strength: d.strength,
            dosage_form: d.dosage_form,
            route: 'oral',
            base_unit: d.base_unit,
            is_controlled: d.is_controlled,
            ingredients: [
              {
                code: d.active_ingredient.toUpperCase(),
                name: d.active_ingredient,
                strength: d.strength,
              },
            ],
          }));

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
        const query = res.locals.validated!.query as { query: string; limit: number };
        const db = requireDb(deps);
        const needle = query.query.trim().toLowerCase();
        const snap = await db.collection(COLLECTIONS.icd10Reference).limit(200).get();

        const data = snap.docs
          .map((doc) => doc.data() as { code: string; title_en: string; title_ar?: string; is_chronic_default?: boolean })
          .filter(
            (r) =>
              r.code.toLowerCase().includes(needle) ||
              r.title_en.toLowerCase().includes(needle) ||
              (r.title_ar ?? '').toLowerCase().includes(needle),
          )
          .slice(0, query.limit)
          .map((r) => ({
            code: r.code,
            name: { en: r.title_en, ar: r.title_ar ?? r.title_en },
            is_chronic_default: Boolean(r.is_chronic_default),
          }));

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
        const query = res.locals.validated!.query as { query: string; limit: number };
        const db = requireDb(deps);
        const needle = query.query.trim().toLowerCase();
        const snap = await db.collection(COLLECTIONS.allergensReference).limit(200).get();

        const data = snap.docs
          .map((doc) =>
            doc.data() as {
              allergen_type: 'ingredient' | 'drug_class';
              code: string;
              name_en: string;
              name_ar?: string;
            },
          )
          .filter(
            (r) =>
              r.code.toLowerCase().includes(needle) ||
              r.name_en.toLowerCase().includes(needle) ||
              (r.name_ar ?? '').toLowerCase().includes(needle),
          )
          .slice(0, query.limit)
          .map((r) => ({
            allergen_type: r.allergen_type,
            code: r.code,
            name: { en: r.name_en, ar: r.name_ar ?? r.name_en },
          }));

        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/ref/specialties', async (_req, res, next) => {
    try {
      const db = requireDb(deps);
      const snap = await db.collection(COLLECTIONS.specialtiesReference).limit(100).get();
      const data = snap.docs
        .map((doc) => doc.data() as { code: string; name_en: string; name_ar?: string })
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((r) => ({
          code: r.code,
          name: { en: r.name_en, ar: r.name_ar ?? r.name_en },
        }));
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
