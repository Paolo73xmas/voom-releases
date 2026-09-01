import { supabase } from '../supabase';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
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
 * Upload a single photo to Supabase Storage.
 * Uses expo-file-system File.arrayBuffer() for mobile (SDK 54+), fetch for web.
 */
export async function uploadSinglePhoto(
  uri: string,
  storagePath: string,
  bucket: string = BUCKET_NAME
): Promise<string | null> {
  try {
    let arrayBuffer: ArrayBuffer;

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      arrayBuffer = await blob.arrayBuffer();
    } else {
      // Mobile: use expo-file-system File class (SDK 54+)
      const file = new File(uri);
      arrayBuffer = await file.arrayBuffer();
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.warn('[Photos] Empty file for', storagePath);
      return null;
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('[Photos] Upload error for', storagePath, ':', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
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
 * onProgress: avanzamento (foto completate / totali) per la barra di invio.
 */
export async function uploadPhotosToStorage(
  photos: { uri: string }[],
  userId: string,
  entityId: string,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  if (photos.length === 0) return [];

  await ensurePhotoBucket();

  const timestamp = Date.now();
  const urls: string[] = [];
  onProgress?.(0, photos.length);

  for (let i = 0; i < photos.length; i++) {
    const path = `${userId}/${entityId}/${timestamp}_${i}.jpg`;
    // Fino a 2 retry per foto con attese crescenti: su reti scarse un blip
    // di connessione non deve far perdere l'immagine
    let url = await uploadSinglePhoto(photos[i].uri, path);
    if (!url) {
      await new Promise((r) => setTimeout(r, 1200));
      url = await uploadSinglePhoto(photos[i].uri, path);
    }
    if (!url) {
      await new Promise((r) => setTimeout(r, 3500));
      url = await uploadSinglePhoto(photos[i].uri, path);
    }
    if (url) {
      urls.push(url);
    }
    onProgress?.(i + 1, photos.length);
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
  customerId: string,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const urls = await uploadPhotosToStorage(photos, userId, customerId, onProgress);

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
  visitId?: string,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const photoObjects = photos.map(p => ({ uri: p.uri }));
  const urls = await uploadPhotosToStorage(photoObjects, userId, customerId, onProgress);

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
