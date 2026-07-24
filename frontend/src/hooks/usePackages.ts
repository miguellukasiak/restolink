import { useQuery } from '@tanstack/react-query';
import { fetchPackages } from '../services/packageService';

export const packagesQueryKeys = {
  all: ['packages'] as const,
};

/** Available subscription packages for the "Add restaurant" select. */
export function usePackages(enabled = true) {
  return useQuery({
    queryKey: packagesQueryKeys.all,
    queryFn: fetchPackages,
    staleTime: 5 * 60_000,
    enabled,
  });
}
