import { supabase } from '../supabase';
import { Platform } from 'react-native';

const BUCKET_NAME = 'visit-photos';

/**
 * Ensures the storage bucket exists. Creates it if missing.
 * Silently ignores errors (bucket may already exist or Storage may not be enabled).
 */
export async function ensurePhotoBucket(): Promise<boolean> {
  try {
    // Check if bucket exists first
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (exists) return true;

    // Try to create it
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB per photo
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    if (error) {
      console.warn('[Photos] Bucket creation failed:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[Photos] ensurePhotoBucket error:', e);
    return false;
  }
}

/**
 * Upload a single photo to Supabase Storage.
 * Returns the public URL or null on failure.
 */
export async function uploadSinglePhoto(
  uri: string,
  storagePath: string
): Promise<string | null> {
  try {
    let uploadData: Blob | ArrayBuffer;

    if (Platform.OS === 'web') {
      // Web: fetch returns usable blob
      const response = await fetch(uri);
      uploadData = await response.blob();
    } else {
      // Mobile: fetch local file:// URI
      const response = await fetch(uri);
      uploadData = await response.blob();
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, uploadData, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('[Photos] Upload error for', storagePath, ':', error.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (e) {
    console.warn('[Photos] Upload exception for', storagePath, ':', e);
    return null;
  }
}

/**
 * Upload multiple visit photos to Supabase Storage.
 * Photos are stored in: {userId}/{customerId}/{timestamp}_{index}.jpg
 * Returns array of public URLs (only successful uploads).
 */
export async function uploadVisitPhotos(
  photos: { uri: string }[],
  userId: string,
  customerId: string
): Promise<string[]> {
  if (photos.length === 0) return [];

  // Ensure bucket exists
  await ensurePhotoBucket();

  const timestamp = Date.now();
  const urls: string[] = [];

  for (let i = 0; i < photos.length; i++) {
    const path = `${userId}/${customerId}/${timestamp}_${i}.jpg`;
    const url = await uploadSinglePhoto(photos[i].uri, path);
    if (url) {
      urls.push(url);
    }
  }

  console.log(`[Photos] Uploaded ${urls.length}/${photos.length} photos successfully`);
  return urls;
}
