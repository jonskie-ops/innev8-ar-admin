-- INNEV8 QR Hunt: players can't delete themselves any more. The game no longer has "Delete your
-- profile" (Me), so the function it called (…_hunter_leave.sql) goes: only an admin deletes a hunter,
-- on the Hunters page (delete_hunters, …_hunters.sql).

drop function if exists public.hunter_leave(uuid, text);
