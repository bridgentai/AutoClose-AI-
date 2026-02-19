# 🔒 Solución: Error de Certificados SSL en MongoDB Atlas

## 📋 Problema Detectado

El diagnóstico muestra que el cluster de MongoDB Atlas **está activo**, pero Node.js no puede verificar los certificados SSL:

```
Error: unable to verify the first certificate
```

**Evidencia:**
- ✅ El cluster existe y está activo
- ✅ Mongoose puede encontrar los servidores (`ac-0og32ah-shard-00-*.srcqfmb.mongodb.net`)
- ❌ Node.js no puede verificar los certificados SSL/TLS

## ✅ Soluciones (En Orden de Preferencia)

### Solución 1: Actualizar Certificados del Sistema (RECOMENDADO)

**macOS:**
```bash
# Instalar/actualizar certificados CA
brew install ca-certificates

# Actualizar certificados del sistema
sudo update-ca-certificates

# Reiniciar el servidor
npm run dev
```

**Linux:**
```bash
# Actualizar certificados
sudo apt-get update
sudo apt-get install ca-certificates
sudo update-ca-certificates

# Reiniciar el servidor
npm run dev
```

### Solución 2: Actualizar Node.js

Las versiones más recientes de Node.js tienen mejor soporte de certificados SSL:

```bash
# Con nvm
nvm install node
nvm use node

# O descarga desde nodejs.org
# https://nodejs.org/

# Verificar versión
node --version

# Reiniciar el servidor
npm run dev
```

### Solución 3: Usar Certificados del Sistema en Node.js

Puedes configurar Node.js para usar los certificados del sistema:

```bash
# macOS - encontrar certificados del sistema
export NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem

# O usar el bundle de Homebrew
export NODE_EXTRA_CA_CERTS=$(brew --prefix)/etc/ca-certificates/cert.pem

# Ejecutar con certificados
npm run dev
```

Para hacerlo permanente, agrega a tu `~/.zshrc` o `~/.bashrc`:
```bash
export NODE_EXTRA_CA_CERTS=$(brew --prefix)/etc/ca-certificates/cert.pem
```

### Solución 4: Solución Temporal (Solo Desarrollo)

⚠️ **ADVERTENCIA:** Esta solución reduce la seguridad y solo debe usarse temporalmente en desarrollo.

1. Agrega al archivo `.env`:
   ```env
   MONGO_ALLOW_INVALID_CERTS=true
   ```

2. Reinicia el servidor:
   ```bash
   npm run dev
   ```

3. **IMPORTANTE:** Elimina esta línea del `.env` antes de desplegar a producción.

## 🧪 Verificar la Solución

Después de aplicar una solución, ejecuta el diagnóstico:

```bash
npx ts-node --esm server/scripts/diagnose-mongodb.ts
```

Deberías ver:
```
✅ CONEXIÓN EXITOSA
✅ DIAGNÓSTICO COMPLETADO: Conexión funcionando correctamente
```

## 🔍 Diagnóstico Detallado

El script de diagnóstico ahora detecta automáticamente errores de certificados SSL y proporciona sugerencias específicas.

Si ves este error en los logs del servidor:
```
Error: unable to verify the first certificate
```

Significa que necesitas aplicar una de las soluciones arriba.

## 📝 Notas Importantes

- **Solución 1 (Actualizar certificados)** es la mejor opción a largo plazo
- **Solución 2 (Actualizar Node.js)** también mejora otros aspectos de seguridad
- **Solución 3 (NODE_EXTRA_CA_CERTS)** es útil si no puedes actualizar el sistema
- **Solución 4 (MONGO_ALLOW_INVALID_CERTS)** es solo para desarrollo temporal

## 🚨 Seguridad

Nunca uses `MONGO_ALLOW_INVALID_CERTS=true` en producción. Esto deshabilita la verificación de certificados SSL y hace que tu aplicación sea vulnerable a ataques man-in-the-middle.

## 🔗 Referencias

- [Node.js TLS Documentation](https://nodejs.org/api/tls.html)
- [MongoDB Atlas Connection Troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection-issues/)
- [Mongoose Connection Options](https://mongoosejs.com/docs/connections.html#options)
