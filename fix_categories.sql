drop policy "categories_select_all" on public.categories;
create policy "categories_select_same_family"
  on public.categories for select
  using (family_id = get_my_family_id());
