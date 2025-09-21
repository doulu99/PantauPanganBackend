// middleware/upload.js - Image Upload Middleware
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const createUploadsDir = () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const marketPricesDir = path.join(uploadsDir, 'market-prices');
  if (!fs.existsSync(marketPricesDir)) {
    fs.mkdirSync(marketPricesDir, { recursive: true });
  }
};

createUploadsDir();

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/market-prices');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: marketprice_timestamp_originalname
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, '_');
    const filename = `marketprice_${timestamp}_${originalName}`;
    cb(null, filename);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  }
});

// Middleware for single image upload
const uploadSingle = upload.single('image');

// Middleware for multiple images upload
const uploadMultiple = upload.array('images', 5);

// Error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum 5MB allowed.',
        error: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 images allowed.',
        error: 'TOO_MANY_FILES'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name for file upload.',
        error: 'UNEXPECTED_FIELD'
      });
    }
  }
  
  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files (PNG, JPG, JPEG, GIF, WebP) are allowed.',
      error: 'INVALID_FILE_TYPE'
    });
  }
  
  next(err);
};

// Helper function to get image URL
const getImageUrl = (req, filename) => {
  if (!filename) return null;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/market-prices/${filename}`;
};

// Helper function to delete image file
const deleteImage = (filename) => {
  if (!filename) return;
  const filePath = path.join(__dirname, '../uploads/market-prices', filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑️ Deleted image: ${filename}`);
  }
};

// Helper function to extract filename from URL
const getFilenameFromUrl = (imageUrl) => {
  if (!imageUrl) return null;
  return path.basename(imageUrl);
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  getImageUrl,
  deleteImage,
  getFilenameFromUrl
};