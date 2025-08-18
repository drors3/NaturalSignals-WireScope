import { Measurement, Project, Diagnosis, Issue, Recommendation } from "../types";
import { ElectricalCalculations } from "../utils/calculations";

export class DiagnosticsEngine {
  private static readonly VOLTAGE_TOLERANCE = 0.1; // ±10%
  private static readonly PHASE_IMBALANCE_LIMIT = 2; // 2%
  private static readonly NEUTRAL_CURRENT_LIMIT = 10; // 10A for typical systems
  private static readonly TEMP_WARNING = 60; // 60°C
  private static readonly TEMP_CRITICAL = 80; // 80°C
  private static readonly GROUND_RESISTANCE_LIMIT = 5; // 5 ohms

  static async runDiagnostics(
    project: Project,
    measurements: Measurement[]
  ): Promise<Diagnosis> {
    const issues: Issue[] = [];
    const recommendations: Recommendation[] = [];
    let maxSeverity: 'critical' | 'warning' | 'info' = 'info';

    if (measurements.length === 0) {
      return {
        projectId: project.id!,
        timestamp: new Date().toISOString(),
        issues: [{
          code: 'NO_DATA',
          description: 'No measurements available for analysis',
          severity: 'info',
          affectedComponent: 'System',
          possibleCauses: ['No measurements have been recorded']
        }],
        recommendations: [{
          priority: 1,
          action: 'Take initial measurements of the system',
          estimatedTime: '15 minutes',
          toolsRequired: ['Multimeter', 'Clamp meter'],
          safetyPrecautions: ['Ensure proper PPE', 'Follow lockout/tagout procedures']
        }],
        severity: 'info'
      };
    }

    const latestMeasurement = measurements[0];

    // Check voltage levels
    this.checkVoltageIssues(project, latestMeasurement, issues, recommendations);

    // Check current issues
    this.checkCurrentIssues(latestMeasurement, issues, recommendations);

    // Check phase imbalance (for three-phase systems)
    if (project.systemType === 'three-phase') {
      this.checkPhaseImbalance(latestMeasurement, issues, recommendations);
    }

    // Check temperature
    this.checkTemperatureIssues(latestMeasurement, issues, recommendations);

    // Check grounding
    this.checkGroundingIssues(latestMeasurement, issues, recommendations);

    // Check power quality
    this.checkPowerQuality(latestMeasurement, issues, recommendations);

    // Check trends over time
    if (measurements.length > 5) {
      this.analyzeTrends(measurements, issues, recommendations);
    }

    // Determine overall severity
    if (issues.some(i => i.severity === 'critical')) {
      maxSeverity = 'critical';
    } else if (issues.some(i => i.severity === 'warning')) {
      maxSeverity = 'warning';
    }

    // Sort recommendations by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    // Generate safety alert if critical
    let safetyAlert: string | undefined;
    if (maxSeverity === 'critical') {
      safetyAlert = '⚠️ CRITICAL SAFETY ISSUE DETECTED: Immediate action required. Ensure area is safe and consider disconnecting power if necessary.';
    }

    return {
      projectId: project.id!,
      timestamp: new Date().toISOString(),
      issues,
      recommendations,
      severity: maxSeverity,
      safetyAlert
    };
  }

