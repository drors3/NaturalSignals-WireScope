#!/usr/bin/env node

import axios from 'axios';
import { Project, Measurement } from './types'; // Import your existing types

interface SimulatorConfig {
  apiBaseUrl: string;
  projectId: string;
  intervalMs: number;
  systemType: 'single-phase' | 'three-phase' | 'dc-system';
  nominalVoltage: number;
  maxCurrent: number;
  enableFaults: boolean;
  variabilityPercent: number;
}

interface SensorData {
  voltage: number;
  current: number;
  temperature: number;
  powerFactor: number;
  frequency: number;
  groundResistance: number;
}

class ElectricalSensorSimulator {
  private config: SimulatorConfig;
  private running = false;
  private faultScenario: string | null = null;
  private baselineData: SensorData;

  constructor(config: SimulatorConfig) {
    this.config = config;
    this.baselineData = this.generateBaselineData();
  }

  private generateBaselineData(): SensorData {
    return {
      voltage: this.config.nominalVoltage,
      current: this.randomBetween(this.config.maxCurrent * 0.6, this.config.maxCurrent * 0.8),
      temperature: this.randomBetween(25, 35),
      powerFactor: this.randomBetween(0.85, 0.95),
      frequency: this.config.systemType === 'dc-system' ? 0 : 50,
      groundResistance: this.randomBetween(1, 3)
    };
  }

  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private addVariability(baseValue: number, variabilityPercent: number = 2): number {
    const variation = baseValue * (variabilityPercent / 100);
    return baseValue + this.randomBetween(-variation, variation);
  }

  private simulateFaults(data: SensorData): SensorData {
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
      console.log(`🚨 Introducing fault: ${this.faultScenario}`);
    }

