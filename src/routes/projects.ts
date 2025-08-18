import { Router } from "express";
import { databases } from "../services/appwrite";
import { z } from "zod";

const router = Router();

const projectSchema = z.object({
  name: z.string(),
  location: z.string().optional()
});

const DB_ID = process.env.APPWRITE_DB_ID as string;
const PROJECTS_COLLECTION = process.env.APPWRITE_PROJECTS_COLLECTION as string;

router.post("/", async (req, res) => {
  try {
    const parsed = projectSchema.parse(req.body);
    const response = await databases.createDocument(DB_ID, PROJECTS_COLLECTION, "unique()", parsed);
    res.json(response);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const response = await databases.listDocuments(DB_ID, PROJECTS_COLLECTION);
    res.json(response.documents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
