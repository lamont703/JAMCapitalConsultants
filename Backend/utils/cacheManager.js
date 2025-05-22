import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache configuration
const MAX_CACHE_FILES = 100; // Maximum number of cached files to keep
const CACHE_DIR = path.join(__dirname, '../cache');

/**
 * Ensures the cache directory exists
 */
export function ensureCacheDirectory() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Cleans up old cache files if the cache exceeds the maximum size
 */
export function cleanupCache() {
  ensureCacheDirectory();
  
  try {
    // Get all cache files with their stats
    const files = fs.readdirSync(CACHE_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(CACHE_DIR, file);
        return {
          name: file,
          path: filePath,
          stats: fs.statSync(filePath)
        };
      });
    
    // If we're under the limit, no need to clean up
    if (files.length <= MAX_CACHE_FILES) {
      console.log(`Cache has ${files.length} files, under the limit of ${MAX_CACHE_FILES}`);
      return;
    }
    
    // Sort files by last modified time (oldest first)
    files.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());
    
    // Delete oldest files to get under the limit
    const filesToDelete = files.slice(0, files.length - MAX_CACHE_FILES);
    console.log(`Cleaning up cache: removing ${filesToDelete.length} old files`);
    
    for (const file of filesToDelete) {
      fs.unlinkSync(file.path);
      console.log(`Deleted old cache file: ${file.name}`);
    }
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
}

/**
 * Clears all cache files
 * @returns {number} Number of files deleted
 */
export function clearCache() {
  ensureCacheDirectory();
  
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(file => file.endsWith('.json'));
    console.log(`Clearing cache: removing ${files.length} files`);
    
    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      fs.unlinkSync(filePath);
      deletedCount++;
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
}

/**
 * Gets cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  ensureCacheDirectory();
  
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(file => file.endsWith('.json'));
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }
    
    return {
      fileCount: files.length,
      totalSize: totalSize,
      maxFiles: MAX_CACHE_FILES,
      sizeInMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    throw error;
  }
} 