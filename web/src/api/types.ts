export type User = {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  shipping_full_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
};

export type ProductListItem = {
  id: number;
  name: string;
  slug: string;
  price: string;
  stock_quantity: number;
  category_id: number;
  image_url: string | null;
  is_active: boolean;
};

export type ProductDetail = ProductListItem & {
  description: string | null;
};

export type CartItem = {
  id: number;
  product_id: number;
  quantity: number;
  line_total: string;
  product: ProductListItem;
};

export type Cart = {
  id: number;
  items: CartItem[];
  items_count: number;
  subtotal: string;
};

export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";

export type OrderItemRead = {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
  product_name_snapshot: string;
};

export type OrderDetail = {
  id: number;
  status: OrderStatus;
  total_amount: string;
  created_at: string;
  shipping_full_name: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  shipping_notes: string | null;
  items: OrderItemRead[];
};
