import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Image, Text, StyleSheet, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

interface StampJob {
  uri: string;
  timestamp: string;
  resolve: (uri: string) => void;
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
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timestamp = `${day}/${month}/${year} ${hours}:${minutes}`;

    return new Promise((resolve) => {
      setImageLoaded(false);
      setJob({ uri: photoUri, timestamp, resolve });
    });
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
