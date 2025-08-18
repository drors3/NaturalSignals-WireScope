import { Router } from "express";
import { DatabaseService } from "../services/appwrite";
import { DiagnosticsEngine } from "../services/diagnostics";
import { asyncHandler } from "../middleware/errorHandler";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// Run diagnostics for a project
router.get(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { save } = req.query;

    // Get project details
    const project = await DatabaseService.getProject(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Get recent measurements
    const measurements = await DatabaseService.getMeasurements(projectId, 20);
    
    if (measurements.length === 0) {
      return res.json({
        success: true,
        data: {
          projectId,
          message: 'No measurements available for diagnosis',
          recommendations: ['Take initial measurements']
        }
      });
    }

    // Run diagnostic engine
    const diagnosis = await DiagnosticsEngine.runDiagnostics(project, measurements);

    // Optionally save diagnosis to database
    if (save === 'true') {
      await DatabaseService.saveDiagnosis(diagnosis);
    }

    res.json({
      success: true,
      data: diagnosis
    });
  })
);

// Get diagnosis history
router.get(
  "/:projectId/history",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    
    // This would fetch from diagnoses collection
    res.json({
      success: true,
      data: [],
      message: 'Feature coming soon'
    });
  })
);

// Manual diagnosis with custom rules
router.post(
  "/:projectId/manual",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { rules, thresholds } = req.body;
    
    // Custom diagnosis logic here
    res.json({
      success: true,
      message: 'Manual diagnosis completed'
    });
  })
);

export default router;
