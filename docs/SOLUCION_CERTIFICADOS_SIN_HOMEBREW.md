# 🔒 Solución de Certificados SSL sin Homebrew

## ✅ Solución Temporal Aplicada

He agregado `MONGO_ALLOW_INVALID_CERTS=true` a tu archivo `.env`. Esto debería permitir que la conexión funcione ahora mismo.

⚠️ **IMPORTANTE:** Esta es una solución temporal solo para desarrollo. Elimina esta línea antes de desplegar a producción.

## 🔄 Reiniciar el Servidor

Ahora reinicia tu servidor:

```bash
npm run dev
```

Deberías ver que MongoDB se conecta exitosamente.

## 🔧 Soluciones Permanentes (Sin Homebrew)

Como no tienes Homebrew instalado, aquí hay alternativas:

### Opción 1: Usar Certificados del Sistema de macOS

macOS viene con certificados del sistema. Puedes configurar Node.js para usarlos:

```bash
# Encontrar los certificados del sistema
export NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem

# O usar el bundle de certificados de macOS
export NODE_EXTRA_CA_CERTS=/System/Library/OpenSSL/certs/cert.pem

# Ejecutar el servidor
npm run dev
```

Para hacerlo permanente, agrega a tu `~/.zshrc`:

```bash
# Agregar al final del archivo
export NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem
```

Luego ejecuta:
```bash
source ~/.zshrc
```

### Opción 2: Instalar Homebrew (Recomendado a Largo Plazo)

Si quieres instalar Homebrew para futuras necesidades:

```bash
# Instalar Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Luego instalar certificados
brew install ca-certificates
sudo update-ca-certificates
```

### Opción 3: Actualizar Node.js (Ya tienes v24.12.0)

Tienes Node.js v24.12.0 que es muy reciente. El problema puede ser que los certificados del sistema necesitan actualizarse. En macOS, esto generalmente se hace automáticamente con las actualizaciones del sistema.

Puedes verificar si hay actualizaciones del sistema:
```bash
# Verificar actualizaciones del sistema
softwareupdate -l
```

### Opción 4: Usar Certificados de MongoDB Atlas Directamente

MongoDB Atlas usa certificados válidos. El problema puede ser que Node.js no está usando los certificados del sistema correctamente. Puedes descargar los certificados CA de MongoDB y usarlos:

```bash
# Descargar certificados CA de MongoDB
curl -o mongodb-ca.crt https://www.digicert.com/CACerts/DigiCertGlobalRootCA.crt

# Configurar Node.js para usarlos
export NODE_EXTRA_CA_CERTS=$(pwd)/mongodb-ca.crt
npm run dev
```

## 🧪 Verificar la Conexión

Después de aplicar cualquier solución, ejecuta:

```bash
npx ts-node --esm server/scripts/diagnose-mongodb.ts
```

Deberías ver:
```
✅ CONEXIÓN EXITOSA
✅ DIAGNÓSTICO COMPLETADO: Conexión funcionando correctamente
```

## 📝 Notas

- La solución temporal (`MONGO_ALLOW_INVALID_CERTS=true`) funciona pero reduce la seguridad
- Para producción, siempre usa certificados válidos
- macOS generalmente mantiene los certificados actualizados automáticamente
- Si el problema persiste, puede ser un problema temporal de MongoDB Atlas

## 🚀 Próximos Pasos

1. **Ahora mismo:** Reinicia el servidor con `npm run dev` - debería funcionar
2. **Más tarde:** Considera instalar Homebrew o configurar `NODE_EXTRA_CA_CERTS` para una solución permanente
3. **Antes de producción:** Asegúrate de eliminar `MONGO_ALLOW_INVALID_CERTS=true` del `.env`
