# Solución: Error de Conexión a MongoDB Atlas

## Problema
El servidor no puede conectarse a MongoDB Atlas porque tu IP actual no está en la whitelist (lista blanca) del cluster.

Error típico:
```
Could not connect to any servers in your MongoDB Atlas cluster. 
One common reason is that you're trying to access the database from an IP that isn't whitelisted.
```

## Solución: Agregar tu IP a la Whitelist de MongoDB Atlas

### Opción 1: Agregar tu IP actual (Recomendado para desarrollo)

1. **Obtén tu IP pública actual:**
   - Visita: https://www.whatismyip.com/
   - O ejecuta en terminal: `curl ifconfig.me`

2. **Accede a MongoDB Atlas:**
   - Ve a: https://cloud.mongodb.com/
   - Inicia sesión con tu cuenta

3. **Navega a Network Access:**
   - En el menú lateral, haz clic en **"Network Access"** (o "Security" > "Network Access")
   - O ve directamente a: https://cloud.mongodb.com/v2#/security/network/whitelist

4. **Agrega tu IP:**
   - Haz clic en **"Add IP Address"** o **"Add Entry"**
   - Selecciona **"Add Current IP Address"** (si está disponible)
   - O ingresa manualmente tu IP en formato: `XXX.XXX.XXX.XXX/32`
   - Agrega un comentario opcional (ej: "Desarrollo local - [tu nombre]")
   - Haz clic en **"Confirm"**

5. **Espera unos minutos:**
   - Los cambios pueden tardar 1-2 minutos en aplicarse

6. **Reinicia el servidor:**
   ```bash
   npm run dev
   ```

### Opción 2: Permitir acceso desde cualquier IP (Solo para desarrollo)

⚠️ **ADVERTENCIA:** Esto permite acceso desde cualquier IP. Úsalo SOLO en desarrollo o con contraseñas muy seguras.

1. En MongoDB Atlas, ve a **Network Access**
2. Haz clic en **"Add IP Address"**
3. Ingresa: `0.0.0.0/0`
4. Haz clic en **"Confirm"**

### Opción 3: Usar MongoDB Compass o Atlas CLI para verificar conexión

Puedes probar la conexión directamente:

```bash
# Instalar MongoDB Compass (GUI)
# O usar mongosh (CLI)
mongosh "mongodb+srv://bridgentai_db_user:37hOQPv6mkF0UFBo@autoclosecluster.srcqfmb.mongodb.net/autoclose_ai"
```

## Verificación

Después de agregar tu IP, deberías ver en la consola:

```
✅ MongoDB conectado exitosamente a evoOS
📊 Base de datos: autoclose_ai
```

En lugar de:

```
❌ Error conectando a MongoDB: Could not connect to any servers...
```

## Notas Adicionales

- Si cambias de red (WiFi, móvil, otra ubicación), necesitarás agregar la nueva IP
- Para producción, usa IPs específicas o VPC peering, nunca `0.0.0.0/0`
- El servidor puede arrancar sin MongoDB, pero las funciones de autenticación y datos no funcionarán

## Troubleshooting

Si después de agregar tu IP aún no funciona:

1. **Verifica que la IP sea correcta:**
   ```bash
   curl ifconfig.me
   ```

2. **Espera 2-3 minutos** para que los cambios se propaguen

3. **Verifica las credenciales** en `.env`:
   - Usuario: `bridgentai_db_user`
   - Contraseña: Debe ser correcta
   - Cluster: `autoclosecluster.srcqfmb.mongodb.net`

4. **Revisa los logs del servidor** para ver el error exacto

5. **Prueba la conexión manualmente** con MongoDB Compass o mongosh
