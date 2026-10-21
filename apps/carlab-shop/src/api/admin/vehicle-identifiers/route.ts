import {
  VEHICLE_IDENTIFIERS,
  collectionRoutes,
} from '../vehicle-reference-routes';

export const { GET, POST } = collectionRoutes(VEHICLE_IDENTIFIERS);
