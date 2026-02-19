# 🚨 Solución Rápida: Error de Conexión a MongoDB

## ⚠️ Problema Detectado

El diagnóstico confirma que **el cluster `autoclosecluster.srcqfmb.mongodb.net` NO existe o NO está disponible**.

**Evidencia:**
- ❌ DNS no puede resolver el nombre del cluster
- ❌ No se puede establecer conectividad
- ❌ MongoDB no puede encontrar el servidor

## ✅ Solución Inmediata

### Paso 1: Verificar el Estado del Cluster en MongoDB Atlas

1. Ve a: **https://cloud.mongodb.com/**
2. Inicia sesión con tu cuenta
3. Ve a **"Clusters"** en el menú lateral
4. Busca tu cluster

### Paso 2A: Si el Cluster Está Pausado

**Síntomas:**
- Verás el estado "Paused" o "Pausado"
- Habrá un botón "Resume" o "Resume Cluster"

**Acción:**
1. Haz clic en **"Resume"** o **"Resume Cluster"**
2. Espera 2-5 minutos a que el cluster se reactive
3. El estado cambiará a "Active" o "Running"
4. Reinicia tu servidor: `npm run dev`

### Paso 2B: Si el Cluster No Existe o Fue Renombrado

**Síntomas:**
- No ves ningún cluster llamado `autoclosecluster`
- Ves otros clusters con nombres diferentes

**Acción:**
1. Si tienes otro cluster disponible:
   - Haz clic en **"Connect"**
   - Selecciona **"Connect your application"**
   - Copia la connection string
   - Actualiza `MONGO_URI` en tu archivo `.env`

2. Si no tienes ningún cluster:
   - Necesitas crear uno nuevo en MongoDB Atlas
   - O restaurar uno desde un backup

### Paso 3: Verificar Network Access

Aunque tengas `0.0.0.0/0` configurado, verifica:

1. Ve a **Network Access** en MongoDB Atlas
2. Verifica que existe una entrada con `0.0.0.0/0`
3. Si no existe, agrégalo:
   - Click "Add IP Address"
   - Selecciona "Allow access from anywhere"
   - Click "Confirm"

### Paso 4: Verificar Credenciales

1. Ve a **Database Access**
2. Verifica que el usuario `bridgentai_db_user` existe
3. Si no existe o necesitas resetear la contraseña:
   - Crea un nuevo usuario o resetea la contraseña
   - Actualiza `MONGO_URI` en `.env` con las nuevas credenciales

## 🔧 Actualizar la Connection String

Una vez que tengas el cluster activo o la nueva connection string:

1. Abre el archivo `.env` en la raíz del proyecto
2. Actualiza la línea `MONGO_URI`:
   ```env
   MONGO_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/base_datos?retryWrites=true&w=majority
   ```
3. Guarda el archivo
4. Reinicia el servidor: `npm run dev`

## 🧪 Verificar la Conexión

Después de actualizar, ejecuta el script de diagnóstico:

```bash
npx ts-node --esm server/scripts/diagnose-mongodb.ts
```

Deberías ver:
```
✅ CONEXIÓN EXITOSA
✅ DIAGNÓSTICO COMPLETADO: Conexión funcionando correctamente
```

## 📞 Si el Problema Persiste

1. **Prueba con MongoDB Compass:**
   - Descarga: https://www.mongodb.com/try/download/compass
   - Intenta conectar con la connection string
   - Si funciona en Compass pero no en la app, puede ser un problema del código

2. **Verifica los logs del servidor:**
   - Los nuevos logs mejorados mostrarán información más detallada
   - Busca mensajes específicos sobre qué servidores intentó conectar

3. **Contacta soporte de MongoDB Atlas:**
   - Si el cluster desapareció sin razón aparente
   - Si necesitas ayuda para restaurar un cluster

## 📝 Notas Importantes

- Los clusters gratuitos se pausan automáticamente después de períodos de inactividad
- La reactivación puede tomar 2-5 minutos
- Los cambios en Network Access pueden tardar 1-2 minutos en propagarse
- Siempre verifica que el cluster esté "Active" antes de intentar conectar
