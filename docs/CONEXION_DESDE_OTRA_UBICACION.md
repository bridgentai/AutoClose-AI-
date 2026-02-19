# Conexión a MongoDB desde otra ubicación

## Situación

- **MongoDB Atlas** está configurado con **0.0.0.0/0** (Allow access from anywhere).
- La conexión **sí funciona** desde tu ubicación actual.
- La conexión **no funciona** desde otra ubicación (otra red, otro país, servidor, oficina, etc.).

En ese caso **el problema no es la configuración de MongoDB** (0.0.0.0/0 ya permite todas las IPs). El bloqueo suele estar en la **red de esa otra ubicación**.

---

## Causas habituales

1. **Firewall de la red**  
   La red de esa ubicación bloquea tráfico saliente hacia MongoDB (puerto 27017 o conexiones TLS a `*.mongodb.net`).

2. **Red corporativa o institucional**  
   Empresas/universidades suelen restringir qué servicios se pueden usar (por puerto, dominio o tipo de tráfico).

3. **Proveedor de internet (ISP)**  
   Algunos ISPs filtran o limitan conexiones a ciertos destinos.

4. **Servidor de despliegue (VPS, cloud, serverless)**  
   El proveedor (Vercel, Railway, AWS, etc.) puede tener reglas de salida que bloquean MongoDB.

5. **VPN o proxy**  
   Una VPN/proxy en esa ubicación puede bloquear o alterar el tráfico a MongoDB.

---

## Cómo comprobarlo desde la ubicación que falla

Tienes que ejecutar estas pruebas **desde la misma red/máquina donde no conecta** (mismo edificio, mismo servidor, mismo VPN, etc.).

### 1. Resolución DNS

```bash
nslookup autoclosecluster.srcqfmb.mongodb.net
```

- Si **falla**: en esa red hay problemas de DNS o no se puede resolver el host de Atlas.
- Si **resuelve**: el problema no es DNS.

### 2. Conectividad al puerto (TLS)

MongoDB Atlas usa **puerto 443 (HTTPS/TLS)** para `mongodb+srv`. Probar si se puede abrir conexión:

```bash
# Sustituir HOST por uno de los que devuelve nslookup, por ejemplo:
# ac-0og32ah-shard-00-00.srcqfmb.mongodb.net
nc -zv ac-0og32ah-shard-00-00.srcqfmb.mongodb.net 443
```

En Windows (PowerShell):

```powershell
Test-NetConnection -ComputerName ac-0og32ah-shard-00-00.srcqfmb.mongodb.net -Port 443
```

- Si **timeout o “Connection refused”**: la red de esa ubicación está bloqueando el acceso a MongoDB Atlas.
- Si **conecta**: la red permite llegar a Atlas; entonces el fallo puede ser otro (certificados, credenciales, etc.).

### 3. Script de diagnóstico del proyecto

Desde la **misma máquina/red donde falla**:

```bash
npx ts-node --esm server/scripts/diagnose-mongodb.ts
```

Compara el resultado con el que obtienes desde donde **sí** conecta. Si desde la “ubicación mala” falla DNS o la conexión TCP a 443, el problema es de red en esa ubicación.

---

## Qué hacer según el caso

### Si es tu red (casa, oficina, otro país)

- Probar **otra red** (móvil, otro WiFi) para confirmar que es esa red la que bloquea.
- Si es red corporativa: pedir a TI que permitan tráfico saliente a:
  - Dominios: `*.mongodb.net`, `*.mongodb.com`
  - Puerto: **443** (TLS)
- Usar **VPN** hacia una red donde sí funcione (tu casa, otro país, etc.) solo como prueba; para uso estable es mejor que la red permita MongoDB.

### Si es un servidor (VPS, cloud, serverless)

- Revisar **reglas de firewall / security groups** del servidor: permitir **salida** a `*.mongodb.net` en puerto **443**.
- En entornos **serverless** (Vercel, etc.): comprobar que el plan/región no restringe conexiones salientes; algunos planes tienen restricciones de red.
- Comprobar que el servidor tiene **salida a internet** (por ejemplo `curl -I https://google.com`).

### Si es otra máquina en la misma red donde tú sí conectas

- Puede ser **firewall o antivirus** en esa máquina bloqueando Node o las conexiones salientes.
- Probar en esa máquina: mismo `nslookup`, mismo `nc -zv ... 443` y mismo script `diagnose-mongodb.ts`.

---

## Resumen

| Dónde funciona | Dónde no funciona | Conclusión |
|-----------------|-------------------|------------|
| Tu ubicación actual | Otra ubicación/red | La otra red (firewall, ISP, corporativo, servidor) está bloqueando el acceso a MongoDB. No es un problema de IP en Atlas (0.0.0.0/0 ya está bien). |

**Pasos útiles:**

1. Confirmar que en Atlas sigue **0.0.0.0/0** en Network Access (solo para tenerlo claro).
2. Ejecutar **desde la ubicación que falla** las pruebas anteriores (DNS, puerto 443, script de diagnóstico).
3. Según el resultado: abrir puerto 443 / permitir `*.mongodb.net` en esa red o servidor, o usar otra red/VPN solo para validar.

Si quieres, puedes pegar aquí el resultado de `nslookup` y de `nc -zv ... 443` (o del script) desde la ubicación que no conecta y lo revisamos paso a paso.
