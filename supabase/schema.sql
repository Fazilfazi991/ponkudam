create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text,
  password_hash text not null,
  role text not null check (role in ('super_admin', 'product_manager', 'content_manager')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  image_url text,
  description text,
  parent_category_id uuid references categories(id) on delete set null,
  visibility text default 'visible' check (visibility in ('visible', 'hidden')),
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  product_code text unique not null,
  slug text unique not null,
  category_id uuid references categories(id) on delete set null,
  subcategory_id uuid references categories(id) on delete set null,
  product_type text,
  short_description text,
  full_description text,
  featured_image_url text,
  gallery_images jsonb default '[]'::jsonb,
  metal_type text,
  purity text,
  weight_grams numeric,
  stone_details text,
  diamond_details text,
  price numeric,
  offer_price numeric,
  stock_status text default 'in_stock' check (stock_status in ('in_stock', 'out_of_stock', 'made_to_order')),
  visibility text default 'published' check (visibility in ('published', 'draft', 'hidden')),
  is_featured boolean default false,
  is_new_arrival boolean default false,
  is_best_seller boolean default false,
  show_contact_for_price boolean default false,
  price_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists gold_rates (
  id uuid primary key default gen_random_uuid(),
  rate_24k_1g numeric,
  rate_22k_1g numeric,
  rate_22k_8g numeric,
  rate_18k_1g numeric,
  silver_rate numeric,
  rate_date date,
  rate_time time,
  malayalam_message text,
  english_message text,
  marquee_enabled boolean default true,
  show_in_header boolean default true,
  is_active boolean default true,
  updated_by uuid references users(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  phone text,
  email text,
  product_id uuid references products(id) on delete set null,
  product_name text,
  product_code text,
  product_link text,
  price numeric,
  message text,
  status text default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  store_name text,
  logo_url text,
  contact_number text,
  whatsapp_number text,
  email text,
  address text,
  google_map_link text,
  facebook_link text,
  instagram_link text,
  youtube_link text,
  bis_logo_url text,
  huid_logo_url text,
  footer_content text,
  opening_hours text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_products_category_id on products(category_id);
create index if not exists idx_products_visibility on products(visibility);
create index if not exists idx_products_featured on products(is_featured);
create index if not exists idx_categories_parent on categories(parent_category_id);
create index if not exists idx_categories_visibility on categories(visibility);
create index if not exists idx_gold_rates_active_created on gold_rates(is_active, created_at desc);
create index if not exists idx_enquiries_status_created on enquiries(status, created_at desc);

drop trigger if exists users_updated_at on users;
create trigger users_updated_at before update on users for each row execute function set_updated_at();

drop trigger if exists categories_updated_at on categories;
create trigger categories_updated_at before update on categories for each row execute function set_updated_at();

drop trigger if exists products_updated_at on products;
create trigger products_updated_at before update on products for each row execute function set_updated_at();

drop trigger if exists enquiries_updated_at on enquiries;
create trigger enquiries_updated_at before update on enquiries for each row execute function set_updated_at();

drop trigger if exists settings_updated_at on settings;
create trigger settings_updated_at before update on settings for each row execute function set_updated_at();

insert into settings (store_name, logo_url, contact_number, whatsapp_number, email, address, instagram_link, footer_content, opening_hours)
select
  'Ponkudam Gold & Diamonds',
  'images/ponkudam_2003_logo_transparent.webp',
  '+91 98765 43210',
  '919876543210',
  'hello@ponkudam.com',
  '123, Heritage Road, Coimbatore - 641 002.',
  'https://www.instagram.com/',
  'Timeless jewellery created with love, purity and craftsmanship for every celebration.',
  '10:00 AM - 8:00 PM Everyday'
where not exists (select 1 from settings);

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('category-images', 'category-images', true),
  ('site-assets', 'site-assets', true)
on conflict (id) do nothing;
