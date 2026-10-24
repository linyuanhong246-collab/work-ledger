create table public.ledger_versions(user_id uuid primary key references auth.users(id) on delete cascade, revision bigint not null default 0, updated_at timestamptz not null default now());
alter table public.ledger_versions enable row level security;
create policy own_ledger on public.ledger_versions to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update on public.ledger_versions to authenticated;
DO $$ declare t text; begin foreach t in array array['bosses','works','wages','expenses','receipts','allocations'] loop
execute format('create table public.ledger_%I (user_id uuid not null references auth.users(id) on delete cascade,id text not null,data jsonb not null,primary key(user_id,id),check(jsonb_typeof(data)=''object'' and data->>''id''=id))',t);
execute format('alter table public.ledger_%I enable row level security',t);
execute format('create policy owner_only on public.ledger_%I to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
execute format('grant select,insert,update,delete on public.ledger_%I to authenticated',t);
end loop; end $$;
create function public.load_ledger() returns jsonb language sql security invoker set search_path='' as $$
select jsonb_build_object('revision',coalesce((select revision from public.ledger_versions where user_id=auth.uid()),0),'state',jsonb_build_object(
'bosses',coalesce((select jsonb_agg(data order by id) from public.ledger_bosses where user_id=auth.uid()),'[]'::jsonb),
'works',coalesce((select jsonb_agg(data order by id) from public.ledger_works where user_id=auth.uid()),'[]'::jsonb),
'wages',coalesce((select jsonb_agg(data order by id) from public.ledger_wages where user_id=auth.uid()),'[]'::jsonb),
'expenses',coalesce((select jsonb_agg(data order by id) from public.ledger_expenses where user_id=auth.uid()),'[]'::jsonb),
'receipts',coalesce((select jsonb_agg(data order by id) from public.ledger_receipts where user_id=auth.uid()),'[]'::jsonb),
'allocations',coalesce((select jsonb_agg(data order by id) from public.ledger_allocations where user_id=auth.uid()),'[]'::jsonb))) where auth.uid() is not null;
$$;
create function public.save_ledger(p_state jsonb,p_expected bigint) returns bigint language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); t text; v bigint; item jsonb; wg jsonb; wr jsonb; amount bigint; allocated bigint;
begin
if u is null then raise exception '请先登录'; end if;
if pg_column_size(p_state)>5000000 then raise exception '账本数据过大'; end if;
foreach t in array array['bosses','works','wages','expenses','receipts','allocations'] loop
 if jsonb_typeof(p_state->t) is distinct from 'array' then raise exception '无效的账本格式'; end if;
 if (select count(*) from jsonb_array_elements(p_state->t))<>(select count(distinct value->>'id') from jsonb_array_elements(p_state->t)) then raise exception '记录标识重复或缺失'; end if;
end loop;
foreach t in array array['bosses','works','wages','expenses','receipts','allocations'] loop
 for item in select value from jsonb_array_elements(p_state->t) loop
 if jsonb_typeof(item) is distinct from 'object' or length(item->>'id') not between 1 and 100 then raise exception '记录格式无效'; end if;
 if t='bosses' and (coalesce(length(trim(item->>'name')),0)=0 or jsonb_typeof(item->'rate') is distinct from 'number' or (item->>'rate')::numeric<0 or (item->>'rate')::numeric<>trunc((item->>'rate')::numeric)) then raise exception '老板名称或日薪无效'; end if;
 if t in ('works','expenses','receipts') and (item->>'bossId' is null or item->>'date' is null) then raise exception '缺少老板或日期'; end if;
 if t in ('works','expenses','receipts') then perform (item->>'date')::date; end if;
 if t='expenses' and item->>'workId' is not null and not exists(select 1 from jsonb_array_elements(p_state->'works') w where w->>'id'=item->>'workId' and w->>'bossId'=item->>'bossId' and w->>'date'=item->>'date') then raise exception '垫付关联工作不匹配'; end if;
 if t='works' and jsonb_typeof(item->'days') is distinct from 'number' then raise exception '缺少工日'; end if;
 if t='wages' and (item->>'workId' is null or jsonb_typeof(item->'rate') is distinct from 'number') then raise exception '工资格式无效'; end if;
 if t in ('wages','expenses','receipts','allocations') and (jsonb_typeof(item->'amount') is distinct from 'number' or abs((item->>'amount')::numeric)>100000000000) then raise exception '金额缺失或过大'; end if;
 if t='allocations' and (item->>'kind' is null or item->>'targetId' is null or item->>'receiptId' is null) then raise exception '收款分配不完整'; end if;
 if t='expenses' and coalesce(length(trim(item->>'purpose')),0)=0 then raise exception '垫付用途不能为空'; end if;
 end loop;
