begin;
insert into auth.users(id,email) values('10000000-0000-0000-0000-000000000001','ledger-test@example.invalid'),('10000000-0000-0000-0000-000000000002','ledger-test2@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.save_ledger('{"bosses":[{"id":"b1","name":"测试老板","rate":40000,"note":""}],"works":[{"id":"w1","bossId":"b1","date":"2026-10-24","days":0.5,"content":"测试"}],"wages":[{"id":"g1","workId":"w1","rate":40000,"amount":20000}],"expenses":[{"id":"e1","bossId":"b1","date":"2026-10-24","amount":2000,"purpose":"车费"}],"receipts":[{"id":"r1","bossId":"b1","date":"2026-10-24","amount":10000,"note":"测试"}],"allocations":[{"id":"a1","receiptId":"r1","kind":"wage","targetId":"g1","amount":8000},{"id":"a2","receiptId":"r1","kind":"expense","targetId":"e1","amount":2000}]}'::jsonb,0) as saved_revision;
select public.load_ledger()->>'revision'='1' and jsonb_array_length(public.load_ledger()->'state'->'works')=1 as readback_ok;
DO $$ begin
 begin perform public.save_ledger((public.load_ledger()->'state'),0);raise exception 'stale revision was accepted';exception when others then if sqlerrm not like '%其他设备%' then raise;end if;end;
 begin perform public.save_ledger(jsonb_set(public.load_ledger()->'state','{wages,0,amount}','1000'),1);raise exception 'invalid wage was accepted';exception when others then if sqlerrm not like '%工资计算%' then raise;end if;end;
 begin perform public.save_ledger(jsonb_set(public.load_ledger()->'state','{allocations,0,amount}','30000'),1);raise exception 'overpayment accepted';exception when others then if sqlerrm not like '%不能超过%' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select jsonb_array_length(public.load_ledger()->'state'->'works')=0 as account_isolation_ok;
select count(*)=0 as direct_table_isolation_ok from public.ledger_works;
rollback;
