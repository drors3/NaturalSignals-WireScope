export interface Project {
  id?: string;
  name: string;
  location?: string;
  clientName?: string;
  electricianId?: string;
  status: 'active' | 'completed' | 'pending';
  systemType: 'single-phase' | 'three-phase' | 'dc-system';
  voltageRating: number; // Expected voltage (e.g., 230, 400)
  createdAt?: string;
  updatedAt?: string;
}

export interface Measurement {
  id?: string;
  projectId: string;
  phaseA?: PhaseMeasurement;
  phaseB?: PhaseMeasurement;
  phaseC?: PhaseMeasurement;
  neutral?: NeutralMeasurement;
  ground?: GroundMeasurement;
  temperature?: number;
  humidity?: number;
  powerFactor?: number;
  frequency?: number;
  timestamp?: string;
  notes?: string;
}

export interface PhaseMeasurement {
  voltage: number;
  current: number;
  power?: number;
  temperature?: number;
}

export interface NeutralMeasurement {
  current: number;
  voltage?: number;
}

export interface GroundMeasurement {
  resistance: number;
  leakageCurrent?: number;
}

export interface Diagnosis {
  projectId: string;
  timestamp: string;
  issues: Issue[];
  recommendations: Recommendation[];
  severity: 'critical' | 'warning' | 'info';
  safetyAlert?: string;
}

export interface Issue {
  code: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  affectedComponent: string;
  possibleCauses: string[];
}

export interface Recommendation {
  priority: number;
  action: string;
  estimatedTime?: string;
  toolsRequired?: string[];
  safetyPrecautions?: string[];
