-- Other Income: solo P&L Real (como COS contable).

alter table public.pl_other_income
  drop constraint if exists pl_other_income_modelo_check;

update public.pl_other_income set modelo = 'real' where modelo is distinct from 'real';

alter table public.pl_other_income
  alter column modelo set default 'real';

alter table public.pl_other_income
  add constraint pl_other_income_modelo_check check (modelo = 'real');

comment on column public.pl_other_income.modelo is
  'Siempre real. Other Income no aplica a Budget.';
