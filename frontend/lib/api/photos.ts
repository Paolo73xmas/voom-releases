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
 * Upload multiple photos to Supabase Storage.
 * Photos are stored in: {userId}/{entityId}/{timestamp}_{index}.jpg
 * Returns array of public URLs (only successful uploads).
 */
export async function uploadPhotosToStorage(
  photos: { uri: string }[],
  userId: string,
  entityId: string
): Promise<string[]> {
  if (photos.length === 0) return [];

  // Ensure bucket exists
  await ensurePhotoBucket();

  const timestamp = Date.now();
  const urls: string[] = [];

  for (let i = 0; i < photos.length; i++) {
    const path = `${userId}/${entityId}/${timestamp}_${i}.jpg`;
    const url = await uploadSinglePhoto(photos[i].uri, path);
    if (url) {
      urls.push(url);
    }
  }

  console.log(`[Photos] Uploaded ${urls.length}/${photos.length} photos successfully`);
  return urls;
}

/**
 * Upload photos for an INSPECTION and save to inspection_photos table.
 * Schema: inspection_photos (id, inspection_id, photo_url, created_at)
 */
export async function uploadInspectionPhotos(
  photos: { uri: string }[],
  userId: string,
  inspectionId: string,
  customerId: string
): Promise<string[]> {
  const urls = await uploadPhotosToStorage(photos, userId, customerId);

  // Insert rows into inspection_photos table
  for (const url of urls) {
    const { error } = await supabase.from('inspection_photos').insert({
      inspection_id: inspectionId,
      photo_url: url,
    });
    if (error) {
      console.warn('[Photos] inspection_photos insert error:', error.message);
    }
  }

  return urls;
}

/**
 * Upload photos for a VISIT and save to visit_photos table.
 * Schema: visit_photos (id, visit_id, photo_url, created_at, latitude, longitude)
 */
export async function uploadVisitPhotos(
  photos: { uri: string; latitude?: number; longitude?: number }[],
  userId: string,
  customerId: string,
  visitId?: string
): Promise<string[]> {
  const photoObjects = photos.map(p => ({ uri: p.uri }));
  const urls = await uploadPhotosToStorage(photoObjects, userId, customerId);

  // Insert rows into visit_photos table if visitId provided
  if (visitId) {
    for (let i = 0; i < urls.length; i++) {
      const photo = photos[i];
      const { error } = await supabase.from('visit_photos').insert({
        visit_id: visitId,
        photo_url: urls[i],
        latitude: photo?.latitude || 0,
        longitude: photo?.longitude || 0,
      });
      if (error) {
        console.warn('[Photos] visit_photos insert error:', error.message);
      }
    }
  }

  return urls;
}
