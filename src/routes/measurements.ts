import { Router, Request, Response } from "express";
import { DatabaseService } from "../services/appwrite";
import { validateRequest, measurementSchema } from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// Create a new measurement
router.post(
  "/",
  validateRequest(measurementSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // Verify project exists
    const project = await DatabaseService.getProject(req.body.projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const measurement = await DatabaseService.createMeasurement(req.body);
    res.status(201).json({
      success: true,
      data: measurement
    });
  })
);

// Get measurements for a project
router.get(
  "/project/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const measurements = await DatabaseService.getMeasurements(
      req.params.projectId,
      limit
    );
    
    res.json({
      success: true,
      data: measurements,
      count: measurements.length
    });
  })
);

// Get latest measurement for a project
router.get(
  "/project/:projectId/latest",
  asyncHandler(async (req: Request, res: Response) => {
    const measurements = await DatabaseService.getMeasurements(
      req.params.projectId,
      1
    );
    
    if (measurements.length === 0) {
      throw new AppError('No measurements found', 404);
    }
    
    res.json({
      success: true,
      data: measurements[0]
    });
  })
);

// Bulk upload measurements
router.post(
  "/bulk",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, measurements } = req.body;
    
    if (!Array.isArray(measurements)) {
      throw new AppError('Measurements must be an array', 400);
    }
    
    const results = [];
    for (const measurement of measurements) {
      const result = await DatabaseService.createMeasurement({
        projectId,
        ...measurement
      });
      results.push(result);
    }
    
    res.status(201).json({
      success: true,
      data: results,
      count: results.length
    });
  })
);

export default router;
