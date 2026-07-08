import express from 'express';
import multer from 'multer';
import { parseCsvHandler, extractLeadsHandler } from '../controllers/csvController.js';

const router = express.Router();

// Configure multer to store uploaded files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // Limit file size to 10MB
  },
  fileFilter: (req, file, cb) => {
    // Accept csv and text files
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed!'), false);
    }
  }
});

// Route to parse CSV and return raw headers and rows for preview (No AI)
router.post('/parse', upload.single('file'), parseCsvHandler);

// Route to parse and extract leads via AI in batches
// Can accept either a CSV file upload OR pre-parsed raw rows in JSON body
router.post('/extract', upload.single('file'), extractLeadsHandler);

export default router;
