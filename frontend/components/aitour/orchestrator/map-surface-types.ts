import type { routeMapData } from './route-map-document';
export interface MapSurfaceProps {
  data: ReturnType<typeof routeMapData>;
  html: string; id: string; selectedId?: string;
  onMessage: (raw: string) => void; onFailure: () => void;
}