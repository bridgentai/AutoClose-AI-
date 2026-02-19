# 🔌 Solución: Error ECONNRESET en MongoDB

## 📋 Problema Detectado

El error `read ECONNRESET` o `ECONNREFUSED` indica que:

- ✅ La conexión **se establece** inicialmente (DNS funciona, puede alcanzar MongoDB)
- ❌ Pero luego la conexión **se cierra/resetea** antes de completarse
- ✅ MongoDB Atlas está configurado correctamente (0.0.0.0/0)
- ✅ Desde otra ubicación **sí funciona**

**Esto significa que la RED de esta ubicación específica está bloqueando/interrumpiendo las conexiones a MongoDB.**

## 🔍 Causas Comunes

### 1. Firewall/Proxy Intermedio 🔥

Un firewall o proxy en la red está cortando conexiones de larga duración o conexiones a MongoDB específicamente.

**Síntomas:**
- La conexión se establece pero se cierra inmediatamente
- Funciona desde otras redes pero no desde esta
- Puede funcionar intermitentemente

**Solución:**
- Contactar al administrador de red para permitir conexiones a:
  - `*.mongodb.net` (puerto 443 para `mongodb+srv`)
  - `*.mongodb.net` (puerto 27017 para conexiones directas)
- O usar una VPN hacia una red que funcione

### 2. ISP Bloqueando Conexiones 🌐

Algunos proveedores de internet bloquean o limitan conexiones a ciertos servicios.

**Síntomas:**
- Solo pasa en esta ubicación específica
- Otras conexiones a internet funcionan normalmente
- Puede ser intermitente

**Solución:**
- Probar con datos móviles (hotspot) para confirmar
- Si funciona con móvil, el problema es el ISP
- Contactar al ISP o usar VPN

### 3. Red Corporativa/Institucional 🏢

Redes de empresas o instituciones suelen tener políticas restrictivas.

**Síntomas:**
- Solo pasa en la red de la oficina/universidad
- Funciona desde casa o desde otra red
- Puede haber un proxy corporativo

**Solución:**
- Contactar al departamento de TI
- Solicitar que permitan conexiones a MongoDB Atlas
- O usar VPN corporativa si está disponible

### 4. Timeout Muy Corto ⏱️

La red puede tener timeouts muy cortos que cortan conexiones antes de completarse.

**Síntomas:**
- La conexión se establece pero se cierra rápidamente
- Puede funcionar ocasionalmente

**Solución:**
- Ya implementado en el código: timeouts aumentados y heartbeats más frecuentes
- Si persiste, puede ser necesario ajustar más los timeouts

## ✅ Soluciones Implementadas en el Código

El código ahora incluye:

1. **Retries aumentados:** 3 intentos con backoff exponencial
2. **Timeouts más largos:** 30-45 segundos para dar más tiempo
3. **Heartbeat frecuente:** Cada 10 segundos para mantener la conexión viva
4. **Detección específica:** Detecta `ECONNRESET` y proporciona mensajes específicos
5. **Cierre limpio:** Cierra conexiones previas antes de reintentar

## 🧪 Cómo Verificar el Problema

### Paso 1: Confirmar que es la Red

Ejecuta desde esta ubicación problemática:

```bash
# Probar conectividad básica
ping google.com

# Probar resolución DNS de MongoDB
nslookup autoclosecluster.srcqfmb.mongodb.net

# Probar conexión al puerto (debería funcionar si no hay bloqueo total)
nc -zv ac-0og32ah-shard-00-00.srcqfmb.mongodb.net 443
```

Si `nc` hace timeout o falla, la red está bloqueando completamente MongoDB.

### Paso 2: Probar con Otra Red

Conecta desde:
- Datos móviles (hotspot)
- Otra red WiFi
- VPN

Si funciona desde otra red, confirma que el problema es la red específica.

### Paso 3: Verificar Logs del Servidor

Los logs ahora muestran específicamente cuando detecta `ECONNRESET`:

```
🔌 ERROR: ECONNRESET / ECONNREFUSED DETECTADO
   La conexión se establece pero luego se cierra/resetea.
   Esto indica que la RED de esta ubicación está bloqueando/interrumpiendo
   las conexiones a MongoDB después de establecerlas.
```

## 🔧 Soluciones Prácticas

### Solución 1: Usar VPN (Rápida)

Si necesitas trabajar desde esta ubicación ahora mismo:

1. Conecta a una VPN hacia una red que funcione
2. Ejecuta el servidor con la VPN activa
3. La conexión debería funcionar

### Solución 2: Contactar Administrador de Red

Si es una red corporativa/institucional:

1. Explica que necesitas acceso a MongoDB Atlas
2. Proporciona los detalles:
   - Dominios: `*.mongodb.net`
   - Puertos: 443 (TLS), 27017 (directo)
   - Propósito: Base de datos para desarrollo
3. Solicita que se agreguen a la whitelist del firewall

### Solución 3: Usar Datos Móviles

Como prueba temporal:

1. Crea un hotspot con tu móvil
2. Conecta tu computadora al hotspot
3. Ejecuta el servidor
4. Si funciona, confirma que el problema es la red fija

### Solución 4: Configurar Proxy (Si aplica)

Si la red requiere proxy:

1. Configura Node.js para usar el proxy:
   ```bash
   export HTTP_PROXY=http://proxy.example.com:8080
   export HTTPS_PROXY=http://proxy.example.com:8080
   ```

2. O configura Mongoose para usar proxy (requiere configuración adicional)

## 📝 Notas Importantes

- **No es un problema de MongoDB Atlas:** La configuración está correcta (0.0.0.0/0)
- **No es un problema de tu código:** Funciona desde otras ubicaciones
- **Es un problema de red:** La red de esta ubicación está bloqueando/interrumpiendo conexiones

## 🚀 Próximos Pasos

1. **Ahora:** Intenta conectar con VPN o datos móviles para confirmar
2. **Corto plazo:** Contacta al administrador de red si es red corporativa
3. **Largo plazo:** Configura acceso permanente o usa otra red para desarrollo

## 🔗 Referencias

- [MongoDB Atlas Network Troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection-issues/)
- [Mongoose Connection Options](https://mongoosejs.com/docs/connections.html#options)
- Ver también: `docs/CONEXION_DESDE_OTRA_UBICACION.md`
