import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import winston from "winston";
import projectsRouter from "./routes/projects";
import simulatorRouter from "./routes/simulator";

// Import routes
import projectsRouter from "./routes/projects";
import measurementsRouter from "./routes/measurements";
import diagnoseRouter from "./routes/diagnose";

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { InternalSensorSimulator } from "./services/internal-simulator";

// Load environment variables
dotenv.config();

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'combined.log' 
    })
  ]
});

// Create Express app
const app: Application = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: '*', // Allow all origins during development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check
app.get("/", (_req: Request, res: Response) => {
  res.json({
    status: 'operational',
    service: 'NaturalSignals-WireScope Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// API Routes
app.use("/api/projects", projectsRouter);
app.use("/api/measurements", measurementsRouter);
app.use("/api/diagnose", diagnoseRouter);

// Simulator control endpoints
app.post("/api/simulator/start/:projectId", (req: Request, res: Response) => {
  const { projectId } = req.params;
  const config = req.body; // Optional configuration
  
  InternalSensorSimulator.start(projectId, config);
  res.json({ success: true, message: "Simulator started" });
});

app.post("/api/simulator/stop", (_req: Request, res: Response) => {
  InternalSensorSimulator.stop();
  res.json({ success: true, message: "Simulator stopped" });
});

app.get("/api/simulator/status", (_req: Request, res: Response) => {
  res.json({ 
    success: true, 
    running: InternalSensorSimulator.isRunning() 
  });
});

// API Documentation endpoint
app.get("/api/docs", (_req: Request, res: Response) => {
  res.json({
    endpoints: [
      {
        method: 'POST',
        path: '/api/projects',
        description: 'Create a new project'
      },
      {
        method: 'GET',
        path: '/api/projects',
        description: 'List all projects'
      },
      {
        method: 'GET',
        path: '/api/projects/:projectId',
        description: 'Get project details'
      },
      {
        method: 'POST',
        path: '/api/measurements',
        description: 'Create a measurement'
      },
      {
        method: 'GET',
        path: '/api/measurements/project/:projectId',
        description: 'Get project measurements'
      },
      {
        method: 'GET',
        path: '/api/diagnose/:projectId',
        description: 'Run diagnostics for project'
      },
      {
        method: 'POST',
        path: '/api/simulator/start/:projectId',
        description: 'Start sensor data simulation'
      },
      {
        method: 'POST',
        path: '/api/simulator/stop',
        description: 'Stop sensor data simulation'
      }
    ]
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`⚡ NaturalSignals-WireScope Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Appwrite endpoint: ${process.env.APPWRITE_ENDPOINT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Close server & exit process
  process.exit(1);
});
