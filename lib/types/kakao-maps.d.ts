declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: any) => any;
        LatLng: new (lat: number, lng: number) => any;
        LatLngBounds: new () => any;
        Marker: new (options: any) => any;
        MarkerImage: new (src: string, size: any, options?: any) => any;
        InfoWindow: new (options: any) => any;
        MapTypeControl: new () => any;
        ZoomControl: new () => any;
        ControlPosition: {
          TOPRIGHT: number;
          RIGHT: number;
          TOP: number;
          TOPLEFT: number;
          LEFT: number;
          BOTTOMLEFT: number;
          BOTTOM: number;
          BOTTOMRIGHT: number;
        };
        Size: new (width: number, height: number) => any;
        Point: new (x: number, y: number) => any;
        event: {
          addListener: (target: any, type: string, callback: (...args: any[]) => void) => void;
          removeListener: (target: any, type: string, callback: (...args: any[]) => void) => void;
        };
        services: {
          Status: {
            OK: string;
            ZERO_RESULT: string;
            ERROR: string;
          };
        };
      };
    };
  }
}

export {};