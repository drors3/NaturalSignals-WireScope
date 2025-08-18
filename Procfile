const procfile = `web: npm start`;
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID as string)
  .setKey(process.env.APPWRITE_API_KEY as string);

export const databases = new Databases(client);

// Database helper functions
export class DatabaseService {
  private static DB_ID = process.env.APPWRITE_DB_ID as string;
  private static PROJECTS_COLLECTION = process.env.APPWRITE_PROJECTS_COLLECTION as string;
  private static MEASUREMENTS_COLLECTION = process.env.APPWRITE_MEASUREMENTS_COLLECTION as string;
  private static DIAGNOSES_COLLECTION = process.env.APPWRITE_DIAGNOSES_COLLECTION || 'diagnoses';

  static async createProject(data: Omit<Project, 'id'>) {
    try {
      const doc = await databases.createDocument(
        this.DB_ID,
        this.PROJECTS_COLLECTION,
        ID.unique(),
        {
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      );
      logger.info(`Project created: ${doc.$id}`);
      return doc;
    } catch (error) {
      logger.error('Error creating project:', error);
      throw error;
    }
  }

  static async getProject(projectId: string) {
    try {
      return await databases.getDocument(
        this.DB_ID,
        this.PROJECTS_COLLECTION,
        projectId
      );
    } catch (error) {
      logger.error(`Error fetching project ${projectId}:`, error);
      throw error;
    }
  }

  static async listProjects(electricianId?: string) {
    try {
      const queries = electricianId 
        ? [Query.equal('electricianId', electricianId)]
        : [];
      
      const response = await databases.listDocuments(
        this.DB_ID,
        this.PROJECTS_COLLECTION,
        queries
      );
      return response.documents;
    } catch (error) {
      logger.error('Error listing projects:', error);
      throw error;
    }
  }

  static async createMeasurement(data: Omit<Measurement, 'id'>) {
    try {
      const doc = await databases.createDocument(
        this.DB_ID,
        this.MEASUREMENTS_COLLECTION,
        ID.unique(),
        {
          ...data,
          timestamp: new Date().toISOString()
        }
      );
      logger.info(`Measurement created for project: ${data.projectId}`);
      return doc;
    } catch (error) {
      logger.error('Error creating measurement:', error);
      throw error;
    }
  }

  static async getMeasurements(projectId: string, limit = 100) {
    try {
      const response = await databases.listDocuments(
        this.DB_ID,
        this.MEASUREMENTS_COLLECTION,
        [
          Query.equal('projectId', projectId),
          Query.orderDesc('timestamp'),
          Query.limit(limit)
        ]
      );
      return response.documents;
    } catch (error) {
      logger.error(`Error fetching measurements for project ${projectId}:`, error);
      throw error;
    }
  }

  static async saveDiagnosis(diagnosis: Diagnosis) {
    try {
      const doc = await databases.createDocument(
        this.DB_ID,
        this.DIAGNOSES_COLLECTION,
        ID.unique(),
        diagnosis
      );
      logger.info(`Diagnosis saved for project: ${diagnosis.projectId}`);
      return doc;
    } catch (error) {
      logger.error('Error saving diagnosis:', error);
      throw error;
    }
  }
}
