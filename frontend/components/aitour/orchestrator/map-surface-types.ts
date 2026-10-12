export interface MapSurfaceProps {
  html: string; id: string; selectedId?: string;
  onMessage: (raw: string) => void; onFailure: () => void;
}