--liquibase formatted sql
--changeset gsd:04-member-ranking-replace-user-cca-rankings

create or replace function public.replace_user_cca_rankings(
	p_user_id bigint,
	p_rankings jsonb
)
returns void
language plpgsql
security invoker
as $$
begin
	delete from public.user_cca_applications
	where user_id = p_user_id;

	insert into public.user_cca_applications (
		user_id,
		position_id,
		ranking,
		application_status
	)
	select
		p_user_id,
		(ranking_item ->> 'position_id')::bigint,
		(ranking_item ->> 'ranking')::integer,
		'pending'
	from jsonb_array_elements(coalesce(p_rankings, '[]'::jsonb)) as ranking_item;
end;
$$;
