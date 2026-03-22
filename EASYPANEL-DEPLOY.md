# Despliegue en Easypanel

## 1. Preparar la base de datos en Supabase

Antes de desplegar, ejecuta el schema SQL en tu Supabase:
- Ve a tu Supabase en https://marginbites-supabase.ps8uzx.easypanel.host
- Abre el SQL Editor
- Copia y ejecuta el contenido de `supabase-schema.sql`

## 2. Subir el código a GitHub

```bash
cd eatests
git init
git add .
git commit -m "Initial EatEsts commit"
git remote add origin https://github.com/TU_USUARIO/eatests.git
git push -u origin main
```

## 3. Crear la app en Easypanel

1. En Easypanel, crea un nuevo servicio → **App**
2. Selecciona **GitHub** como fuente
3. Conecta tu repositorio `eatests`
4. En **Build**, selecciona **Dockerfile**
5. En **Variables de entorno**, añade:

```
```**python*
NEXT_PUBLIC_SUPABASE_URL=https://marginbites-supabase.ps8uzx.easypanel.host
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q
TSPOONLAB_BASE_URL=https://app.tspoonlab.com/recipes/api
```
```

6. Puerto: **3000**
7. Haz clic en **Deploy**

## 4. Usar la app

1. Abre la URL de tu app en Easypanel
2. Introduce tus credenciales de TSpoonLab
3. Haz clic en **Importar datos**
4. Espera a que complete la migración (puede tardar varios minutos)
5. Accede al dashboard con todos tus datos
