# Solución: MongoDB Bloqueado en Red Institucional (Colegio/Escuela)

## Problema Detectado

- ✅ **DNS funciona** (ya no hay error ENODATA)
- ✅ **Puede alcanzar los servidores** de MongoDB
- ❌ **La conexión se resetea** (`ECONNRESET`) después de establecerse
- ✅ **Funciona desde otra ubicación** (tu casa, otra red)

**Esto indica que la red del colegio tiene un firewall/proxy que está bloqueando las conexiones a MongoDB.**

## Por Qué Pasa Esto

Las redes institucionales (colegios, universidades, empresas) suelen tener:

1. **Firewalls restrictivos** que bloquean ciertos servicios
2. **Proxies** que interceptan y filtran conexiones
3. **Políticas de seguridad** que limitan acceso a bases de datos en la nube
4. **Filtrado de contenido** que puede bloquear servicios específicos

## Soluciones (En Orden de Preferencia)

### Solución 1: Usar VPN (Más Rápida)

Si tienes acceso a una VPN:

1. **Conecta a una VPN** hacia una red que funcione (tu casa, otro país, servicio VPN)
2. **Ejecuta el servidor** con la VPN activa
3. La conexión debería funcionar porque el tráfico pasa por la VPN

**Servicios VPN gratuitos/baratos:**
- ProtonVPN (tiene plan gratuito)
- Windscribe (tiene plan gratuito limitado)
- TunnelBear (tiene plan gratuito limitado)

### Solución 2: Contactar al Administrador de Red

Si eres estudiante/profesor y necesitas acceso legítimo:

1. **Contacta al departamento de TI** del colegio
2. **Explica que necesitas acceso a MongoDB Atlas** para desarrollo/educación
3. **Proporciona estos detalles técnicos:**
   - Dominios a permitir: `*.mongodb.net`
   - Puertos: `443` (HTTPS/TLS para `mongodb+srv`)
   - Propósito: Base de datos para desarrollo educativo

**Ejemplo de solicitud:**
```
Hola,

Necesito acceso a MongoDB Atlas (servicio de base de datos en la nube) 
para desarrollo educativo. La red actualmente bloquea las conexiones.

Por favor, permitan acceso saliente a:
- Dominios: *.mongodb.net
- Puerto: 443 (HTTPS/TLS)
- Protocolo: TCP

Gracias.
```

### Solución 3: Usar Datos Móviles (Hotspot)

Si tienes datos móviles disponibles:

1. **Crea un hotspot** con tu móvil
2. **Conecta tu computadora** al hotspot
3. **Ejecuta el servidor** usando los datos móviles
4. Esto debería funcionar porque los datos móviles no tienen las restricciones del colegio

**Nota:** Ya probaste esto y funcionó parcialmente, pero puede tener límites de datos.

### Solución 4: Usar MongoDB Local (Solo Desarrollo)

Si solo necesitas desarrollar localmente:

1. **Instala MongoDB localmente:**
   ```bash
   # macOS con Homebrew
   brew tap mongodb/brew
   brew install mongodb-community
   brew services start mongodb-community
   ```

2. **Cambia el MONGO_URI** en `.env`:
   ```env
   MONGO_URI=mongodb://localhost:27017/autoclose_ai
   ```

3. **Desventaja:** No tendrás los datos de producción, pero puedes desarrollar

### Solución 5: Usar Otra Red para Desarrollo

Si es posible:

1. **Desarrolla desde casa** o desde otra red que funcione
2. **Usa la red del colegio** solo cuando sea necesario
3. **Sincroniza cambios** con Git

## Verificación

Para confirmar que es la red del colegio:

1. **Prueba desde otra red** (tu casa, café, etc.)
2. Si funciona desde otra red → confirma que es la red del colegio
3. Si no funciona desde ninguna red → puede ser otro problema

## Trabajo Temporal

Mientras resuelves el problema:

1. **Desarrolla desde casa** o desde otra red
2. **Usa Git** para sincronizar cambios
3. **Usa VPN** cuando necesites trabajar desde el colegio
4. **Contacta al administrador** para acceso permanente

## Notas Importantes

- **No es un problema de tu código:** El código está bien
- **No es un problema de MongoDB Atlas:** MongoDB está configurado correctamente
- **Es un problema de política de red:** La red del colegio está bloqueando MongoDB por seguridad

## Alternativas a MongoDB Atlas

Si no puedes resolver el problema de red:

1. **MongoDB Local:** Instala MongoDB en tu máquina
2. **MongoDB Atlas con VPN:** Usa VPN siempre que trabajes desde el colegio
3. **Otra base de datos:** Considera usar otra DB que no esté bloqueada (aunque esto requeriría cambios en el código)

## Referencias

- [MongoDB Atlas Network Troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection-issues/)
- [Cómo configurar VPN en macOS](https://support.apple.com/guide/mac-help/set-up-a-vpn-connection-on-mac-mchlp2963/mac)