  private static checkVoltageIssues(
    project: Project,
    measurement: Measurement,
    issues: Issue[],
    recommendations: Recommendation[]
  ) {
    const nominalVoltage = project.voltageRating;
    const tolerance = nominalVoltage * this.VOLTAGE_TOLERANCE;

    // Check each phase
    if (measurement.phaseA) {
      const voltageDrop = ElectricalCalculations.calculateVoltageDrop(
        nominalVoltage,
        measurement.phaseA.voltage
      );

      if (Math.abs(voltageDrop) > 10) {
        issues.push({
          code: 'VOLTAGE_OUT_OF_RANGE_A',
          description: `Phase A voltage ${measurement.phaseA.voltage}V is ${voltageDrop.toFixed(1)}% from nominal ${nominalVoltage}V`,
          severity: Math.abs(voltageDrop) > 15 ? 'critical' : 'warning',
          affectedComponent: 'Phase A',
          possibleCauses: [
            'Loose connection at main panel',
            'Undersized conductors',
            'Utility supply issue',
            'Excessive load on circuit',
            'Faulty transformer tap setting'
          ]
        });

        recommendations.push({
          priority: Math.abs(voltageDrop) > 15 ? 1 : 2,
          action: 'Investigate voltage issue on Phase A',
          estimatedTime: '30-60 minutes',
          toolsRequired: ['Digital multimeter', 'Infrared camera'],
          safetyPrecautions: [
            'Work on de-energized circuits when possible',
            'Use appropriate PPE',
            'Test before touch'
          ]
        });
      }
    }

    // Similar checks for Phase B and C
    if (measurement.phaseB) {
      const voltageDrop = ElectricalCalculations.calculateVoltageDrop(
        nominalVoltage,
        measurement.phaseB.voltage
      );

      if (Math.abs(voltageDrop) > 10) {
        issues.push({
          code: 'VOLTAGE_OUT_OF_RANGE_B',
          description: `Phase B voltage ${measurement.phaseB.voltage}V is ${voltageDrop.toFixed(1)}% from nominal`,
          severity: Math.abs(voltageDrop) > 15 ? 'critical' : 'warning',
          affectedComponent: 'Phase B',
          possibleCauses: ['Similar to Phase A issues']
        });
      }
    }

    if (measurement.phaseC) {
      const voltageDrop = ElectricalCalculations.calculateVoltageDrop(
        nominalVoltage,
        measurement.phaseC.voltage
      );

      if (Math.abs(voltageDrop) > 10) {
        issues.push({
          code: 'VOLTAGE_OUT_OF_RANGE_C',
          description: `Phase C voltage ${measurement.phaseC.voltage}V is ${voltageDrop.toFixed(1)}% from nominal`,
          severity: Math.abs(voltageDrop) > 15 ? 'critical' : 'warning',
          affectedComponent: 'Phase C',
          possibleCauses: ['Similar to Phase A issues']
        });
      }
    }
  }

  private static checkCurrentIssues(
    measurement: Measurement,
    issues: Issue[],
    recommendations: Recommendation[]
  ) {
    // Check for overcurrent conditions
    const checkPhaseOvercurrent = (
      phase: PhaseMeasurement | undefined,
      phaseName: string,
      maxCurrent: number = 100 // Default max current, should come from project specs
    ) => {
      if (!phase) return;

      if (phase.current > maxCurrent) {
        issues.push({
          code: `OVERCURRENT_${phaseName}`,
          description: `${phaseName} current ${phase.current}A exceeds safe operating limit`,
          severity: phase.current > maxCurrent * 1.25 ? 'critical' : 'warning',
          affectedComponent: phaseName,
          possibleCauses: [
            'Circuit overload',
            'Short circuit condition',
            'Ground fault',
            'Motor starting current',
            'Harmonic distortion'
          ]
        });

        recommendations.push({
          priority: phase.current > maxCurrent * 1.25 ? 1 : 2,
          action: `Reduce load on ${phaseName} or investigate fault condition`,
          estimatedTime: '1-2 hours',
          toolsRequired: ['Clamp meter', 'Power quality analyzer'],
          safetyPrecautions: [
            'Circuit may trip unexpectedly',
            'Check breaker ratings',
            'Monitor temperature of conductors'
          ]
        });
      }
    };

    checkPhaseOvercurrent(measurement.phaseA, 'Phase A');
    checkPhaseOvercurrent(measurement.phaseB, 'Phase B');
    checkPhaseOvercurrent(measurement.phaseC, 'Phase C');

    // Check neutral current
    if (measurement.neutral && measurement.neutral.current > this.NEUTRAL_CURRENT_LIMIT) {
      issues.push({
        code: 'HIGH_NEUTRAL_CURRENT',
        description: `Neutral current ${measurement.neutral.current}A indicates unbalanced load`,
        severity: measurement.neutral.current > 20 ? 'warning' : 'info',
        affectedComponent: 'Neutral conductor',
        possibleCauses: [
          'Unbalanced phase loads',
          'Harmonics (especially 3rd harmonic)',
          'Loose neutral connection',
          'Single-phase loads on three-phase system'
        ]
      });

      recommendations.push({
        priority: 3,
        action: 'Balance loads across phases',
        estimatedTime: '1-3 hours',
        toolsRequired: ['Clamp meter', 'Load schedule'],
        safetyPrecautions: ['Monitor neutral conductor temperature']
      });
    }
  }

