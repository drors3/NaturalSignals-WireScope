import { DatabaseService } from './appwrite';
import { Measurement } from '../types';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

interface SimulatorConfig {
  intervalMs?: number;
  systemType?: 'single-phase' | 'three-phase' | 'dc-system';
  nominalVoltage?: number;
  maxCurrent?: number;
  enableFaults?: boolean;
  variabilityPercent?: number;
}

interface SensorData {
  voltage: number;
  current: number;
  temperature: number;
  powerFactor: number;
  frequency: number;
  groundResistance: number;
}

export class InternalSensorSimulator {
  private static running = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static faultScenario: string | null = null;
  private static config: Required<SimulatorConfig> = {
    intervalMs: 5000,
    systemType: 'three-phase',
    nominalVoltage: 400,
    maxCurrent: 100,
    enableFaults: false,
    variabilityPercent: 2
  };

  static async start(projectId: string, userConfig: SimulatorConfig = {}) {
    if (this.running) {
      logger.info('Simulator already running');
      return;
    }

    // Merge user config with defaults
    this.config = { ...this.config, ...userConfig };

    this.running = true;
    logger.info(`🚀 Starting internal simulator for project: ${projectId}`);
    logger.info(`📊 System type: ${this.config.systemType}`);
    logger.info(`⚡ Nominal voltage: ${this.config.nominalVoltage}V`);
    logger.info(`🔄 Interval: ${this.config.intervalMs}ms`);

    this.intervalId = setInterval(async () => {
      try {
        const measurement = this.generateMeasurement(projectId);
        await DatabaseService.createMeasurement(measurement);
        logger.info(`✅ Simulated measurement created for project ${projectId}`);
        
        if (this.faultScenario) {
          logger.info(`🔍 Current fault: ${this.faultScenario}`);
        }
      } catch (error) {
        logger.error('❌ Error creating simulated measurement:', error);
      }
    }, this.config.intervalMs);
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    this.faultScenario = null;
    logger.info('🛑 Simulator stopped');
  }

  static isRunning(): boolean {
    return this.running;
  }

  private static randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private static addVariability(baseValue: number, variabilityPercent: number = 2): number {
    const variation = baseValue * (variabilityPercent / 100);
    return baseValue + this.randomBetween(-variation, variation);
  }

  private static generateBaselineData(): SensorData {
    return {
      voltage: this.config.nominalVoltage,
      current: this.randomBetween(this.config.maxCurrent * 0.6, this.config.maxCurrent * 0.8),
      temperature: this.randomBetween(25, 35),
      powerFactor: this.randomBetween(0.85, 0.95),
      frequency: this.config.systemType === 'dc-system' ? 0 : 50,
      groundResistance: this.randomBetween(1, 3)
    };
  }

  private static simulateFaults(data: SensorData): SensorData {
    if (!this.config.enableFaults) return data;

    // Randomly introduce faults (5% chance per measurement)
    if (Math.random() < 0.05) {
      const faults = [
        'voltage_drop',
        'overcurrent',
        'phase_imbalance',
        'overheating',
        'ground_fault',
        'poor_power_factor'
      ];
      this.faultScenario = faults[Math.floor(Math.random() * faults.length)];
      logger.info(`🚨 Introducing fault: ${this.faultScenario}`);
    }

    // Clear fault after some time (20% chance)
    if (this.faultScenario && Math.random() < 0.2) {
      logger.info(`✅ Clearing fault: ${this.faultScenario}`);
      this.faultScenario = null;
    }

    // Apply fault effects
    switch (this.faultScenario) {
      case 'voltage_drop':
        data.voltage *= 0.85; // 15% voltage drop
        break;
      case 'overcurrent':
        data.current *= 1.3; // 30% overcurrent
        data.temperature += 15; // Higher temperature due to overcurrent
        break;
      case 'overheating':
        data.temperature += this.randomBetween(20, 40);
        break;
      case 'ground_fault':
        data.groundResistance *= 3; // High ground resistance
        break;
      case 'poor_power_factor':
        data.powerFactor *= 0.7; // Poor power factor
        break;
    }

    return data;
  }

  private static generateSinglePhaseMeasurement(projectId: string): Omit<Measurement, 'id'> {
    let data = this.generateBaselineData();
    
    // Add normal variability
    data.voltage = this.addVariability(data.voltage, this.config.variabilityPercent);
    data.current = this.addVariability(data.current, this.config.variabilityPercent);
    data.temperature = this.addVariability(data.temperature, 5);
    data.powerFactor = Math.max(0.1, Math.min(1.0, this.addVariability(data.powerFactor, 2)));
    data.frequency = this.addVariability(data.frequency, 0.5);
    data.groundResistance = this.addVariability(data.groundResistance, 10);

    // Apply faults
    data = this.simulateFaults(data);

    return {
      projectId,
      phaseA: {
        voltage: Math.round(data.voltage * 100) / 100,
        current: Math.round(data.current * 100) / 100,
        power: Math.round(data.voltage * data.current * data.powerFactor * 100) / 100,
        temperature: Math.round(data.temperature * 10) / 10
      },
      neutral: {
        current: Math.round(data.current * 0.1 * 100) / 100,
        voltage: Math.round(this.randomBetween(0, 2) * 100) / 100
      },
      ground: {
        resistance: Math.round(data.groundResistance * 100) / 100,
        leakageCurrent: Math.round(this.randomBetween(5, 15) * 100) / 100
      },
      temperature: Math.round(data.temperature * 10) / 10,
      humidity: Math.round(this.randomBetween(40, 70) * 10) / 10,
      powerFactor: Math.round(data.powerFactor * 1000) / 1000,
      frequency: Math.round(data.frequency * 100) / 100,
      notes: this.faultScenario ? `Fault detected: ${this.faultScenario}` : 'Normal operation'
    };
  }

