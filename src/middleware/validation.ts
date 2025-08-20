import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
        return;
      }
      next(error);
    }
  };
};

// Validation schemas
export const projectSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().optional(),
  clientName: z.string().optional(),
  electricianId: z.string().optional(),
  status: z.enum(['active', 'completed', 'pending']).default('active'),
  systemType: z.enum(['single-phase', 'three-phase', 'dc-system']),
  voltageRating: z.number().positive()
});

export const measurementSchema = z.object({
  projectId: z.string(),
  phaseA: z.object({
    voltage: z.number(),
    current: z.number(),
    power: z.number().optional(),
    temperature: z.number().optional()
  }).optional(),
  phaseB: z.object({
    voltage: z.number(),
    current: z.number(),
    power: z.number().optional(),
    temperature: z.number().optional()
  }).optional(),
  phaseC: z.object({
    voltage: z.number(),
    current: z.number(),
    power: z.number().optional(),
    temperature: z.number().optional()
  }).optional(),
  neutral: z.object({
    current: z.number(),
    voltage: z.number().optional()
  }).optional(),
  ground: z.object({
    resistance: z.number(),
    leakageCurrent: z.number().optional()
  }).optional(),
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  powerFactor: z.number().min(0).max(1).optional(),
  frequency: z.number().optional(),
  notes: z.string().optional()
});
