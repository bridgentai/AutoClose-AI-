# Solución: Error DNS ENODATA con MongoDB Atlas

## Problema Detectado

El error `queryA ENODATA autoclosecluster.srcqfmb.mongodb.net` indica que:

- ❌ El DNS **no puede resolver** el nombre del cluster
- ✅ El cluster existe y está activo en MongoDB Atlas
- ✅ Funciona desde otra ubicación
- ❌ No funciona ni con WiFi ni con datos móviles desde esta ubicación

**Esto NO es un problema de MongoDB Atlas.** Es un problema de **configuración de DNS** en esta máquina o red.

## Causa

El error `ENODATA` significa que el servidor DNS no tiene registros para ese dominio. Esto puede ser:

1. **Servidores DNS defectuosos o bloqueados**
2. **Configuración de red local** que interfiere con DNS
3. **Proxy o VPN** que bloquea resolución DNS
4. **Problema temporal** de los servidores DNS

## Soluciones (En Orden)

### Solución 1: Cambiar Servidores DNS (RECOMENDADO)

**macOS:**

1. Ve a **System Preferences** → **Network**
2. Selecciona tu conexión activa (WiFi o Ethernet)
3. Click en **"Advanced"**
4. Ve a la pestaña **"DNS"**
5. Click en el botón **"+"** para agregar servidores DNS
6. Agrega estos servidores (uno por uno):
   - `8.8.8.8` (Google DNS)
   - `8.8.4.4` (Google DNS secundario)
   - O `1.1.1.1` (Cloudflare DNS)
   - O `1.0.0.1` (Cloudflare DNS secundario)
7. Click **"OK"** y luego **"Apply"**

**Verificar que funcionó:**

```bash
# Probar resolución DNS
nslookup autoclosecluster.srcqfmb.mongodb.net

# Debería mostrar direcciones IP
```

### Solución 2: Limpiar Cache DNS (macOS)

```bash
# Limpiar cache DNS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Luego probar de nuevo
nslookup autoclosecluster.srcqfmb.mongodb.net
```

### Solución 3: Verificar Configuración de Red

1. Verifica si hay **VPN activa** que pueda estar interfiriendo
2. Verifica si hay **proxy configurado**:
   - System Preferences → Network → Advanced → Proxies
   - Si hay proxy, desactívalo temporalmente para probar
3. Verifica **firewall local**:
   - System Preferences → Security & Privacy → Firewall
   - Asegúrate de que no esté bloqueando Node.js

### Solución 4: Probar con DNS Público desde Terminal

```bash
# Usar Google DNS directamente
nslookup autoclosecluster.srcqfmb.mongodb.net 8.8.8.8

# Usar Cloudflare DNS directamente
nslookup autoclosecluster.srcqfmb.mongodb.net 1.1.1.1
```

Si funciona con estos comandos pero no normalmente, confirma que el problema son tus servidores DNS actuales.

### Solución 5: Verificar desde Terminal

```bash
# Ver qué servidores DNS estás usando
scutil --dns | grep nameserver

# Ver configuración de red
networksetup -getdnsservers Wi-Fi
# O para Ethernet:
networksetup -getdnsservers Ethernet
```

## Verificación

Después de cambiar los DNS:

1. **Espera 1-2 minutos** para que los cambios se apliquen
2. **Prueba resolución DNS:**
   ```bash
   nslookup autoclosecluster.srcqfmb.mongodb.net
   ```
   
   Debería mostrar direcciones IP como:
   ```
   Name:    autoclosecluster.srcqfmb.mongodb.net
   Address: 54.xxx.xxx.xxx
   ```

3. **Ejecuta el script de prueba:**
   ```bash
   npx ts-node --esm server/scripts/test-mongodb-connection.ts
   ```

4. **Reinicia el servidor:**
   ```bash
   npm run dev
   ```

## Por Qué Funciona desde Otra Ubicación

Si funciona desde otra ubicación pero no desde esta:

- La otra ubicación tiene **servidores DNS diferentes** que pueden resolver MongoDB
- La otra ubicación **no tiene bloqueos** de DNS
- Esta máquina/red tiene **configuración DNS problemática**

## Notas Importantes

- **No es un problema de MongoDB Atlas:** El cluster está activo y configurado correctamente
- **No es un problema de tu código:** El código está bien, simplemente no puede resolver el DNS
- **Es un problema de DNS local:** Los servidores DNS de esta máquina/red no pueden resolver el dominio

## Servidores DNS Recomendados

- **Google DNS:** `8.8.8.8` y `8.8.4.4`
- **Cloudflare DNS:** `1.1.1.1` y `1.0.0.1`
- **OpenDNS:** `208.67.222.222` y `208.67.220.220`

## Referencias

- [Cómo cambiar DNS en macOS](https://support.apple.com/en-us/HT202516)
- [Google Public DNS](https://developers.google.com/speed/public-dns)
- [Cloudflare DNS](https://1.1.1.1/)
