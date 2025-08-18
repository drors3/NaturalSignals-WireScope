export interface Project {
  id?: string;
  name: string;
  location?: string;
  createdAt?: string;
}

export interface Measurement {
  id?: string;
  projectId: string;
  voltage: number;
  current: number;
  temperature?: number;
  createdAt?: string;
}