    // Clear fault after some time (20% chance)
    if (this.faultScenario && Math.random() < 0.2) {
      console.log(`✅ Clearing fault: ${this.faultScenario}`);
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

  private generateSinglePhaseMeasurement(): Measurement {
    let data = { ...this.baselineData };
    
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
      projectId: this.config.projectId,
      phaseA: {
        voltage: Math.round(data.voltage * 100) / 100,
        current: Math.round(data.current * 100) / 100,
        power: Math.round(data.voltage * data.current * data.powerFactor * 100) / 100,
        temperature: Math.round(data.temperature * 10) / 10
      },
      neutral: {
        current: Math.round(data.current * 0.1 * 100) / 100, // Small neutral current
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

  private generateThreePhaseMeasurement(): Measurement {
    let dataA = { ...this.baselineData };
    let dataB = { ...this.baselineData };
    let dataC = { ...this.baselineData };

    // Add phase-specific variations
    dataA.voltage = this.addVariability(dataA.voltage, this.config.variabilityPercent);
    dataB.voltage = this.addVariability(dataB.voltage, this.config.variabilityPercent);
    dataC.voltage = this.addVariability(dataC.voltage, this.config.variabilityPercent);

    dataA.current = this.addVariability(dataA.current, this.config.variabilityPercent);
    dataB.current = this.addVariability(dataB.current, this.config.variabilityPercent);
    dataC.current = this.addVariability(dataC.current, this.config.variabilityPercent);

    // Common measurements
    const temperature = this.addVariability(this.baselineData.temperature, 5);
    const powerFactor = Math.max(0.1, Math.min(1.0, this.addVariability(this.baselineData.powerFactor, 2)));
    const frequency = this.addVariability(this.baselineData.frequency, 0.5);
    const groundResistance = this.addVariability(this.baselineData.groundResistance, 10);

    // Apply faults
    if (this.faultScenario === 'phase_imbalance') {
      dataA.current *= 1.2; // 20% higher current on phase A
      dataC.current *= 0.8; // 20% lower current on phase C
    }

    // Calculate neutral current (sum of phase currents in unbalanced system)
    const neutralCurrent = Math.abs(dataA.current - dataB.current + dataC.current) / 3;

    return {
      projectId: this.config.projectId,
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
      notes: this.faultScenario ? `Fault detected: ${this.faultScenario}` : 'Normal operation'
    };
  }

  private generateDCMeasurement(): Measurement {
    let data = { ...this.baselineData };
    
    // DC specific adjustments
    data.voltage = this.addVariability(data.voltage, this.config.variabilityPercent);
    data.current = this.addVariability(data.current, this.config.variabilityPercent);
    data.temperature = this.addVariability(data.temperature, 5);
    data.groundResistance = this.addVariability(data.groundResistance, 10);

    // Apply faults
    data = this.simulateFaults(data);

    return {
      projectId: this.config.projectId,
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

  private generateMeasurement(): Measurement {
    switch (this.config.systemType) {
      case 'single-phase':
        return this.generateSinglePhaseMeasurement();
      case 'three-phase':
        return this.generateThreePhaseMeasurement();
      case 'dc-system':
        return this.generateDCMeasurement();
      default:
        throw new Error(`Unsupported system type: ${this.config.systemType}`);
    }
  }

  private async sendMeasurement(measurement: Measurement): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.config.apiBaseUrl}/api/measurements`,
        measurement,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      if (response.status === 201) {
        console.log(`✅ Measurement sent successfully at ${new Date().toISOString()}`);
        return true;
      } else {
        console.error(`❌ Unexpected response status: ${response.status}`);
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`❌ API Error: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
      } else {
        console.error(`❌ Network Error: ${error}`);
      }
      return false;
    }
  }

  public async start(): Promise<void> {
    if (this.running) {
      console.log('⚠️  Simulator is already running');
      return;
    }

    this.running = true;
    console.log(`🚀 Starting sensor simulator for project: ${this.config.projectId}`);
    console.log(`📊 System type: ${this.config.systemType}`);
    console.log(`⚡ Nominal voltage: ${this.config.nominalVoltage}V`);
    console.log(`🔄 Interval: ${this.config.intervalMs}ms`);
    console.log(`🔧 Faults enabled: ${this.config.enableFaults}`);
    console.log('---');

    while (this.running) {
      const measurement = this.generateMeasurement();
      const success = await this.sendMeasurement(measurement);
      
      if (success && this.faultScenario) {
        console.log(`🔍 Current fault: ${this.faultScenario}`);
      }

      await new Promise(resolve => setTimeout(resolve, this.config.intervalMs));
    }
  }

  public stop(): void {
    this.running = false;
    console.log('🛑 Sensor simulator stopped');
  }
}

// Configuration
const config: SimulatorConfig = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8080',
  projectId: process.env.PROJECT_ID || 'test-project-1',
  intervalMs: parseInt(process.env.INTERVAL_MS || '5000'), // 5 seconds
  systemType: (process.env.SYSTEM_TYPE as any) || 'three-phase',
  nominalVoltage: parseInt(process.env.NOMINAL_VOLTAGE || '400'),
  maxCurrent: parseInt(process.env.MAX_CURRENT || '100'),
  enableFaults: process.env.ENABLE_FAULTS === 'true',
  variabilityPercent: parseInt(process.env.VARIABILITY_PERCENT || '2')
};

// Main execution
async function main() {
  console.log('🏭 Hardware Sensor Simulator for NaturalSignals-WireScope');
  console.log('===================================================');

  // Validate project exists
  try {
    const response = await axios.get(`${config.apiBaseUrl}/api/projects/${config.projectId}`);
    console.log(`✅ Project found: ${response.data.data.name}`);
  } catch (error) {
    console.error(`❌ Project ${config.projectId} not found. Please create it first.`);
    console.log('💡 You can create a project using:');
    console.log(`curl -X POST ${config.apiBaseUrl}/api/projects -H "Content-Type: application/json" -d '{
  "name": "Test Project",
  "systemType": "${config.systemType}",
  "voltageRating": ${config.nominalVoltage},
  "status": "active"
}'`);
    process.exit(1);
  }

  const simulator = new ElectricalSensorSimulator(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🔄 Received SIGINT, shutting down gracefully...');
    simulator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
    simulator.stop();
    process.exit(0);
  });

  // Start simulation
  await simulator.start();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { ElectricalSensorSimulator, SimulatorConfig };
