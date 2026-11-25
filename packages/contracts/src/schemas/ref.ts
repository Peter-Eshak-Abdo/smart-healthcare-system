import { z } from 'zod';
import { LocalizedTextSchema, UuidSchema } from './common.js';

export const RefDrugsQuerySchema = z
  .object({
    query: z.string().trim().min(1).max(100).optional(),
    equivalent_to: UuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .refine(
    (v) => Boolean(v.query) || Boolean(v.equivalent_to),
    'Either query or equivalent_to is required',
  );

export const RefDrugIngredientSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    strength: z.string().nullable(),
  })
  .strict();

export const RefDrugDtoSchema = z
  .object({
    id: UuidSchema,
    code: z.string(),
    brand_name: z.string(),
    generic_name: z.string(),
    strength: z.string(),
    dosage_form: z.string(),
    route: z.string(),
    base_unit: z.string(),
    is_controlled: z.boolean(),
    ingredients: z.array(RefDrugIngredientSchema),
  })
  .strict();

export const RefDrugsResponseSchema = z
  .object({
    data: z.array(RefDrugDtoSchema),
  })
  .strict();

export const RefSearchQuerySchema = z
  .object({
    query: z.string().trim().min(1).max(100),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const RefIcd10DtoSchema = z
  .object({
    code: z.string(),
    name: LocalizedTextSchema,
    is_chronic_default: z.boolean(),
  })
  .strict();

export const RefIcd10ResponseSchema = z
  .object({
    data: z.array(RefIcd10DtoSchema),
  })
  .strict();

export const RefAllergenDtoSchema = z
  .object({
    type: z.enum(['ingredient', 'drug_class']),
    code: z.string(),
    name: LocalizedTextSchema,
  })
  .strict();

export const RefAllergensResponseSchema = z
  .object({
    data: z.array(RefAllergenDtoSchema),
  })
  .strict();

export const RefSpecialtyDtoSchema = z
  .object({
    code: z.string(),
    name: LocalizedTextSchema,
    sort_order: z.number().int(),
  })
  .strict();

export const RefSpecialtiesResponseSchema = z
  .object({
    data: z.array(RefSpecialtyDtoSchema),
  })
  .strict();
