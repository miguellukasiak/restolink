/**
 * Domain types derived strictly from the OpenAPI 3.0.3 specification
 * (Admin Panel API — Zarządzanie Restauratorami i Płatnościami, v1.0.0).
 */

export type RestaurantStatus = 'ACTIVE' | 'BLOCKED' | 'PENDING';

export interface PackageSummary {
  id: string;
  name: string;
}

/** Schema: RestaurantListItem */
export interface RestaurantListItem {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  status: RestaurantStatus;
  subscription_valid_until: string;
  package: PackageSummary;
}

/** Schema: PaginationMeta */
export interface PaginationMeta {
  total_items: number;
  total_pages: number;
  current_page: number;
}

/** Schema: RestaurantListResponse */
export interface RestaurantListResponse {
  data: RestaurantListItem[];
  meta: PaginationMeta;
}

/** Query parameters for GET /api/v1/admin/restaurants (1-based page). */
export interface RestaurantListParams {
  page: number;
  limit: number;
}

/** Schema: PackageItem */
export interface PackageItem {
  id: string;
  name: string;
}

/** Schema: CreateRestaurantRequest */
export interface CreateRestaurantRequest {
  name: string;
  contact_email: string;
  contact_phone: string;
  package_id: string;
}

/** Schema: RestaurantPanelInfo — lightweight restaurant details for the panel header. */
export interface RestaurantPanelInfo {
  id: string;
  name: string;
}

/** Schema: MenuItem */
export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  price: number;
  description: string;
  ingredients: string;
  allergens: string[];
  tags: string[];
  /** Dish can be temporarily hidden from ordering without deleting it. */
  is_available: boolean;
  /** Base64 Data URI (mock) or CDN URL (production). */
  image_url: string | null;
}

/** Schema: MenuCategory */
export interface MenuCategory {
  id: string;
  name: string;
  order: number;
  items: MenuItem[];
}

/** Schema: MenuItemRequest */
export interface MenuItemRequest {
  category_id: string;
  name: string;
  price: number;
  description?: string;
  ingredients?: string;
  allergens?: string[];
  tags?: string[];
  is_available?: boolean;
  image_url?: string | null;
}

/** Nutrition facts shown on the public dish detail view (per portion). */
export interface NutritionInfo {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

/** Public menu dish — MenuItem plus optional public-only extras. */
export interface PublicMenuItem extends MenuItem {
  nutrition?: NutritionInfo;
}

/** Public menu category (same shape as MenuCategory, public item type). */
export interface PublicMenuCategory extends Omit<MenuCategory, 'items'> {
  items: PublicMenuItem[];
}

/** Visual brand settings of a restaurant (public + settings page). */
export interface RestaurantThemeSettings {
  logo_url: string | null;
  primary_color: string;
  background_color: string;
  font_family: string;
}

/** Schema: RestaurantThemeUpdate — PUT /restaurants/{id}/theme body. */
export type RestaurantThemeUpdate = Partial<RestaurantThemeSettings>;

/** Schema: PublicMenuResponse */
export interface PublicMenuResponse {
  restaurant: {
    name: string;
    theme: RestaurantThemeSettings;
  };
  categories: PublicMenuCategory[];
}

/** Schema: ManualPaymentRequest */
export interface ManualPaymentRequest {
  amount: number;
  notes?: string;
}

/** Schema: ManualPaymentResponse */
export interface ManualPaymentResponse {
  success: boolean;
  payment_id: string;
  updated_restaurant: {
    id: string;
    new_status: RestaurantStatus;
    new_valid_until: string;
  };
}
