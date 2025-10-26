// Map clustering and heatmap utilities

export interface MapPoint {
  lat: number;
  lng: number;
  weight?: number;
  data?: unknown;
}

export interface Cluster {
  center: MapPoint;
  points: MapPoint[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export class MapUtils {
  // K-means clustering for map points
  static clusterPoints(points: MapPoint[], numClusters: number): Cluster[] {
    if (points.length <= numClusters) {
      return points.map(point => ({
        center: point,
        points: [point],
        bounds: {
          minLat: point.lat,
          maxLat: point.lat,
          minLng: point.lng,
          maxLng: point.lng
        }
      }));
    }

    // Initialize cluster centers randomly
    let centers = this.initializeCenters(points, numClusters);
    let clusters: Cluster[] = [];
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      // Assign points to nearest center
      clusters = centers.map(center => ({
        center,
        points: [],
        bounds: {
          minLat: Infinity,
          maxLat: -Infinity,
          minLng: Infinity,
          maxLng: -Infinity
        }
      }));

      points.forEach(point => {
        let minDistance = Infinity;
        let nearestCluster = 0;

        centers.forEach((center, index) => {
          const distance = this.calculateDistance(point, center);
          if (distance < minDistance) {
            minDistance = distance;
            nearestCluster = index;
          }
        });

        clusters[nearestCluster].points.push(point);
        
        // Update bounds
        const bounds = clusters[nearestCluster].bounds;
        bounds.minLat = Math.min(bounds.minLat, point.lat);
        bounds.maxLat = Math.max(bounds.maxLat, point.lat);
        bounds.minLng = Math.min(bounds.minLng, point.lng);
        bounds.maxLng = Math.max(bounds.maxLng, point.lng);
      });

      // Recalculate centers
      const newCenters = clusters.map(cluster => {
        if (cluster.points.length === 0) {
          return cluster.center;
        }
        
        const sumLat = cluster.points.reduce((sum, p) => sum + p.lat, 0);
        const sumLng = cluster.points.reduce((sum, p) => sum + p.lng, 0);
        
        return {
          lat: sumLat / cluster.points.length,
          lng: sumLng / cluster.points.length
        };
      });

      // Check for convergence
      let converged = true;
      for (let i = 0; i < centers.length; i++) {
        if (this.calculateDistance(centers[i], newCenters[i]) > 0.0001) {
          converged = false;
          break;
        }
      }

      if (converged) break;
      centers = newCenters;
      iterations++;
    }

    return clusters.filter(c => c.points.length > 0);
  }

  // Initialize cluster centers using K-means++
  private static initializeCenters(points: MapPoint[], k: number): MapPoint[] {
    const centers: MapPoint[] = [];
    
    // Choose first center randomly
    centers.push(points[Math.floor(Math.random() * points.length)]);
    
    // Choose remaining centers
    for (let i = 1; i < k; i++) {
      const distances = points.map(point => {
        let minDist = Infinity;
        centers.forEach(center => {
          const dist = this.calculateDistance(point, center);
          if (dist < minDist) minDist = dist;
        });
        return minDist;
      });
      
      // Choose point with probability proportional to squared distance
      const sumDistances = distances.reduce((sum, d) => sum + d * d, 0);
      let random = Math.random() * sumDistances;
      
      for (let j = 0; j < points.length; j++) {
        random -= distances[j] * distances[j];
        if (random <= 0) {
          centers.push(points[j]);
          break;
        }
      }
    }
    
    return centers;
  }

  // Calculate distance between two points (Haversine formula)
  static calculateDistance(p1: MapPoint, p2: MapPoint): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(p2.lat - p1.lat);
    const dLng = this.toRad(p2.lng - p1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(p1.lat)) * Math.cos(this.toRad(p2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Generate heatmap data
  static generateHeatmapData(points: MapPoint[], gridSize: number = 50): number[][] {
    if (points.length === 0) return [];

    // Find bounds
    const bounds = {
      minLat: Math.min(...points.map(p => p.lat)),
      maxLat: Math.max(...points.map(p => p.lat)),
      minLng: Math.min(...points.map(p => p.lng)),
      maxLng: Math.max(...points.map(p => p.lng))
    };

    // Create grid
    const grid: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    const latStep = (bounds.maxLat - bounds.minLat) / gridSize;
    const lngStep = (bounds.maxLng - bounds.minLng) / gridSize;

    // Calculate heat values
    points.forEach(point => {
      const weight = point.weight || 1;
      const radius = 3; // Influence radius in grid cells

      // Find grid position
      const gridY = Math.floor((point.lat - bounds.minLat) / latStep);
      const gridX = Math.floor((point.lng - bounds.minLng) / lngStep);

      // Apply gaussian blur
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const y = gridY + dy;
          const x = gridX + dx;

          if (y >= 0 && y < gridSize && x >= 0 && x < gridSize) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const influence = weight * Math.exp(-(distance * distance) / (2 * radius * radius));
            grid[y][x] += influence;
          }
        }
      }
    });

    // Normalize values
    const maxValue = Math.max(...grid.flat());
    if (maxValue > 0) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          grid[y][x] = grid[y][x] / maxValue;
        }
      }
    }

    return grid;
  }

  // Calculate optimal route using nearest neighbor algorithm
  static calculateOptimalRoute(points: MapPoint[], startPoint?: MapPoint): MapPoint[] {
    if (points.length <= 1) return points;

    const unvisited = [...points];
    const route: MapPoint[] = [];
    
    // Start from given point or first point
    let current = startPoint || unvisited[0];
    const startIndex = unvisited.findIndex(p => p.lat === current.lat && p.lng === current.lng);
    if (startIndex !== -1) {
      unvisited.splice(startIndex, 1);
    }
    route.push(current);

    // Visit nearest unvisited point
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      unvisited.forEach((point, index) => {
        const distance = this.calculateDistance(current, point);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      current = unvisited[nearestIndex];
      route.push(current);
      unvisited.splice(nearestIndex, 1);
    }

    return route;
  }

  // Get zoom level based on bounds
  static getZoomLevel(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): number {
    const WORLD_DIM = { height: 256, width: 256 };
    const ZOOM_MAX = 21;

    function latRad(lat: number): number {
      const sin = Math.sin(lat * Math.PI / 180);
      const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
      return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
    }

    function zoom(mapPx: number, worldPx: number, fraction: number): number {
      return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
    }

    const latFraction = (latRad(bounds.maxLat) - latRad(bounds.minLat)) / Math.PI;
    const lngDiff = bounds.maxLng - bounds.minLng;
    const lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;

    const latZoom = zoom(400, WORLD_DIM.height, latFraction);
    const lngZoom = zoom(400, WORLD_DIM.width, lngFraction);

    return Math.min(latZoom, lngZoom, ZOOM_MAX);
  }
}