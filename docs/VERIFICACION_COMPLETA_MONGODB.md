# Verificación Completa: MongoDB No Conecta desde Esta Ubicación

## Situación Actual

- ❌ No conecta desde esta ubicación (ni WiFi ni datos móviles)
- ✅ Conecta desde otra ubicación
- ✅ MongoDB Atlas tiene 0.0.0.0/0 configurado
- ⚠️ Error: `ECONNRESET` o problemas de conexión

## Pasos de Verificación (En Orden)

### Paso 1: Verificar Estado del Cluster en MongoDB Atlas

**CRÍTICO:** Verifica directamente en MongoDB Atlas:

1. Ve a: **https://cloud.mongodb.com/**
2. Inicia sesión
3. Ve a **"Clusters"** en el menú lateral
4. Busca tu cluster `autoclosecluster`
5. **Verifica el estado:**
   - ¿Está **"Active"** o **"Running"**? → Continúa al Paso 2
   - ¿Está **"Paused"** o **"Pausado"**? → Haz clic en **"Resume"** y espera 2-5 minutos
   - ¿Hay algún mensaje de error o advertencia? → Tómalo en cuenta

**Si el cluster está pausado, esa es la causa.** Los clusters gratuitos se pausan automáticamente después de períodos de inactividad.

### Paso 2: Verificar Credenciales

1. Ve a **"Database Access"** en MongoDB Atlas
2. Busca el usuario `bridgentai_db_user`
3. Verifica que:
   - ✅ El usuario existe
   - ✅ Está **activo** (no deshabilitado)
   - ✅ Tiene permisos adecuados

**Si necesitas resetear la contraseña:**
1. Haz clic en el usuario
2. Click en **"Edit"** → **"Edit Password"**
3. Genera una nueva contraseña
4. **Actualiza** `MONGO_URI` en tu archivo `.env` con la nueva contraseña

### Paso 3: Verificar Network Access

1. Ve a **"Network Access"** en MongoDB Atlas
2. Verifica que existe una entrada con `0.0.0.0/0`
3. Verifica que el estado sea **"Active"** (punto verde)

Si no existe o no está activa, agrégalo:
- Click **"+ADD IP ADDRESS"**
- Selecciona **"Allow access from anywhere"**
- Click **"Confirm"**

### Paso 4: Probar Conexión desde Esta Máquina

Ejecuta el script de diagnóstico:

```bash
npx ts-node --esm server/scripts/diagnose-mongodb.ts
```

**Observa los resultados:**
- Si falla en **DNS**: Problema de resolución de nombres
- Si falla en **conectividad**: La red está bloqueando completamente
- Si falla en **conexión MongoDB**: Puede ser credenciales, cluster pausado, o red

### Paso 5: Probar con MongoDB Compass (GUI)

1. Descarga MongoDB Compass: https://www.mongodb.com/try/download/compass
2. Abre Compass
3. Pega tu connection string:
   ```
   mongodb+srv://bridgentai_db_user:37hOQPv6mkF0UFBo@autoclosecluster.srcqfmb.mongodb.net/autoclose_ai
   ```
4. Intenta conectar

**Resultados posibles:**
- ✅ **Funciona en Compass**: El problema es del código/configuración de Node.js
- ❌ **No funciona en Compass**: El problema es de MongoDB Atlas (cluster pausado, credenciales, etc.)

### Paso 6: Verificar Configuración Local

Si Compass funciona pero tu app no:

1. **Verifica el archivo `.env`:**
   ```bash
   cat .env | grep MONGO
   ```
   
   Debe mostrar:
   ```
   MONGO_URI=mongodb+srv://bridgentai_db_user:37hOQPv6mkF0UFBo@autoclosecluster.srcqfmb.mongodb.net/autoclose_ai?retryWrites=true&w=majority
   ```

2. **Verifica que no haya espacios o caracteres extra:**
   - No debe tener comillas alrededor
   - No debe tener espacios al inicio o final
   - No debe tener saltos de línea

3. **Verifica Node.js:**
   ```bash
   node --version
   ```
   
   Debe ser una versión reciente (v18+ recomendado)

### Paso 7: Probar desde Otra Máquina en la Misma Red

Si tienes acceso a otra computadora en la misma red:

1. Clona el proyecto
2. Configura el `.env` con la misma `MONGO_URI`
3. Ejecuta `npm run dev`

**Resultados:**
- ✅ **Funciona en otra máquina**: Problema específico de tu máquina (firewall local, antivirus, etc.)
- ❌ **No funciona en otra máquina**: Problema de la red en general

## Diagnóstico Según Resultados

### Escenario A: Cluster Pausado
**Solución:** Resume el cluster en MongoDB Atlas y espera 2-5 minutos

### Escenario B: Credenciales Incorrectas
**Solución:** Resetea la contraseña en MongoDB Atlas y actualiza `.env`

### Escenario C: Compass Funciona pero App No
**Solución:** Problema de configuración de Node.js o certificados SSL
- Verifica `MONGO_ALLOW_INVALID_CERTS=true` en `.env` (solo desarrollo)
- O actualiza certificados del sistema

### Escenario D: No Funciona Ni en Compass Ni en App
**Solución:** Problema de MongoDB Atlas o red
- Verifica que el cluster esté activo
- Verifica credenciales
- Verifica Network Access

### Escenario E: Funciona en Otra Ubicación pero No Aquí (Ni WiFi Ni Móvil)
**Solución:** Problema específico de esta máquina
- Verifica firewall local
- Verifica antivirus
- Verifica configuración de red del sistema
- Prueba reiniciar la máquina

## Comandos Útiles

```bash
# Verificar DNS
nslookup autoclosecluster.srcqfmb.mongodb.net

# Verificar conectividad al puerto
nc -zv ac-0og32ah-shard-00-00.srcqfmb.mongodb.net 443

# Verificar variables de entorno
cat .env | grep MONGO

# Ejecutar diagnóstico
npx ts-node --esm server/scripts/diagnose-mongodb.ts

# Verificar versión de Node.js
node --version

# Verificar versión de Mongoose
npm list mongoose
```

## Próximos Pasos

1. **Primero:** Verifica el estado del cluster en MongoDB Atlas (Paso 1)
2. **Segundo:** Ejecuta el diagnóstico (Paso 4)
3. **Tercero:** Prueba con MongoDB Compass (Paso 5)
4. **Cuarto:** Comparte los resultados para diagnóstico más específico

## Notas Importantes

- Los clusters gratuitos se pausan automáticamente después de períodos de inactividad
- La reactivación puede tomar 2-5 minutos
- Los cambios en Network Access pueden tardar 1-2 minutos en propagarse
- Si el problema persiste después de verificar todo, puede ser un problema temporal de MongoDB Atlas
