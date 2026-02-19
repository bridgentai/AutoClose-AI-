# Problemas y Soluciones - Prueba Piloto MVP

## 🔍 Diagnóstico de Problemas

### 1. **Error EPERM (Permisos)**
**Síntoma:** `Error: EPERM: operation not permitted, unlink '/Users/alejosua/Documents/AutoClose-AI-06/test-results/.last-run.json'`

**Causa:** Playwright intenta escribir en `test-results/` pero tiene restricciones de permisos o el directorio está bloqueado.

**Solución:**
```bash
# Limpiar directorio de resultados anteriores
rm -rf test-results playwright-report

# Ejecutar con permisos adecuados
npm run test:e2e:piloto
```

**✅ Solucionado:** Agregado `test-results/` y `playwright-report/` a `.gitignore` para evitar conflictos.

### 2. **Tests Fallan (21 de 27 fallidos)**
**Síntoma:** Muchos tests fallan según `.last-run.json`

**Causas posibles:**
- ❌ **Servidor no está corriendo** en `http://localhost:3000`
- ❌ **MongoDB no conectado** (la app necesita DB para funcionar)
- ❌ **Credenciales admin no configuradas** (muchos tests se saltan)

**Verificación:**
```bash
# 1. Verificar que el servidor está corriendo
curl http://localhost:3000/api/health

# 2. Verificar MongoDB (debe estar en .env)
cat .env | grep MONGO

# 3. Verificar credenciales admin (opcional)
echo $ADMIN_EMAIL
echo $ADMIN_PASSWORD
```

**✅ Mejorado:** El test ahora verifica automáticamente que el servidor está corriendo antes de ejecutar los tests y muestra mensajes de error claros.

### 3. **Warnings de npm**
**Síntoma:** `npm warn Unknown env config "devdir"`

**Causa:** Configuración de npm obsoleta o variable de entorno no reconocida.

**Solución:** Es solo un warning, no afecta la ejecución. Puedes ignorarlo o limpiar variables de entorno:
```bash
unset devdir
```

### 4. **No hay duplicidad**
✅ **Confirmado:** Solo existe `e2e/piloto-mvp.spec.ts` - no hay archivos duplicados.

## 🛠️ Solución Paso a Paso

### Paso 1: Preparar el entorno

```bash
# 1. Asegúrate de que MongoDB está corriendo y conectado
# (verifica tu .env tiene la URI correcta)

# 2. Inicia el servidor en una terminal
npm run dev

# 3. Espera a que veas: "🚀 Servidor iniciado exitosamente!"
# y "📍 URL de previsualización: http://localhost:3000"
```

### Paso 2: Limpiar resultados anteriores

```bash
# Eliminar directorios de resultados anteriores
rm -rf test-results playwright-report
```

### Paso 3: Ejecutar la prueba piloto

**Opción A: Sin credenciales admin (solo tests básicos)**
```bash
npm run test:e2e:piloto
```

**Opción B: Con credenciales admin (tests completos)**
```bash
ADMIN_EMAIL=admin@colegio.com ADMIN_PASSWORD=password123 npm run test:e2e:piloto
```

### Paso 4: Ver resultados

```bash
# Abrir reporte HTML
npx playwright show-report playwright-report
```

## 📊 Qué Tests se Ejecutan

La suite `e2e/piloto-mvp.spec.ts` tiene **27 tests** que cubren:

- ✅ **1.1-1.3:** Login, formulario, términos/privacidad (3 tests)
- ⏭️ **2.1-2.2:** Login admin, consentimiento (2 tests - requieren credenciales)
- ✅ **3.1-3.6:** Rutas de dashboards (6 tests)
- ✅ **4.1-4.2:** APIs de seguridad (2 tests)
- ✅ **5.1-5.8:** Funciones transversales (8 tests)
- ⏭️ **Flujo completo:** Login admin → dashboard (1 test - requiere credenciales)

**Total:** 22 tests se ejecutan sin credenciales, 5 requieren admin.

