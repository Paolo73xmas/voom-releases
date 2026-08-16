/**
 * Geometric utility functions for agent territory zones
 * 
 * This module provides pure functions for geospatial calculations
 * using Turf.js library. All functions are side-effect free.
 */

import * as turf from '@turf/turf';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

/**
 * Check if a point (latitude, longitude) is inside a GeoJSON polygon
 * 
 * @param lat - Latitude of the point
 * @param lng - Longitude of the point
 * @param polygon - GeoJSON Polygon geometry
 * @returns true if point is inside polygon, false otherwise
 * 
 * @example
 * const polygon: GeoJSON.Polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[9.0, 45.3], [9.3, 45.3], [9.3, 45.6], [9.0, 45.6], [9.0, 45.3]]]
 * };
 * const isInside = isPointInPolygon(45.4642, 9.1900, polygon); // Milano coordinates
 * console.log(isInside); // true
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: GeoJSON.Polygon
): boolean {
  try {
    const point = turf.point([lng, lat]); // Turf uses [lng, lat] order
    return booleanPointInPolygon(point, polygon);
  } catch (error) {
    console.error('[geo-zones] Error checking point in polygon:', error);
    return false;
  }
}

/**
 * Check if a point is inside any of the provided zones
 * 
 * @param lat - Latitude of the point
 * @param lng - Longitude of the point
 * @param zones - Array of zone objects with geometry property
 * @returns Object with isInZone flag and array of matching zone IDs
 * 
 * @example
 * const zones = [
 *   { id: 'zone1', geometry: { type: 'Polygon', coordinates: [...] } },
 *   { id: 'zone2', geometry: { type: 'Polygon', coordinates: [...] } }
 * ];
 * const result = isPointInAnyZone(45.4642, 9.1900, zones);
 * console.log(result); // { isInZone: true, matchingZoneIds: ['zone1'] }
 */
export function isPointInAnyZone(
  lat: number,
  lng: number,
  zones: Array<{ id?: string; geometry: GeoJSON.Polygon }>
): { isInZone: boolean; matchingZoneIds: string[] } {
  const matchingZoneIds: string[] = [];

  for (const zone of zones) {
    if (isPointInPolygon(lat, lng, zone.geometry)) {
      if (zone.id) {
        matchingZoneIds.push(zone.id);
      }
    }
  }

  return {
    isInZone: matchingZoneIds.length > 0,
    matchingZoneIds,
  };
}

/**
 * Validate if an object is a valid GeoJSON Polygon
 * 
 * @param geometry - Object to validate
 * @returns true if valid GeoJSON Polygon, false otherwise
 * 
 * @example
 * const valid = validateGeoJSONPolygon({
 *   type: 'Polygon',
 *   coordinates: [[[9.0, 45.3], [9.3, 45.3], [9.3, 45.6], [9.0, 45.6], [9.0, 45.3]]]
 * });
 * console.log(valid); // true
 */
