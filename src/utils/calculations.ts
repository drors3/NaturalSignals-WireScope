export class ElectricalCalculations {
  // Calculate power factor
  static calculatePowerFactor(realPower: number, apparentPower: number): number {
    if (apparentPower === 0) return 0;
    return Math.abs(realPower / apparentPower);
  }

  // Calculate phase imbalance percentage
  static calculatePhaseImbalance(phaseA: number, phaseB: number, phaseC: number): number {
    const avg = (phaseA + phaseB + phaseC) / 3;
    if (avg === 0) return 0;
    
    const maxDeviation = Math.max(
      Math.abs(phaseA - avg),
      Math.abs(phaseB - avg),
      Math.abs(phaseC - avg)
    );
    
    return (maxDeviation / avg) * 100;
  }

  // Calculate voltage drop percentage
  static calculateVoltageDrop(nominalVoltage: number, actualVoltage: number): number {
    if (nominalVoltage === 0) return 0;
    return ((nominalVoltage - actualVoltage) / nominalVoltage) * 100;
  }

  // Calculate apparent power
  static calculateApparentPower(voltage: number, current: number): number {
    return voltage * current;
  }

  // Calculate real power
  static calculateRealPower(voltage: number, current: number, powerFactor: number): number {
    return voltage * current * powerFactor;
  }

  // Temperature derating factor for cables
  static getTemperatureDeratingFactor(ambientTemp: number): number {
    // Based on standard cable derating tables
    if (ambientTemp <= 30) return 1.0;
    if (ambientTemp <= 35) return 0.94;
    if (ambientTemp <= 40) return 0.87;
    if (ambientTemp <= 45) return 0.79;
    if (ambientTemp <= 50) return 0.71;
    return 0.61; // >50°C
  }
}
