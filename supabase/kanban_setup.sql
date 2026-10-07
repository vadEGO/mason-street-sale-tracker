create table public.tracker_editors (
 email text primary key check (email=lower(email)),
 created_at timestamptz not null default now()
);
insert into public.tracker_editors(email) values ('vadimegorov@outlook.com');
alter table public.tracker_editors enable row level security;
grant select,insert,delete on public.tracker_editors to authenticated;
create policy "Read own access or administer" on public.tracker_editors for select to authenticated using (email=lower(auth.jwt()->>'email') or lower(auth.jwt()->>'email')='vadimegorov@outlook.com');
create policy "Admin add editors" on public.tracker_editors for insert to authenticated with check (lower(auth.jwt()->>'email')='vadimegorov@outlook.com');
create policy "Admin remove editors" on public.tracker_editors for delete to authenticated using (lower(auth.jwt()->>'email')='vadimegorov@outlook.com' and email<>'vadimegorov@outlook.com');
create function public.tracker_can_edit() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.tracker_editors where email=lower(auth.jwt()->>'email'))
$$;
revoke all on function public.tracker_can_edit() from public,anon;
grant execute on function public.tracker_can_edit() to authenticated;
create table public.board_columns (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 80),
 task_status text not null default 'Open',
 is_complete boolean not null default false,
 sort_order integer not null default 100,
 updated_at timestamptz not null default now()
);
alter table public.board_columns enable row level security;
grant select on public.board_columns to anon,authenticated;
grant insert,update on public.board_columns to authenticated;
create policy "Read columns" on public.board_columns for select to anon,authenticated using(true);
create policy "Editors add columns" on public.board_columns for insert to authenticated with check((select public.tracker_can_edit()));
create policy "Editors update columns" on public.board_columns for update to authenticated using((select public.tracker_can_edit())) with check((select public.tracker_can_edit()));
insert into public.board_columns(name,task_status,is_complete,sort_order) values
 ('To do','Open',false,10),('In progress','In progress',false,20),('Waiting','Waiting',false,30),('Blocked','Blocked',false,40),('Done','Done',true,50);
alter table public.tasks add column column_id uuid references public.board_columns(id);
alter table public.tasks add column completed_at timestamptz;
update public.tasks t set column_id=c.id,completed_at=case when c.is_complete then t.updated_at end
from public.board_columns c where c.task_status=case when t.status='Complete' then 'Done' else t.status end;
create index tasks_column_id_idx on public.tasks(column_id);
create table public.task_updates (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) on delete cascade,
 body text not null check (length(trim(body)) between 1 and 10000),
 actor text not null default 'Tracker',
 created_at timestamptz not null default now()
);
create index task_updates_task_id_idx on public.task_updates(task_id,created_at desc);
alter table public.task_updates enable row level security;
grant select on public.task_updates to anon,authenticated;
grant insert on public.task_updates to authenticated;
create policy "Read updates" on public.task_updates for select to anon,authenticated using(true);
create policy "Editors add updates" on public.task_updates for insert to authenticated with check((select public.tracker_can_edit()));
grant select,insert,update on public.tasks to authenticated;
create policy "Editors read tasks" on public.tasks for select to authenticated using((select public.tracker_can_edit()));
create policy "Editors add tasks" on public.tasks for insert to authenticated with check((select public.tracker_can_edit()));
create policy "Editors update tasks" on public.tasks for update to authenticated using((select public.tracker_can_edit())) with check((select public.tracker_can_edit()));
create function public.tracker_task_before_save() returns trigger language plpgsql security invoker set search_path='' as $$
declare c public.board_columns;
begin
 if TG_OP='INSERT' or new.column_id is distinct from old.column_id then
  if new.column_id is null then select * into c from public.board_columns where task_status=new.status or (new.status='Complete' and is_complete) order by sort_order limit 1; new.column_id=c.id;
  else select * into c from public.board_columns where id=new.column_id; new.status=c.task_status; end if;
 elsif new.status is distinct from old.status then
  select * into c from public.board_columns where task_status=new.status or (new.status='Complete' and is_complete) order by sort_order limit 1; new.column_id=c.id;
 else select * into c from public.board_columns where id=new.column_id;
 end if;
 new.completed_at=case when c.is_complete then coalesce(new.completed_at,now()) else null end;
 new.updated_at=clock_timestamp();
 return new;
end $$;
create trigger tracker_task_before_save before insert or update on public.tasks for each row execute function public.tracker_task_before_save();
create function public.tracker_task_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.task_updates(task_id,body,actor) values(new.id,'Card created',coalesce(auth.jwt()->>'email','Tracker'));
 elsif new.column_id is distinct from old.column_id or new.status is distinct from old.status then
  insert into public.task_updates(task_id,body,actor) values(new.id,'Status changed: '||old.status||' → '||new.status,coalesce(auth.jwt()->>'email','Tracker'));
 end if;
 return new;
end $$;
create trigger tracker_task_audit after insert or update on public.tasks for each row execute function public.tracker_task_audit();
revoke all on function public.tracker_task_before_save(),public.tracker_task_audit() from public,anon;

create function public.tracker_column_before_save() returns trigger language plpgsql security invoker set search_path='' as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger tracker_column_before_save before update on public.board_columns for each row execute function public.tracker_column_before_save();
revoke all on function public.tracker_column_before_save() from public,anon;
revoke execute on function public.recalculate_sale_stage(),public.tasks_recalculate_sale_stage() from public,anon,authenticated;