end loop;
insert into public.ledger_versions(user_id) values(u) on conflict do nothing;
select revision into v from public.ledger_versions where user_id=u for update;
if v<>p_expected then raise exception '账本已在其他设备更新，请刷新后重试'; end if;
for item in select value from jsonb_array_elements(p_state->'works') loop
 if not exists(select 1 from jsonb_array_elements(p_state->'bosses') b where b->>'id'=item->>'bossId') or item->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or (item->>'days')::numeric not in (0.5,1) then raise exception '工作记录无效'; end if;
 if (select count(*) from jsonb_array_elements(p_state->'wages') g where g->>'workId'=item->>'id')<>1 then raise exception '工作与工资必须一一对应'; end if;
end loop;
for item in select value from jsonb_array_elements(p_state->'wages') loop
 select value into wr from jsonb_array_elements(p_state->'works') where value->>'id'=item->>'workId';
 if wr is null or (item->>'rate')::numeric<0 or (item->>'rate')::numeric<>trunc((item->>'rate')::numeric) or (item->>'amount')::numeric<>round((item->>'rate')::numeric*(wr->>'days')::numeric) then raise exception '工资计算不一致'; end if;
end loop;
foreach t in array array['expenses','receipts'] loop
 for item in select value from jsonb_array_elements(p_state->t) loop
 if not exists(select 1 from jsonb_array_elements(p_state->'bosses') b where b->>'id'=item->>'bossId') or (item->>'amount')::numeric<=0 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric) or item->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '金额、老板或日期无效'; end if;
 end loop;
end loop;
for item in select value from jsonb_array_elements(p_state->'allocations') loop
 if (item->>'amount')::numeric<=0 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric) or item->>'kind' not in ('wage','expense') then raise exception '分配金额无效'; end if;
 select value into wr from jsonb_array_elements(p_state->'receipts') where value->>'id'=item->>'receiptId';
 if wr is null then raise exception '分配缺少收款记录'; end if;
 if coalesce((wr->>'voided')::boolean,false) then continue; end if;
 if item->>'kind'='wage' then
 select value into wg from jsonb_array_elements(p_state->'wages') where value->>'id'=item->>'targetId';
 if not exists(select 1 from jsonb_array_elements(p_state->'works') w where w->>'id'=wg->>'workId' and w->>'bossId'=wr->>'bossId') then raise exception '工资老板不匹配'; end if;
 else
 select value into wg from jsonb_array_elements(p_state->'expenses') where value->>'id'=item->>'targetId';
 if wg->>'bossId' is distinct from wr->>'bossId' then raise exception '报销老板不匹配'; end if;
 end if;
 if wg is null then raise exception '分配目标不存在'; end if;
 select coalesce(sum((a->>'amount')::bigint),0) into allocated from jsonb_array_elements(p_state->'allocations') a join jsonb_array_elements(p_state->'receipts') r on r->>'id'=a->>'receiptId' where a->>'kind'=item->>'kind' and a->>'targetId'=item->>'targetId' and not coalesce((r->>'voided')::boolean,false);
 if allocated>(wg->>'amount')::bigint then raise exception '分配不能超过应收金额'; end if;
end loop;
for item in select value from jsonb_array_elements(p_state->'receipts') loop
 select coalesce(sum((a->>'amount')::bigint),0) into allocated from jsonb_array_elements(p_state->'allocations') a where a->>'receiptId'=item->>'id';
 if allocated<>(item->>'amount')::bigint then raise exception '收款与分配合计不一致'; end if;
end loop;
foreach t in array array['bosses','works','wages','expenses','receipts','allocations'] loop
 execute format('delete from public.ledger_%I where user_id=$1',t) using u;
 execute format('insert into public.ledger_%I(user_id,id,data) select $1,value->>''id'',value from jsonb_array_elements($2)',t) using u,p_state->t;
end loop;
update public.ledger_versions set revision=v+1,updated_at=now() where user_id=u;
return v+1;
end $$;
revoke all on function public.load_ledger() from public,anon;
revoke all on function public.save_ledger(jsonb,bigint) from public,anon;
grant execute on function public.load_ledger(),public.save_ledger(jsonb,bigint) to authenticated;
