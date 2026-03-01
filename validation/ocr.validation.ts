import { z } from "zod";

export const ocrRequestSchema = z.object({
  file_url: z.url("File URL must be a valid URL"),
  filename: z.string().optional(),
  teamId: z.number().optional(),
});

export const batchOcrRequestSchema = z.object({
  files: z.array(z.object({
    url: z.url("File URL must be a valid URL"),
    name: z.string().min(1, "Filename is required"),
  })).min(1, "At least one file is required").max(10, "Maximum 10 files allowed"),
  teamId: z.number().optional().nullable(),
});