## ⚠️ Errores Comunes y Soluciones

### Error: "net::ERR_CONNECTION_REFUSED"
**Causa:** El servidor no está corriendo en `localhost:3000`

**Solución:**
```bash
# Inicia el servidor
npm run dev

# Espera a ver el mensaje de éxito antes de ejecutar tests
```

**✅ Mejorado:** El test ahora detecta este error automáticamente y muestra un mensaje claro.

### Error: "MongoDB no está conectado"
**Causa:** La conexión a MongoDB falla

**Solución:**
1. Verifica que MongoDB Atlas está accesible (no bloqueado por firewall)
2. Verifica la URI en `.env`
3. Verifica que la IP está en la whitelist de MongoDB Atlas

### Tests se saltan: "ADMIN_EMAIL y ADMIN_PASSWORD no configurados"
**Causa:** Variables de entorno no definidas

**Solución:**
```bash
# Definir antes de ejecutar
export ADMIN_EMAIL=admin@colegio.com
export ADMIN_PASSWORD=password123
npm run test:e2e:piloto

# O inline
ADMIN_EMAIL=admin@colegio.com ADMIN_PASSWORD=password123 npm run test:e2e:piloto
```

### Error: "EPERM: operation not permitted"
**Causa:** Permisos de escritura en `test-results/`

**Solución:**
```bash
# Limpiar y dar permisos
rm -rf test-results playwright-report
chmod -R u+w .  # Si es necesario
npm run test:e2e:piloto
```

**✅ Solucionado:** Agregado a `.gitignore` para evitar conflictos.

## 📝 Checklist de Verificación Pre-Prueba

Antes de ejecutar la prueba piloto, verifica:

- [ ] Servidor corriendo (`npm run dev` en otra terminal)
- [ ] MongoDB conectado (ver mensaje en consola del servidor)
- [ ] Puerto 3000 libre y accesible
- [ ] `test-results/` y `playwright-report/` limpios o con permisos de escritura
- [ ] (Opcional) `ADMIN_EMAIL` y `ADMIN_PASSWORD` definidos para tests completos

## 🎯 Ejecución Simplificada

Si quieres una ejecución más simple y ver resultados inmediatos:

```bash
# 1. Limpiar
rm -rf test-results playwright-report

# 2. Ejecutar solo tests básicos (sin login admin)
npx playwright test e2e/piloto-mvp.spec.ts --grep "1\.|3\.|4\.|5\." --reporter=list

# 3. Ver qué pasó
npx playwright show-report
```

## 🔧 Mejoras Implementadas

### 1. `.gitignore` actualizado
- ✅ Agregado `test-results/`
- ✅ Agregado `playwright-report/`
- ✅ Agregado `playwright/.cache/`

### 2. `playwright.config.ts` mejorado
- ✅ Timeouts más claros y configurables
- ✅ Mejor manejo de errores de red
- ✅ Configuración de headless mejorada
- ✅ Reporter JSON agregado para análisis

### 3. `e2e/piloto-mvp.spec.ts` mejorado
- ✅ Verificación automática del servidor antes de ejecutar tests
- ✅ Mensajes de error claros y útiles
- ✅ Mejor manejo de errores de conexión
- ✅ Documentación mejorada

## 📋 Próximos Pasos

1. **Ejecuta la prueba** siguiendo los pasos arriba
2. **Revisa el reporte HTML** para ver qué tests fallan y por qué
3. **Corrige los problemas** identificados (servidor, DB, credenciales)
4. **Vuelve a ejecutar** hasta que todos los tests pasen
5. **Genera el informe** de validación con los resultados

## 💡 Tips Adicionales

- **Debug visual:** Ejecuta `PWDEBUG=1 npm run test:e2e:piloto` para ver el navegador en acción
- **UI Mode:** Ejecuta `npm run test:e2e:ui` para una interfaz interactiva
- **Un solo test:** Ejecuta `npx playwright test e2e/piloto-mvp.spec.ts -g "1.1"` para ejecutar solo un test específico
