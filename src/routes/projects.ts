import { Router, Request, Response } from "express";
import { DatabaseService } from "../services/appwrite";
import { validateRequest, projectSchema } from "../middleware/validation";
import { asyncHandler } from "../middleware/errorHandler";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// Create a new project
router.post(
  "/",
  validateRequest(projectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const project = await DatabaseService.createProject(req.body);
    res.status(201).json({
      success: true,
      data: project
    });
  })
);

// Get all projects
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const electricianId = req.query.electricianId as string | undefined;
    const projects = await DatabaseService.listProjects(electricianId);
    res.json({
      success: true,
      data: projects,
      count: projects.length
    });
  })
);

// Get single project
router.get(
  "/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    const project = await DatabaseService.getProject(req.params.projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }
    res.json({
      success: true,
      data: project
    });
  })
);

// Update project status
router.patch(
  "/:projectId/status",
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!['active', 'completed', 'pending'].includes(status)) {
      throw new AppError('Invalid status', 400);
    }
    
    // Update logic here
    res.json({
      success: true,
      message: 'Status updated'
    });
  })
);

export default router;
