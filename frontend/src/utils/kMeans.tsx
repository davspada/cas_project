import { UserPosition } from '@/types'; 

// Helper function to calculate Euclidean distance between two points
function calculateDistance(p1: [number, number], p2: [number, number]): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// K-Means Clustering Algorithm
export function kMeansClustering(
  features: UserPosition[],
  k: number
): { centroid: [number, number]; features: UserPosition[] }[] {
  const maxIterations = 100;

  let centroids: [number, number][] = Array.from({ length: k }, () => {
    const randomFeature = features[Math.floor(Math.random() * features.length)];
    return randomFeature.geometry.coordinates;
  });

  let clusters = Array.from({ length: k }, (_, index) => ({
    centroid: centroids[index],
    features: [] as UserPosition[],
  }));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    clusters.forEach(cluster => (cluster.features = [])); // Clear clusters for reassignment

    features.forEach(feature => {
      const coord = feature.geometry.coordinates;
      let closestCentroidIndex = 0;
      let minDistance = Infinity;

      centroids.forEach((centroid, centroidIndex) => {
        const distance = calculateDistance(coord, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          closestCentroidIndex = centroidIndex;
        }
      });

      clusters[closestCentroidIndex].features.push(feature);
    });

    const newCentroids = clusters.map(cluster => {
      const { features } = cluster;
      if (features.length === 0) return cluster.centroid;

      const [sumX, sumY] = features.reduce(
        (acc, feature) => {
          const [x, y] = feature.geometry.coordinates;
          return [acc[0] + x, acc[1] + y];
        },
        [0, 0]
      );

      return [sumX / features.length, sumY / features.length] as [number, number];
    });

    if (newCentroids.every((newCentroid, i) => calculateDistance(newCentroid, centroids[i]) < 1e-6)) {
      break;
    }

    centroids = newCentroids;
    clusters = clusters.map((cluster, index) => ({
      centroid: centroids[index],
      features: cluster.features,
    }));
  }

  return clusters;
}