  private static checkPhaseImbalance(
    measurement: Measurement,
    issues: Issue[],
    recommendations: Recommendation[]
  ) {
    if (!measurement.phaseA || !measurement.phaseB || !measurement.phaseC) {
      return;
    }

    // Check voltage imbalance
    const voltageImbalance = ElectricalCalculations.calculatePhaseImbalance(
      measurement.phaseA.voltage,
      measurement.phaseB.voltage,
      measurement.phaseC.voltage
    );

    if (voltageImbalance > this.PHASE_IMBALANCE_LIMIT) {
      issues.push({
        code: 'VOLTAGE_IMBALANCE',
        description: `Voltage imbalance of ${voltageImbalance.toFixed(1)}% exceeds recommended limit`,
        severity: voltageImbalance > 5 ? 'warning' : 'info',
        affectedComponent: 'Three-phase system',
        possibleCauses: [
          'Unequal loading of phases',
          'Loose connection on one phase',
          'Utility supply imbalance',
          'Failed capacitor in power factor correction',
          'Single-phasing condition developing'
        ]
      });

      recommendations.push({
        priority: voltageImbalance > 5 ? 2 : 4,
        action: 'Investigate and correct phase imbalance',
        estimatedTime: '2-4 hours',
        toolsRequired: ['Three-phase power analyzer', 'Infrared camera'],
        safetyPrecautions: ['Check motor temperatures', 'Monitor for unusual vibration']
      });
    }

    // Check current imbalance
    const currentImbalance = ElectricalCalculations.calculatePhaseImbalance(
      measurement.phaseA.current,
      measurement.phaseB.current,
      measurement.phaseC.current
    );

    if (currentImbalance > 10) {
      issues.push({
        code: 'CURRENT_IMBALANCE',
        description: `Current imbalance of ${currentImbalance.toFixed(1)}% indicates uneven loading`,
        severity: currentImbalance > 25 ? 'warning' : 'info',
        affectedComponent: 'Load distribution',
        possibleCauses: [
          'Unbalanced single-phase loads',
          'Failed motor winding',
          'Loose connection causing high resistance'
        ]
      });
    }
  }

  private static checkTemperatureIssues(
    measurement: Measurement,
    issues: Issue[],
    recommendations: Recommendation[]
  ) {
    const checkComponentTemp = (temp: number | undefined, component: string) => {
      if (!temp) return;

      if (temp > this.TEMP_CRITICAL) {
        issues.push({
          code: 'CRITICAL_TEMPERATURE',
          description: `${component} temperature ${temp}°C exceeds critical limit`,
          severity: 'critical',
          affectedComponent: component,
          possibleCauses: [
            'Severe overload condition',
            'Loose connection causing resistance heating',
            'Inadequate ventilation',
            'Undersized conductor',
            'Ambient temperature too high'
          ]
        });

        recommendations.push({
          priority: 1,
          action: `IMMEDIATE ACTION: Reduce load or disconnect ${component}`,
          estimatedTime: 'Immediate',
          toolsRequired: ['Infrared camera', 'Temperature probe'],
          safetyPrecautions: [
            'Risk of fire',
            'Allow cooling before handling',
            'Check insulation integrity'
          ]
        });
      } else if (temp > this.TEMP_WARNING) {
        issues.push({
          code: 'HIGH_TEMPERATURE',
          description: `${component} temperature ${temp}°C approaching limit`,
          severity: 'warning',
          affectedComponent: component,
          possibleCauses: [
            'Overload condition',
            'Poor connection',
            'Insufficient cable size'
          ]
        });
      }
    };

    // Check main temperature
    checkComponentTemp(measurement.temperature, 'System');

    // Check phase temperatures
    if (measurement.phaseA?.temperature) {
      checkComponentTemp(measurement.phaseA.temperature, 'Phase A');
    }
    if (measurement.phaseB?.temperature) {
      checkComponentTemp(measurement.phaseB.temperature, 'Phase B');
    }
    if (measurement.phaseC?.temperature) {
      checkComponentTemp(measurement.phaseC.temperature, 'Phase C');
    }
  }

