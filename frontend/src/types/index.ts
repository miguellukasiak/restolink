/**
 * Domain types derived strictly from the OpenAPI 3.0.3 specification
 * (Admin Panel API — Zarządzanie Restauratorami i Płatnościami, v1.0.0).
 */

export type RestaurantStatus = 'ACTIVE' | 'BLOCKED' | 'PENDING';

/** Schema: RestaurantListItem */
export interface RestaurantListItem {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  status: RestaurantStatus;
  subscription_valid_until: string;
  /** The owner panel's second language beside English; null for English only. */
  panel_language?: string | null;
  /** Where it is (ISO 3166-1 alpha-2), and its street and town. */
  country: string;
  address?: string | null;
  /** What the menu's prices are in (ISO 4217). */
  currency: string;
  /** The language the menu is written in. */
  base_language: string;
  // The API also sends the restaurant's plan (`package`). There is one plan,
  // so the panel does not show it (backend/app/plans.py).
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

/** Schema: CreateRestaurantRequest */
export interface CreateRestaurantRequest {
  name: string;
  contact_email: string;
  contact_phone: string;
  /** The owner panel's second language; null for English only. */
  panel_language?: string | null;
  country: string;
  address?: string | null;
  currency: string;
  base_language: string;
}

/** Schema: RestaurantPanelInfo — restaurant details + subscription gating. */
export interface RestaurantPanelInfo {
  id: string;
  name: string;
  status: RestaurantStatus;
  subscription_valid_until: string | null;
  /** The owner panel's second language beside English; null for English only. */
  panel_language?: string | null;
  /** The restaurant's own look, for the panel header (RestaurantIdentity). */
  logo_url?: string | null;
  primary_color?: string | null;
  font_family?: string | null;
  /** Where it is, what its prices are in, and what its menu is written in. */
  country: string;
  currency: string;
  base_language: string;
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

/**
 * Schema: MenuNote — the owner's own text between the menu's sections (lunch
 * hours, what a set menu consists of). `order` shares its numbering with the
 * categories' `order`; `utils/menuLayout.ts` merges the two.
 */
export interface MenuNote {
  id: string;
  /** Text with a small markup: **bold**, *italic*, "# " heading, "- " item. */
  body: string;
  order: number;
  /** Absent from an API that predates it; `noteLook` fills the defaults. */
  style?: MenuNoteStyle;
}

/** How a note looks on the guest menu. */
export interface MenuNoteStyle {
  /** A slug from `NOTE_ICONS`; null draws no icon. */
  icon: string | null;
  variant: 'card' | 'filled' | 'plain';
  align: 'left' | 'center';
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
  /** Background pattern by name (components/public/menuPatterns.ts), or null. */
  menu_pattern?: string | null;
}

/** Schema: RestaurantThemeUpdate — PUT /restaurants/{id}/theme body. */
export type RestaurantThemeUpdate = Partial<RestaurantThemeSettings>;

/** Schema: PublicMenuResponse */
export interface PublicMenuResponse {
  restaurant: {
    name: string;
    theme: RestaurantThemeSettings;
    status: RestaurantStatus;
    subscription_valid_until: string | null;
    /** What the guest can switch to: the menu's own language first. */
    languages?: string[];
    /** What the prices are in, and where the restaurant is. Absent from an
     *  API that predates them: złoty, in Poland. */
    currency?: string;
    country?: string;
  };
  categories: PublicMenuCategory[];
  /** Absent from an API that predates notes. */
  notes?: MenuNote[];
  /**
   * Present only when the menu was requested in a language other than its own.
   * Coverage can be partial: the owner writes these translations by hand.
   * `phrases_translated` counts the requested language alone — below
   * `phrases_total`, the guest meets English (`used_fallback`) or the
   * original, and `UntranslatedNotice` says so.
   */
  translation?: {
    language: string;
    base_language: string;
    used_fallback: boolean;
    phrases_total: number;
    phrases_translated: number;
  } | null;
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
