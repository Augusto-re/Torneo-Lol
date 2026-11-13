# Torneo LoL: inscripción y armado de equipos parejos

Next.js + Supabase + Riot API (servidor LAS). Se hostea gratis en Vercel.

- `/`: inscripción pública. Cada uno pone su Riot ID, su línea principal, la alternativa y su rango histórico.
- `/admin`: panel con contraseña. Desde ahí sincronizás con Riot, ves las estadísticas, ajustás a mano y armás y publicás los equipos.
- `/equipos`: los equipos publicados, para pasarles el link a todos.

## 1. Clave de Riot
En developer.riotgames.com → **Register Product** → **Personal API Key**. Describí el proyecto como una herramienta privada para un torneo entre amigos. Mientras la aprueban, podés usar la clave de desarrollo (vence cada 24 h y hay que pegar la nueva en Vercel).

## 2. Supabase
1. Creá un proyecto en supabase.com.
2. En **SQL Editor**, pegá `supabase/schema.sql` y dale **Run**.
3. En **Project Settings → API**, copiá la *Project URL* y la clave `service_role` (o *secret key*).

## 3. Probar en tu compu
```bash
cp .env.example .env.local   # completá los valores
npm install
npm run dev                  # http://localhost:3000
```

## 4. Subir a Vercel
1. Subí el proyecto a un repo de GitHub.
2. En vercel.com → **Add New Project** → importá el repo.
3. En **Environment Variables**, cargá las mismas variables que en `.env.example`.
4. Hacé el deploy. Cuando cambies la clave de Riot: Settings → Environment Variables → editar → **Redeploy**.

## Cómo se calcula el rating
Las unidades son puntos de rango: 100 puntos = 1 división y 400 puntos = 1 tier. Hierro IV vale 0, Oro IV vale 1200 y de Master para arriba se cuenta desde 2800 + LP.

1. **Rango:** se usa solo/duo, o flex con un descuento de 75 si no tiene solo/duo. Se mezcla un 25 % con el pico histórico, si ese pico es más alto que el rango actual. Si no rankeó esta temporada, se usa el pico con un descuento de 150.
2. **Rendimiento:** sale de sus últimas 20 rankeadas: KDA, participación en kills, CS/min, daño/min, oro/min, visión/min y winrate. Cada partida se compara contra las partidas del resto del grupo **en la misma línea**, así un support no queda mal por farmear poco. Cada desvío estándar suma o resta 150 puntos. Con pocas partidas, el efecto se achica.
3. **Ajuste manual:** para los casos que la data no ve, como alguien que juega en una cuenta smurf.
4. **Línea:** en la principal no se descuenta nada, en la alternativa se descuentan 75 y en una línea que no eligió, 250.

Todos los pesos están en `lib/config.ts`.

El armado busca que la suma de cada equipo sea lo más pareja posible, que cada uno juegue su principal o su alternativa y que los duelos de cada línea también sean parejos. Es aleatorio: **Regenerar** da otra combinación igual de buena.

`npm run test:balance` lo prueba con 30 jugadores inventados.

## Límites de Riot
La clave personal permite 100 pedidos cada 2 minutos. Sincronizar a 30 jugadores la primera vez lleva unos 700 pedidos, o sea unos 15 minutos. El panel espera solo cuando llega al límite y sigue, así que dejá la pestaña abierta. Las partidas quedan guardadas, y las siguientes sincronizaciones bajan solo las nuevas. Si dos inscriptos jugaron la misma partida, se baja una sola vez.
