# Solución: Error ReplicaSetNoPrimary en MongoDB Atlas

## Problema Detectado
El error `ReplicaSetNoPrimary` indica que MongoDB Atlas no puede encontrar un servidor primario en el replica set. Esto puede ocurrir por varias razones.

## Causas Comunes y Soluciones

### 1. Cluster Pausado o Inactivo ⚠️ (MÁS COMÚN)

**Síntoma:** El cluster puede estar pausado automáticamente por inactividad (clusters gratuitos).

**Solución:**
1. Ve a: https://cloud.mongodb.com/
2. Inicia sesión con tu cuenta
3. Selecciona tu cluster `autoclosecluster`
4. Si está pausado, verás un botón **"Resume"** o **"Resume Cluster"**
5. Haz clic para reactivar el cluster
6. Espera 2-5 minutos a que el cluster se reactive completamente
7. Reinicia tu servidor: `npm run dev`

### 2. Credenciales Incorrectas

**Verificación:**
1. Ve a MongoDB Atlas → Database Access
2. Verifica que el usuario `bridgentai_db_user` existe
3. Verifica que la contraseña sea correcta
4. Si necesitas resetear la contraseña:
   - Ve a Database Access
   - Haz clic en el usuario
   - Click en "Edit" → "Edit Password"
   - Genera una nueva contraseña
   - Actualiza el `.env` con la nueva contraseña

**Importante:** Si la contraseña tiene caracteres especiales, deben estar codificados en la URI:
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`
- `#` → `%23`
- `[` → `%5B`
- `]` → `%5D`

### 3. Cluster en Estado de Transición

**Síntoma:** El cluster puede estar creándose, actualizándose o migrando.

**Solución:**
1. Ve a MongoDB Atlas → Clusters
2. Verifica el estado del cluster
3. Espera a que termine cualquier operación en curso
4. El estado debe ser "Active" o "Running"

### 4. Problema de DNS o Red

**Verificación:**
```bash
# Probar resolución DNS
nslookup autoclosecluster.srcqfmb.mongodb.net

# Probar conectividad
ping autoclosecluster.srcqfmb.mongodb.net
```

**Solución:**
- Verifica tu conexión a internet
- Prueba desde otra red si es posible
- Verifica que no haya firewall bloqueando conexiones salientes al puerto 27017

### 5. Whitelist de IPs (Aunque ya está en 0.0.0.0/0)

**Verificación:**
1. Ve a MongoDB Atlas → Network Access
2. Verifica que exista una entrada con `0.0.0.0/0` (Allow access from anywhere)
3. Si no existe, agrégalo:
   - Click "Add IP Address"
   - Selecciona "Allow access from anywhere"
   - O ingresa manualmente: `0.0.0.0/0`
   - Click "Confirm"

### 6. Verificar la URI de Conexión

**Formato correcto:**
```
mongodb+srv://usuario:contraseña@cluster.mongodb.net/nombre_db?retryWrites=true&w=majority
```

**Tu URI actual:**
```
mongodb+srv://bridgentai_db_user:37hOQPv6mkF0UFBo@autoclosecluster.srcqfmb.mongodb.net/autoclose_ai?retryWrites=true&w=majority
```

**Verificación:**
- ✅ Usuario: `bridgentai_db_user`
- ✅ Cluster: `autoclosecluster.srcqfmb.mongodb.net`
- ✅ Base de datos: `autoclose_ai`
- ⚠️ Contraseña: Verifica que sea correcta

## Pasos de Diagnóstico

### Paso 1: Verificar Estado del Cluster
1. Ve a: https://cloud.mongodb.com/
2. Click en "Clusters" en el menú lateral
3. Verifica que el cluster `autoclosecluster` esté **"Active"** o **"Running"**
4. Si está pausado, haz clic en "Resume"

### Paso 2: Verificar Credenciales
1. Ve a "Database Access"
2. Busca el usuario `bridgentai_db_user`
3. Verifica que esté activo
4. Si necesitas resetear la contraseña, hazlo y actualiza el `.env`

### Paso 3: Probar Conexión Manual

**Opción A: Usando MongoDB Compass**
1. Descarga MongoDB Compass: https://www.mongodb.com/try/download/compass
2. Abre Compass
3. Pega tu connection string completa
4. Intenta conectar
5. Si funciona en Compass pero no en la app, el problema es del código
6. Si no funciona en Compass, el problema es de configuración de Atlas

**Opción B: Usando mongosh (CLI)**
```bash
# Instalar mongosh si no lo tienes
# macOS: brew install mongosh
# O descarga desde: https://www.mongodb.com/try/download/shell

mongosh "mongodb+srv://bridgentai_db_user:37hOQPv6mkF0UFBo@autoclosecluster.srcqfmb.mongodb.net/autoclose_ai"
```

### Paso 4: Verificar Logs del Servidor

Cuando ejecutes `npm run dev`, deberías ver:
```
🔄 Intentando conectar a MongoDB...
📍 URI: mongodb+srv://bridgentai_db_user:37hOQPv6mkF0UFBo@autoclosec...
⚙️  Opciones de conexión: { ... }
```

Si ves el error `ReplicaSetNoPrimary`, revisa los detalles adicionales que ahora se muestran.

## Mejoras Implementadas

El código ahora incluye:
- ✅ Retry automático (3 intentos con backoff exponencial)
- ✅ Timeouts aumentados (30 segundos)
- ✅ Mejor manejo de errores con sugerencias específicas
- ✅ Validación de URI (comillas, espacios, etc.)
- ✅ Logging detallado para debugging

## Próximos Pasos

1. **Verifica el estado del cluster en MongoDB Atlas** (más probable que esté pausado)
2. **Reinicia el servidor** después de reactivar el cluster
3. **Revisa los logs** para ver información adicional de diagnóstico
4. **Si el problema persiste**, prueba la conexión manual con MongoDB Compass

## Contacto y Recursos

- MongoDB Atlas Dashboard: https://cloud.mongodb.com/
- Documentación MongoDB: https://docs.mongodb.com/
- MongoDB Community Forum: https://developer.mongodb.com/community/forums/
