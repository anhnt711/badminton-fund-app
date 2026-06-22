create extension if not exists pgcrypto;

create table if not exists settings (
  key text primary key,
  value text not null,
  description text
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  gender text not null check (gender in ('Nam', 'Nữ')),
  membership_type text not null check (membership_type in ('monthly', 'half_month', 'guest')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  title text not null default 'Buổi cầu lông',
  shuttle_count numeric not null default 0,
  bottle_count numeric not null default 0,
  water_expense numeric not null default 0,
  pot_expense numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references members(id),
  attended boolean not null default true,
  session_fee numeric not null default 0,
  pot_due numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (session_id, member_id)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  type text not null check (type in ('income', 'expense')),
  member_id uuid references members(id),
  category text not null,
  amount numeric not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists transaction_categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  name text not null,
  default_amount numeric not null default 0 check (default_amount >= 0),
  active boolean not null default true,
  sort_order integer not null default 100,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_date on sessions(session_date);
create index if not exists idx_session_players_session on session_players(session_id);
create index if not exists idx_session_players_member on session_players(member_id);
create index if not exists idx_transactions_date on transactions(transaction_date);
create index if not exists idx_transactions_member on transactions(member_id);
create unique index if not exists uq_transaction_categories_type_name on transaction_categories(type, name);

insert into settings (key, value, description) values
  ('monthly_fee', '500000', 'Cố định 1 tháng'),
  ('half_month_fee', '250000', 'Cố định nửa tháng'),
  ('guest_male_fee', '70000', 'Vãng lai nam mỗi buổi'),
  ('guest_female_fee', '50000', 'Vãng lai nữ mỗi buổi')
on conflict (key) do update set value = excluded.value, description = excluded.description;

insert into settings (key, value, description) values
  ('bank_code', '', 'Mã ngân hàng VietQR, ví dụ VCB, BIDV, ACB'),
  ('bank_account', '', 'Số tài khoản nhận tiền'),
  ('bank_owner', '', 'Tên chủ tài khoản nhận tiền'),
  ('transfer_prefix', 'CAULONG', 'Tiền tố nội dung chuyển khoản')
on conflict (key) do nothing;

insert into members (code, name, gender, membership_type) values
  ('TV01', 'Thành viên 01', 'Nam', 'monthly'),
  ('TV02', 'Thành viên 02', 'Nam', 'monthly'),
  ('TV03', 'Thành viên 03', 'Nam', 'monthly'),
  ('TV04', 'Thành viên 04', 'Nam', 'monthly'),
  ('TV05', 'Thành viên 05', 'Nữ', 'monthly'),
  ('TV06', 'Thành viên 06', 'Nam', 'monthly'),
  ('TV07', 'Thành viên 07', 'Nam', 'monthly'),
  ('TV08', 'Thành viên 08', 'Nam', 'monthly'),
  ('TV09', 'Thành viên 09', 'Nam', 'monthly'),
  ('TV10', 'Thành viên 10', 'Nữ', 'monthly'),
  ('TV11', 'Thành viên 11', 'Nam', 'monthly'),
  ('TV12', 'Thành viên 12', 'Nam', 'monthly'),
  ('TV13', 'Thành viên 13', 'Nam', 'half_month'),
  ('TV14', 'Thành viên 14', 'Nam', 'half_month'),
  ('TV15', 'Thành viên 15', 'Nữ', 'half_month'),
  ('TV16', 'Thành viên 16', 'Nam', 'half_month'),
  ('TV17', 'Thành viên 17', 'Nam', 'half_month'),
  ('TV18', 'Thành viên 18', 'Nam', 'half_month'),
  ('TV19', 'Thành viên 19', 'Nam', 'guest'),
  ('TV20', 'Thành viên 20', 'Nữ', 'guest'),
  ('TV21', 'Thành viên 21', 'Nam', 'guest'),
  ('TV22', 'Thành viên 22', 'Nam', 'guest'),
  ('TV23', 'Thành viên 23', 'Nam', 'guest'),
  ('TV24', 'Thành viên 24', 'Nam', 'guest'),
  ('TV25', 'Thành viên 25', 'Nữ', 'guest'),
  ('TV26', 'Thành viên 26', 'Nam', 'guest'),
  ('TV27', 'Thành viên 27', 'Nam', 'guest'),
  ('TV28', 'Thành viên 28', 'Nam', 'guest'),
  ('TV29', 'Thành viên 29', 'Nam', 'guest'),
  ('TV30', 'Thành viên 30', 'Nữ', 'guest')
on conflict (code) do update set
  name = excluded.name,
  gender = excluded.gender,
  membership_type = excluded.membership_type,
  active = true;

insert into transaction_categories (type, name, default_amount, sort_order, note) values
  ('expense', 'Tiền sân', '400000', 10, 'Số tiền cố định mỗi lần thuê sân'),
  ('expense', 'Mua cầu', '0', 20, 'Nhập số tiền thực tế khi mua cầu'),
  ('expense', 'Mua nước', '0', 30, 'Nhập số tiền thực tế khi mua nước'),
  ('expense', 'Chi phí khác', '0', 90, ''),
  ('income', 'Đóng tiền tháng', '0', 10, ''),
  ('income', 'Đóng tiền kèo', '0', 20, ''),
  ('income', 'Thu khác', '0', 90, '')
on conflict (type, name) do update set
  default_amount = excluded.default_amount,
  sort_order = excluded.sort_order,
  note = excluded.note,
  active = true;

alter table settings enable row level security;
alter table members enable row level security;
alter table sessions enable row level security;
alter table session_players enable row level security;
alter table transactions enable row level security;
alter table transaction_categories enable row level security;
