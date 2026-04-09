import { supabase } from '../supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

const BUCKET_NAME = 'visit-photos';

/**
 * Ensures the storage bucket exists. Creates it if missing.
 */
export async function ensurePhotoBucket(): Promise<boolean> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (exists) return true;

    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
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
 * Upload a single photo to Supabase Storage using base64 (reliable on mobile).
 * Returns the public URL or null on failure.
 */
export async function uploadSinglePhoto(
  uri: string,
  storagePath: string
): Promise<string | null> {
  try {
    let arrayBuffer: ArrayBuffer;

    if (Platform.OS === 'web') {
      // Web: fetch + blob works fine
      const response = await fetch(uri);
      const blob = await response.blob();
      arrayBuffer = await blob.arrayBuffer();
    } else {
      // Mobile: read file as base64 using expo-file-system, then decode
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      arrayBuffer = decode(base64);
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.warn('[Photos] Empty file for', storagePath);
      return null;
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('[Photos] Upload error for', storagePath, ':', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    console.log('[Photos] Uploaded:', storagePath, '- Size:', arrayBuffer.byteLength, 'bytes');
    return urlData.publicUrl;
  } catch (e) {
    console.warn('[Photos] Upload exception for', storagePath, ':', e);
    return null;
  }
}

/**
 * Upload multiple photos to Supabase Storage.
 */
export async function uploadPhotosToStorage(
  photos: { uri: string }[],
  userId: string,
  entityId: string
): Promise<string[]> {
  if (photos.length === 0) return [];

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
 */
export async function uploadInspectionPhotos(
  photos: { uri: string }[],
  userId: string,
  inspectionId: string,
  customerId: string
): Promise<string[]> {
  const urls = await uploadPhotosToStorage(photos, userId, customerId);

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
 */
export async function uploadVisitPhotos(
  photos: { uri: string; latitude?: number; longitude?: number }[],
  userId: string,
  customerId: string,
  visitId?: string
): Promise<string[]> {
  const photoObjects = photos.map(p => ({ uri: p.uri }));
  const urls = await uploadPhotosToStorage(photoObjects, userId, customerId);

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