export function validateGeoJSONPolygon(geometry: unknown): geometry is GeoJSON.Polygon {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const geo = geometry as Record<string, unknown>;

  if (geo.type !== 'Polygon') {
    return false;
  }

  if (!Array.isArray(geo.coordinates)) {
    return false;
  }

  if (geo.coordinates.length === 0) {
    return false;
  }

  // Check that first ring (outer boundary) has at least 4 points
  const outerRing = geo.coordinates[0];
  if (!Array.isArray(outerRing) || outerRing.length < 4) {
    return false;
  }

  // Check that first and last points are the same (closed polygon)
  const firstPoint = outerRing[0];
  const lastPoint = outerRing[outerRing.length - 1];
  if (
    !Array.isArray(firstPoint) ||
    !Array.isArray(lastPoint) ||
    firstPoint[0] !== lastPoint[0] ||
    firstPoint[1] !== lastPoint[1]
  ) {
    return false;
  }

  // Check that all points have valid coordinates
  for (const ring of geo.coordinates) {
    if (!Array.isArray(ring)) {
      return false;
    }
    for (const point of ring) {
      if (
        !Array.isArray(point) ||
        point.length < 2 ||
        typeof point[0] !== 'number' ||
        typeof point[1] !== 'number'
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Calculate the area of a GeoJSON polygon in square kilometers
 * 
 * @param geometry - GeoJSON Polygon geometry
 * @returns Area in square kilometers, or 0 if invalid
 * 
 * @example
 * const polygon: GeoJSON.Polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[9.0, 45.3], [9.3, 45.3], [9.3, 45.6], [9.0, 45.6], [9.0, 45.3]]]
 * };
 * const area = calculatePolygonArea(polygon);
 * console.log(`Area: ${area.toFixed(2)} km²`);
 */
export function calculatePolygonArea(geometry: GeoJSON.Polygon): number {
  try {
    if (!validateGeoJSONPolygon(geometry)) {
      console.error('[geo-zones] Invalid polygon geometry');
      return 0;
    }

    const areaMeters = turf.area(geometry);
    const areaKm = areaMeters / 1_000_000; // Convert to km²
    return areaKm;
  } catch (error) {
    console.error('[geo-zones] Error calculating polygon area:', error);
    return 0;
  }
}

/**
 * Get the center point (centroid) of a GeoJSON polygon
 * 
 * @param geometry - GeoJSON Polygon geometry
 * @returns Center point as [latitude, longitude] or null if invalid
 * 
 * @example
 * const polygon: GeoJSON.Polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[9.0, 45.3], [9.3, 45.3], [9.3, 45.6], [9.0, 45.6], [9.0, 45.3]]]
 * };
 * const center = getPolygonCenter(polygon);
 * console.log(center); // [45.45, 9.15]
 */
export function getPolygonCenter(geometry: GeoJSON.Polygon): [number, number] | null {
  try {
    if (!validateGeoJSONPolygon(geometry)) {
      console.error('[geo-zones] Invalid polygon geometry');
      return null;
    }

    const center = turf.center(geometry);
    const [lng, lat] = center.geometry.coordinates;
    return [lat, lng]; // Return as [lat, lng] for consistency with other functions
  } catch (error) {
    console.error('[geo-zones] Error calculating polygon center:', error);
    return null;
  }
}

/**
 * Convert Leaflet LatLng array to GeoJSON Polygon
 * Helper function for converting Leaflet drawing output to GeoJSON
 * 
 * @param latLngs - Array of Leaflet LatLng objects [{lat, lng}, ...]
 * @returns GeoJSON Polygon geometry
 * 
 * @example
 * const leafletPoints = [
 *   { lat: 45.3, lng: 9.0 },
 *   { lat: 45.3, lng: 9.3 },
 *   { lat: 45.6, lng: 9.3 },
 *   { lat: 45.6, lng: 9.0 },
 *   { lat: 45.3, lng: 9.0 } // Close the polygon
 * ];
 * const polygon = leafletLatLngsToGeoJSON(leafletPoints);
 */
export function leafletLatLngsToGeoJSON(
  latLngs: Array<{ lat: number; lng: number }>
): GeoJSON.Polygon {
  // Convert [{lat, lng}] to [[lng, lat]] (GeoJSON format)
  const coordinates = latLngs.map(point => [point.lng, point.lat]);

  // Ensure polygon is closed (first point === last point)
  if (
    coordinates.length > 0 &&
    (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
      coordinates[0][1] !== coordinates[coordinates.length - 1][1])
  ) {
    coordinates.push([...coordinates[0]]);
  }

  return {
    type: 'Polygon',
    coordinates: [coordinates],
  };
}

/**
 * Convert GeoJSON Polygon to Leaflet LatLng array
 * Helper function for displaying GeoJSON zones on Leaflet map
 * 
 * @param geometry - GeoJSON Polygon geometry
 * @returns Array of Leaflet LatLng objects
 * 
 * @example
 * const polygon: GeoJSON.Polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[9.0, 45.3], [9.3, 45.3], [9.3, 45.6], [9.0, 45.6], [9.0, 45.3]]]
 * };
 * const leafletPoints = geoJSONToLeafletLatLngs(polygon);
 */
export function geoJSONToLeafletLatLngs(
  geometry: GeoJSON.Polygon
): Array<{ lat: number; lng: number }> {
  if (!validateGeoJSONPolygon(geometry)) {
    console.error('[geo-zones] Invalid polygon geometry');
    return [];
  }

  // Get outer ring (first element of coordinates)
  const outerRing = geometry.coordinates[0];

  // Convert [[lng, lat]] to [{lat, lng}]
  return outerRing.map(point => ({
    lat: point[1],
    lng: point[0],
  }));
}