import { Router } from "express";
import { databases } from "../services/appwrite";
import { z } from "zod";

const router = Router();

const measurementSchema = z.object({
  projectId: z.string(),
  voltage: z.number(),
  current: z.number(),
  temperature: z.number().optional()
});

const DB_ID = process.env.APPWRITE_DB_ID as string;
const MEASUREMENTS_COLLECTION = process.env.APPWRITE_MEASUREMENTS_COLLECTION as string;

router.post("/", async (req, res) => {
  try {
    const parsed = measurementSchema.parse(req.body);
    const response = await databases.createDocument(DB_ID, MEASUREMENTS_COLLECTION, "unique()", parsed);
    res.json(response);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const response = await databases.listDocuments(DB_ID, MEASUREMENTS_COLLECTION, [
      {
        key: "projectId",
        value: projectId,
        operator: "equal"
      }
    ] as any);
    res.json(response.documents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
