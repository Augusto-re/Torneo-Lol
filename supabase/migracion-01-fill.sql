-- Habilita "Cualquiera (fill)" como línea alternativa.
-- No borra ni modifica jugadores ya cargados: solo amplía los valores permitidos.
alter table players drop constraint if exists players_alt_role_check;
alter table players add constraint players_alt_role_check
  check (alt_role in ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY','FILL'));
