import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

interface StampJob {
  uri: string;
  timestamp: string;
  resolve: (uri: string) => void;
}

/**
 * Riduce la foto a max 1600px lato lungo PRIMA di caricarla in memoria per il timbro.
 * Le foto full-resolution (12-48MP sui device recenti) decodificate intere in RAM
 * mandano in crash i telefoni con poca memoria (spesso alla seconda foto).
 * Riduce anche drasticamente il peso dell'upload su reti scarse.
 */
async function shrinkPhoto(uri: string): Promise<string> {
  try {
    const image = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
    const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return saved.uri;
  } catch (err) {
    console.warn('[PhotoStamper] shrinkPhoto:', err);
    return uri;
  }
}

/**
 * Hook that provides photo timestamping functionality.
 * Returns { stampPhoto, StamperView }.
 * StamperView MUST be rendered in the component tree (hidden offscreen).
 */
export function usePhotoStamper() {
  const viewRef = useRef<View>(null);
  const [job, setJob] = useState<StampJob | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  // Coda: una foto alla volta (un doppio tap o la selezione multipla non devono
  // sovrapporre i job né tenere più bitmap in memoria contemporaneamente)
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  // When image loads, capture the composite view
  useEffect(() => {
    if (!job || !imageLoaded) return;

    const doCapture = async () => {
      try {
        if (viewRef.current) {
          const capturedUri = await captureRef(viewRef, {
            format: 'jpg',
            quality: 0.8,
          });
          job.resolve(capturedUri);
        } else {
          job.resolve(job.uri);
        }
      } catch (e) {
        console.warn('[PhotoStamper] Capture failed:', e);
        job.resolve(job.uri);
      } finally {
        setJob(null);
        setImageLoaded(false);
      }
    };

    // Small delay to ensure layout is committed
    const timer = setTimeout(doCapture, 300);
    return () => clearTimeout(timer);
  }, [job, imageLoaded]);

  const stampPhoto = useCallback((photoUri: string): Promise<string> => {
    const run = async (): Promise<string> => {
      // Ridimensiona PRIMA di montare l'immagine: mai bitmap full-res in RAM
      const smallUri = await shrinkPhoto(photoUri);
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const timestamp = `${day}/${month}/${year} ${hours}:${minutes}`;

      return new Promise((resolve) => {
        setImageLoaded(false);
        setJob({ uri: smallUri, timestamp, resolve });
      });
    };
    const result = queueRef.current.then(run, run);
    queueRef.current = result.catch(() => {});
    return result;
  }, []);

  const StamperView = useCallback(() => {
    if (!job) return null;

    return (
      <View style={stamperStyles.hidden} pointerEvents="none">
        <View ref={viewRef} style={stamperStyles.captureArea} collapsable={false}>
          <Image
            source={{ uri: job.uri }}
            style={stamperStyles.image}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              console.warn('[PhotoStamper] Image load error');
              job.resolve(job.uri);
              setJob(null);
            }}
          />
          <View style={stamperStyles.timestampBar}>
            <Text style={stamperStyles.timestampText}>
              {job.timestamp}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [job]);

  return { stampPhoto, StamperView };
}

const stamperStyles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  captureArea: {
    width: 800,
    height: 600,
    backgroundColor: '#000',
  },
  image: {
    width: 800,
    height: 600,
  },
  timestampBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  timestampText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'right',
  },
});