  private static checkGroundingIssues(
    measurement: Measurement,
    issues: Issue[],
    recommendations: Recommendation[]
  ) {
    if (!measurement.ground) return;

    if (measurement.ground.resistance > this.GROUND_RESISTANCE_LIMIT) {
      issues.push({
        code: 'HIGH_GROUND_RESISTANCE',
        description: `Ground resistance ${measurement.ground.resistance}Ω exceeds safe limit of ${this.GROUND_RESISTANCE_LIMIT}Ω`,
        severity: measurement.ground.resistance > 25 ? 'critical' : 'warning',
        affectedComponent: 'Grounding system',
        possibleCauses: [
          'Corroded ground rod',
          'Dry soil conditions',
          'Inadequate ground rod depth',
          'Broken ground conductor',
          'Poor connection at ground bus'
        ]
      });

      recommendations.push({
        priority: measurement.ground.resistance > 25 ? 1 : 2,
        action: 'Improve grounding system resistance',
        estimatedTime: '2-4 hours',
        toolsRequired: ['Ground resistance tester', 'Ground rod driver'],
        safetyPrecautions: [
          'System vulnerable to voltage surges',
          'Risk of electric shock',
          'Test with circuit de-energized'
        ]
      });
    }

    if (measurement.ground.leakageCurrent && measurement.ground.leakageCurrent > 30) {
      issues.push({
        code: 'GROUND_FAULT',
        description: `Ground leakage current ${measurement.ground.leakageCurrent}mA detected`,
        severity: measurement.ground.leakageCurrent > 100 ? 'critical' : 'warning',
        affectedComponent: 'Insulation system',
        possibleCauses: [
          'Deteriorated insulation',
          'Moisture ingress',
          'Damaged equipment',
          'Capacitive coupling'
        ]
      });

      recommendations.push({
        priority: 1,
        action: 'Locate and repair ground fault',
        estimatedTime: '2-6 hours',
        toolsRequired: ['Insulation tester', 'Ground fault locator'],
        safetyPrecautions: ['Risk of electric shock', 'Use GFCI protection']
      });
    }
  }

  private static checkPowerQuality(
    measurement: Measurement,
    issues: Issue[],
    recommendations: Recommendation[]
  ) {
    // Check power factor
    if (measurement.powerFactor !== undefined && measurement.powerFactor < 0.85) {
      issues.push({
        code: 'LOW_POWER_FACTOR',
        description: `Power factor ${measurement.powerFactor.toFixed(2)} is below optimal range`,
        severity: measurement.powerFactor < 0.7 ? 'warning' : 'info',
        affectedComponent: 'Power system efficiency',
        possibleCauses: [
          'Inductive loads (motors, transformers)',
          'Under-loaded motors',
          'Lack of power factor correction',
          'Harmonics'
        ]
      });

      recommendations.push({
        priority: 3,
        action: 'Consider power factor correction',
        estimatedTime: '1 day',
        toolsRequired: ['Power quality analyzer', 'Capacitor bank sizing calculator'],
        safetyPrecautions: ['Capacitors store energy', 'Discharge before handling']
      });
    }

    // Check frequency
    if (measurement.frequency !== undefined) {
      const freqDeviation = Math.abs(measurement.frequency - 50); // Assuming 50Hz system
      if (freqDeviation > 0.5) {
        issues.push({
          code: 'FREQUENCY_DEVIATION',
          description: `Frequency ${measurement.frequency}Hz deviates from nominal`,
          severity: freqDeviation > 2 ? 'critical' : 'warning',
          affectedComponent: 'Supply frequency',
          possibleCauses: [
            'Generator governor issues',
            'Grid instability',
            'Local generation problems'
          ]
        });
      }
    }
  }

  private static analyzeTrends(
    measurements: Measurement[],
    issues: Issue[],
    recommendations: Recommendation[]
  ) {
    // Analyze temperature trends
    const temps = measurements
      .filter(m => m.temperature !== undefined)
      .map(m => m.temperature!);

    if (temps.length > 3) {
      const tempIncrease = temps[0] - temps[temps.length - 1];
      if (tempIncrease > 10) {
        issues.push({
          code: 'TEMPERATURE_TREND',
          description: `Temperature has increased by ${tempIncrease.toFixed(1)}°C over recent measurements`,
          severity: 'warning',
          affectedComponent: 'System temperature',
          possibleCauses: [
            'Developing connection problem',
            'Increasing load',
            'Deteriorating insulation'
          ]
        });

        recommendations.push({
          priority: 2,
          action: 'Monitor temperature trend closely',
          estimatedTime: 'Ongoing',
          toolsRequired: ['Temperature logger', 'Trend analysis software'],
          safetyPrecautions: ['Set up temperature alarms']
        });
      }
    }

    // Analyze current trends
    if (measurements[0].phaseA) {
      const currents = measurements
        .filter(m => m.phaseA?.current !== undefined)
        .map(m => m.phaseA!.current);

      if (currents.length > 3) {
        const currentIncrease = currents[0] - currents[currents.length - 1];
        const percentIncrease = (currentIncrease / currents[currents.length - 1]) * 100;

        if (percentIncrease > 20) {
          issues.push({
            code: 'CURRENT_TREND',
            description: `Current draw has increased by ${percentIncrease.toFixed(1)}% over time`,
            severity: 'info',
            affectedComponent: 'Load current',
            possibleCauses: [
              'Additional loads added',
              'Motor bearing wear',
              'Deteriorating equipment efficiency'
            ]
          });
        }
      }
    }
  }
}