  private static generateThreePhaseMeasurement(projectId: string): Omit<Measurement, 'id'> {
    let dataA = this.generateBaselineData();
    let dataB = this.generateBaselineData();
    let dataC = this.generateBaselineData();

    // Add phase-specific variations
    dataA.voltage = this.addVariability(dataA.voltage, this.config.variabilityPercent);
    dataB.voltage = this.addVariability(dataB.voltage, this.config.variabilityPercent);
    dataC.voltage = this.addVariability(dataC.voltage, this.config.variabilityPercent);

    dataA.current = this.addVariability(dataA.current, this.config.variabilityPercent);
    dataB.current = this.addVariability(dataB.current, this.config.variabilityPercent);
    dataC.current = this.addVariability(dataC.current, this.config.variabilityPercent);

    // Common measurements
    const temperature = this.addVariability(dataA.temperature, 5);
    const powerFactor = Math.max(0.1, Math.min(1.0, this.addVariability(dataA.powerFactor, 2)));
    const frequency = this.addVariability(dataA.frequency, 0.5);
    const groundResistance = this.addVariability(dataA.groundResistance, 10);

    // Apply faults
    if (this.faultScenario === 'phase_imbalance') {
      dataA.current *= 1.2; // 20% higher current on phase A
      dataC.current *= 0.8; // 20% lower current on phase C
    }

    // Calculate neutral current
    const neutralCurrent = Math.abs(dataA.current - dataB.current + dataC.current) / 3;

    return {
      projectId,
      phaseA: {
        voltage: Math.round(dataA.voltage * 100) / 100,
        current: Math.round(dataA.current * 100) / 100,
        power: Math.round(dataA.voltage * dataA.current * powerFactor * 100) / 100,
        temperature: Math.round(temperature * 10) / 10
      },
      phaseB: {
        voltage: Math.round(dataB.voltage * 100) / 100,
        current: Math.round(dataB.current * 100) / 100,
        power: Math.round(dataB.voltage * dataB.current * powerFactor * 100) / 100,
        temperature: Math.round((temperature + this.randomBetween(-2, 2)) * 10) / 10
      },
      phaseC: {
        voltage: Math.round(dataC.voltage * 100) / 100,
        current: Math.round(dataC.current * 100) / 100,
        power: Math.round(dataC.voltage * dataC.current * powerFactor * 100) / 100,
        temperature: Math.round((temperature + this.randomBetween(-2, 2)) * 10) / 10
      },
      neutral: {
        current: Math.round(neutralCurrent * 100) / 100,
        voltage: Math.round(this.randomBetween(0, 5) * 100) / 100
      },
      ground: {
        resistance: Math.round(groundResistance * 100) / 100,
        leakageCurrent: Math.round(this.randomBetween(5, 20) * 100) / 100
      },
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(this.randomBetween(40, 70) * 10) / 10,
      powerFactor: Math.round(powerFactor * 1000) / 1000,
      frequency: Math.round(frequency * 100) / 100,
      notes: this.faultScenario ? `Fault detected: ${this.faultScenario}` : 'Normal three-phase operation'
    };
  }

  private static generateDCMeasurement(projectId: string): Omit<Measurement, 'id'> {
    let data = this.generateBaselineData();
    
    // DC specific adjustments
    data.voltage = this.addVariability(data.voltage, this.config.variabilityPercent);
    data.current = this.addVariability(data.current, this.config.variabilityPercent);
    data.temperature = this.addVariability(data.temperature, 5);
    data.groundResistance = this.addVariability(data.groundResistance, 10);

    // Apply faults
    data = this.simulateFaults(data);

    return {
      projectId,
      phaseA: { // Use phaseA for positive DC
        voltage: Math.round(data.voltage * 100) / 100,
        current: Math.round(data.current * 100) / 100,
        power: Math.round(data.voltage * data.current * 100) / 100,
        temperature: Math.round(data.temperature * 10) / 10
      },
      ground: {
        resistance: Math.round(data.groundResistance * 100) / 100,
        leakageCurrent: Math.round(this.randomBetween(1, 10) * 100) / 100
      },
      temperature: Math.round(data.temperature * 10) / 10,
      humidity: Math.round(this.randomBetween(40, 70) * 10) / 10,
      frequency: 0, // DC has no frequency
      notes: this.faultScenario ? `Fault detected: ${this.faultScenario}` : 'Normal DC operation'
    };
  }

  private static generateMeasurement(projectId: string): Omit<Measurement, 'id'> {
    switch (this.config.systemType) {
      case 'single-phase':
        return this.generateSinglePhaseMeasurement(projectId);
      case 'three-phase':
        return this.generateThreePhaseMeasurement(projectId);
      case 'dc-system':
        return this.generateDCMeasurement(projectId);
      default:
        throw new Error(`Unsupported system type: ${this.config.systemType}`);
    }
  }
}
