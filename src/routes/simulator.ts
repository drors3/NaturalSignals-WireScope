// src/routes/simulator.ts
import { Router, Request, Response } from "express";
import { DatabaseService } from "../services/appwrite";
import { asyncHandler } from "../middleware/errorHandler";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// Simulator state
let simulatorState = {
  running: false,
  projectId: null as string | null,
  interval: null as NodeJS.Timeout | null,
  config: {
    systemType: 'three-phase',
    nominalVoltage: 400,
    enableFaults: false,
    intervalMs: 3000
  }
};

// Generate realistic measurement data
function generateMeasurement(config: any) {
  const baseVoltage = config.nominalVoltage;
  const voltageVariation = (Math.random() - 0.5) * 20; // ±10V variation
  const currentBase = 20 + Math.random() * 30; // 20-50A
  const currentVariation = (Math.random() - 0.5) * 10; // ±5A variation
  
  const measurement: any = {
    projectId: simulatorState.projectId,
    temperature: 25 + Math.random() * 35, // 25-60°C
    humidity: 40 + Math.random() * 40, // 40-80%
    powerFactor: 0.7 + Math.random() * 0.25, // 0.7-0.95
    frequency: 49.8 + Math.random() * 0.4, // 49.8-50.2 Hz
    timestamp: new Date().toISOString(),
    notes: 'Simulated measurement'
  };

  // Generate phase measurements based on system type
  if (config.systemType === 'three-phase') {
    measurement.phaseA = {
      voltage: baseVoltage / Math.sqrt(3) + voltageVariation,
      current: currentBase + currentVariation,
      power: (baseVoltage / Math.sqrt(3)) * (currentBase + currentVariation) * 0.85,
      temperature: 30 + Math.random() * 30
    };
    
    measurement.phaseB = {
      voltage: baseVoltage / Math.sqrt(3) + voltageVariation + (Math.random() - 0.5) * 5,
      current: currentBase + currentVariation + (Math.random() - 0.5) * 3,
      power: (baseVoltage / Math.sqrt(3)) * (currentBase + currentVariation) * 0.85,
      temperature: 30 + Math.random() * 30
    };
    
    measurement.phaseC = {
      voltage: baseVoltage / Math.sqrt(3) + voltageVariation + (Math.random() - 0.5) * 5,
      current: currentBase + currentVariation + (Math.random() - 0.5) * 3,
      power: (baseVoltage / Math.sqrt(3)) * (currentBase + currentVariation) * 0.85,
      temperature: 30 + Math.random() * 30
    };
    
    // Calculate neutral current (should be low in balanced system)
    const imbalance = Math.random() * 5; // 0-5A imbalance
    measurement.neutral = {
      current: imbalance,
      voltage: Math.random() * 5 // Small voltage on neutral
    };
  } else if (config.systemType === 'single-phase') {
    measurement.phaseA = {
      voltage: baseVoltage + voltageVariation,
      current: currentBase + currentVariation,
      power: baseVoltage * (currentBase + currentVariation) * 0.85,
      temperature: 30 + Math.random() * 30
    };
  } else if (config.systemType === 'dc-system') {
    measurement.phaseA = {
      voltage: baseVoltage + voltageVariation,
      current: currentBase + currentVariation,
      power: baseVoltage * (currentBase + currentVariation),
      temperature: 30 + Math.random() * 30
    };
  }

  // Add ground measurement
  measurement.ground = {
    resistance: 1 + Math.random() * 4, // 1-5 ohms
    leakageCurrent: Math.random() * 30 // 0-30mA
  };

  // Occasionally add fault conditions if enabled
  if (config.enableFaults && Math.random() > 0.9) {
    // 10% chance of fault
    const faultType = Math.floor(Math.random() * 4);
    switch (faultType) {
      case 0: // High temperature
        measurement.temperature = 70 + Math.random() * 20;
        measurement.notes = 'High temperature warning';
        break;
      case 1: // Voltage sag
        if (measurement.phaseA) measurement.phaseA.voltage *= 0.8;
        measurement.notes = 'Voltage sag detected';
        break;
      case 2: // Overcurrent
        if (measurement.phaseA) measurement.phaseA.current *= 1.5;
        measurement.notes = 'Overcurrent condition';
        break;
      case 3: // Ground fault
        measurement.ground.leakageCurrent = 50 + Math.random() * 50;
        measurement.notes = 'Ground fault detected';
        break;
    }
  }

  return measurement;
}

// Start simulator
router.post(
  "/start/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const config = req.body;

    // Verify project exists
    try {
      const project = await DatabaseService.getProject(projectId);
      if (!project) {
        throw new AppError('Project not found', 404);
      }
    } catch (error) {
      throw new AppError('Project not found', 404);
    }

    // Stop existing simulator if running
    if (simulatorState.interval) {
      clearInterval(simulatorState.interval);
    }

    // Update configuration
    simulatorState.config = {
      ...simulatorState.config,
      ...config
    };
    simulatorState.projectId = projectId;
    simulatorState.running = true;

    // Start generating measurements
    const generateAndSave = async () => {
      try {
        const measurement = generateMeasurement(simulatorState.config);
        await DatabaseService.createMeasurement(measurement);
        console.log(`Generated measurement for project ${projectId}`);
      } catch (error) {
        console.error('Error generating measurement:', error);
      }
    };

    // Generate first measurement immediately
    await generateAndSave();

    // Set up interval for continuous generation
    simulatorState.interval = setInterval(
      generateAndSave, 
      simulatorState.config.intervalMs
    );

    res.json({
      success: true,
      message: 'Simulator started',
      config: simulatorState.config
    });
  })
);

// Stop simulator
router.post(
  "/stop",
 asyncHandler(async (_req: Request, res: Response) => {
    if (simulatorState.interval) {
      clearInterval(simulatorState.interval);
      simulatorState.interval = null;
    }
    
    simulatorState.running = false;
    simulatorState.projectId = null;

    res.json({
      success: true,
      message: 'Simulator stopped'
    });
  })
);

// Get simulator status
router.get(
  "/status",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      running: simulatorState.running,
      projectId: simulatorState.projectId,
      config: simulatorState.config
    });
  })
);

// Update simulator configuration
router.patch(
  "/config",
  asyncHandler(async (req: Request, res: Response) => {
    const newConfig = req.body;
    
    simulatorState.config = {
      ...simulatorState.config,
      ...newConfig
    };

    // If simulator is running, restart with new config
    if (simulatorState.running && simulatorState.projectId) {
      if (simulatorState.interval) {
        clearInterval(simulatorState.interval);
      }

      simulatorState.interval = setInterval(async () => {
        try {
          const measurement = generateMeasurement(simulatorState.config);
          await DatabaseService.createMeasurement(measurement);
        } catch (error) {
          console.error('Error generating measurement:', error);
        }
      }, simulatorState.config.intervalMs);
    }

    res.json({
      success: true,
      message: 'Configuration updated',
      config: simulatorState.config
    });
  })
);

export default router;
