import { api } from './api';
import type { PackageItem } from '../types';

/** GET /api/v1/admin/packages — available subscription packages. */
export async function fetchPackages(): Promise<PackageItem[]> {
  const { data } = await api.get<PackageItem[]>('/api/v1/admin/packages');
  return data;
}
