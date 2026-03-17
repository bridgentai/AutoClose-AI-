import dns from 'dns';
import mongoose from 'mongoose';
// IMPORTANTE: Importar ENV asegura que .env se carga primero (env.ts carga dotenv)
import { ENV } from './env';

export let mongoConnected = false;
export let mongoError: string | null = null;

export async function connectDB(retries = 3) {
  const MONGO_URI = ENV.MONGO_URI?.trim();

  if (!MONGO_URI) {
    const error = '❌ Error: MONGO_URI no está configurado en las variables de entorno. Por favor configura MONGO_URI en el archivo .env de la raíz del proyecto con tu URL de MongoDB Atlas';
    console.error(error);
    mongoError = error;
    return; // No exit, permitir que la app arranque
  }

  // Validar formato básico
  if (!MONGO_URI.startsWith('mongodb://') && !MONGO_URI.startsWith('mongodb+srv://')) {
    const error = `❌ Error: MONGO_URI tiene formato inválido. Debe comenzar con mongodb:// o mongodb+srv://. Formato actual: ${MONGO_URI.substring(0, 30)}...`;
    console.error(error);
    mongoError = error;
    return; // No exit, permitir que la app arranque
  }

  // Verificar que no haya comillas o espacios extra
  const cleanURI = MONGO_URI.replace(/^["']|["']$/g, '').trim();
  if (cleanURI !== MONGO_URI) {
    console.warn('⚠️  Advertencia: MONGO_URI tenía comillas que fueron removidas');
  }

  try {
    console.log('🔄 Intentando conectar a MongoDB...');
    console.log(`📍 URI: ${MONGO_URI.substring(0, 50)}...`);

    // Si la red bloquea la resolución SRV (querySrv ECONNREFUSED), usar DNS público
    if (ENV.MONGODB_USE_PUBLIC_DNS && cleanURI.startsWith('mongodb+srv://')) {
      dns.setServers(['1.1.1.1', '8.8.8.8']);
      console.log('🌐 Usando DNS público (1.1.1.1, 8.8.8.8) para resolución SRV');
    }
    
    // Extraer información de la URI para diagnóstico
    try {
      const uriMatch = cleanURI.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
      if (uriMatch) {
        const [, username, password, cluster, database] = uriMatch;
        console.log('🔍 Diagnóstico de URI:');
        console.log(`   Usuario: ${username}`);
        console.log(`   Cluster: ${cluster}`);
        console.log(`   Base de datos: ${database}`);
        console.log(`   Contraseña: ${password.length} caracteres`);
        
        // Verificar si la contraseña necesita codificación URL
        if (password !== encodeURIComponent(password)) {
          console.warn('⚠️  La contraseña puede contener caracteres especiales que necesitan codificación URL');
        }
      }
    } catch (e) {
      // Ignorar errores de parsing, no es crítico
    }
    
    // Verificar que la URI no tenga caracteres problemáticos
    if (MONGO_URI.includes(' ') || MONGO_URI.includes('\n') || MONGO_URI.includes('\r')) {
      throw new Error('MONGO_URI contiene caracteres inválidos (espacios, saltos de línea). Verifica el archivo .env');
    }

    // Configuración mejorada de conexión (solo opciones soportadas por el driver actual)
    // NOTA: Si tienes problemas de certificados SSL, puedes temporalmente cambiar
    // tlsAllowInvalidCertificates a true, pero esto reduce la seguridad.
    // Mejor solución: actualizar certificados del sistema o Node.js
    const allowInvalidCerts = process.env.MONGO_ALLOW_INVALID_CERTS === 'true';
    if (allowInvalidCerts) {
      console.warn('⚠️  ADVERTENCIA: Verificación de certificados SSL deshabilitada');
      console.warn('   Esto reduce la seguridad. Solo para desarrollo temporal.');
    }
    
    const connectionOptions: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 30000, // Aumentado a 30 segundos
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 1,
      retryWrites: true,
      w: 'majority',
      // Opciones TLS/SSL para MongoDB Atlas
      tls: true,
      tlsAllowInvalidCertificates: allowInvalidCerts, // Solo si MONGO_ALLOW_INVALID_CERTS=true
      tlsAllowInvalidHostnames: false, // Por defecto false para seguridad
      // Opciones adicionales para redes problemáticas (ECONNRESET)
      heartbeatFrequencyMS: 10000, // Heartbeat cada 10 segundos para mantener conexión viva
    };

    console.log('⚙️  Opciones de conexión:', {
      serverSelectionTimeoutMS: connectionOptions.serverSelectionTimeoutMS,
      socketTimeoutMS: connectionOptions.socketTimeoutMS,
      connectTimeoutMS: connectionOptions.connectTimeoutMS,
    });

    // Intentar conectar con retry (aumentado para redes problemáticas)
    let lastError: any = null;
    const maxRetries = retries;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 Intento ${attempt} de ${maxRetries}...`);
          // Esperar antes de reintentar (backoff exponencial)
          const waitTime = Math.min(2000 * attempt, 10000); // Máximo 10 segundos
          console.log(`   Esperando ${waitTime/1000}s antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // Cerrar cualquier conexión previa antes de intentar
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close().catch(() => {});
          // Esperar un momento para que se cierre completamente
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        await mongoose.connect(cleanURI, connectionOptions);
        break; // Si conecta exitosamente, salir del loop
      } catch (attemptError: any) {
        lastError = attemptError;
        const isConnectionReset = attemptError.message?.includes('ECONNRESET') || 
                                   attemptError.message?.includes('ECONNREFUSED') ||
                                   attemptError.code === 'ECONNRESET' ||
                                   attemptError.code === 'ECONNREFUSED';
        
        if (attempt < maxRetries) {
          if (isConnectionReset) {
            console.warn(`⚠️  Intento ${attempt} falló: Conexión reseteada por la red`);
            console.warn(`   Esto sugiere que la red está bloqueando/interrumpiendo la conexión`);
          } else {
            console.warn(`⚠️  Intento ${attempt} falló: ${attemptError.message}`);
          }
          
          // Cerrar cualquier conexión parcial antes de reintentar
          if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close().catch(() => {});
          }
        }
      }
    }

    // Si falló con querySrv ECONNREFUSED y hay URI directa, intentar con ella (evita DNS SRV)
    const directUri = ENV.MONGODB_URI_DIRECT?.trim();
    const isQuerySrvRefused = lastError?.message?.includes('querySrv') && (lastError?.code === 'ECONNREFUSED' || lastError?.message?.includes('ECONNREFUSED'));
    if ((!mongoose.connection.readyState || mongoose.connection.readyState === 0) && directUri && directUri.startsWith('mongodb://') && isQuerySrvRefused) {
      console.log('🔄 Fallo en resolución SRV; intentando con URI directa (MONGODB_URI_DIRECT)...');
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      try {
        await mongoose.connect(directUri.replace(/^["']|["']$/g, '').trim(), connectionOptions);
      } catch (directError: any) {
        throw directError;
      }
    }

    // Si después de todos los intentos aún falla, lanzar el último error
    if (!mongoose.connection.readyState || mongoose.connection.readyState === 0) {
      throw lastError || new Error('No se pudo conectar después de múltiples intentos');
    }
    
    console.log('✅ MongoDB conectado exitosamente a EvoOS');
    console.log(`📊 Base de datos: ${mongoose.connection.db?.databaseName || 'autoclose_ai'}`);
    console.log(`🔗 Host: ${mongoose.connection.host || 'N/A'}`);
    console.log(`🔌 Puerto: ${mongoose.connection.port || 'N/A'}`);
    console.log(`📡 Estado: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`);
    
    mongoConnected = true;
    mongoError = null;

    // Manejar eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de MongoDB:', err);
      mongoConnected = false;
      mongoError = err.message;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado');
      mongoConnected = false;
      mongoError = 'MongoDB desconectado';
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconectado');
      mongoConnected = true;
      mongoError = null;
    });

    mongoose.connection.on('connecting', () => {
      console.log('🔄 Conectando a MongoDB...');
    });

    mongoose.connection.on('connected', () => {
      console.log('✅ Evento: MongoDB conectado');
    });

  } catch (error: any) {
    const errorMsg = `❌ Error conectando a MongoDB: ${error.message}`;
    console.error(errorMsg);
    console.error('📋 Tipo de error:', error.constructor.name);
    console.error('📋 Código de error:', error.code || 'N/A');
    console.error('📋 Stack completo:', error.stack);
    
    // Información adicional para debugging
    if (error.reason) {
      console.error('📋 Razón del error:', error.reason);
    }
    if (error.cause) {
      console.error('📋 Causa del error:', error.cause);
    }

    // Diagnóstico detallado del error
    console.error('\n🔍 DIAGNÓSTICO DETALLADO:');
    
    // Verificar si es un error de red
    if (error.name === 'MongoNetworkError' || error.message.includes('network')) {
      console.error('❌ Error de red detectado');
      console.error('   Esto puede indicar:');
      console.error('   1. El cluster está PAUSADO (más probable en clusters gratuitos)');
      console.error('   2. Problema de firewall o red');
      console.error('   3. La IP no está en la whitelist (aunque tengas 0.0.0.0/0)');
    }
    
    // Verificar si es ReplicaSetNoPrimary
    if (error.reason?.type === 'ReplicaSetNoPrimary' || error.message.includes('ReplicaSetNoPrimary')) {
      console.error('\n❌ ERROR: ReplicaSetNoPrimary');
      console.error('   Este error indica que MongoDB no puede encontrar un servidor primario.');
      console.error('   CAUSAS MÁS PROBABLES:');
      console.error('   1. ⚠️  CLUSTER PAUSADO (más común en clusters gratuitos)');
      console.error('      → Ve a https://cloud.mongodb.com/');
      console.error('      → Verifica el estado del cluster');
      console.error('      → Si está pausado, haz clic en "Resume"');
      console.error('      → Espera 2-5 minutos y reinicia el servidor');
      console.error('');
      console.error('   2. Cluster en estado de transición');
      console.error('      → El cluster puede estar actualizándose o migrando');
      console.error('      → Espera a que termine la operación');
      console.error('');
      console.error('   3. Problema de credenciales');
      console.error('      → Verifica que el usuario existe en Database Access');
      console.error('      → Verifica que la contraseña sea correcta');
      console.error('      → Si la contraseña tiene caracteres especiales, codifícalos en URL');
      console.error('');
      console.error('   4. Problema de DNS/Red');
      console.error('      → Verifica tu conexión a internet');
      console.error('      → Prueba resolver el DNS: nslookup autoclosecluster.srcqfmb.mongodb.net');
    }
    
    // Sugerencias específicas según el tipo de error
    if (error.message.includes('authentication failed')) {
      console.error('💡 SUGERENCIA: Verifica las credenciales (usuario y contraseña) en MONGO_URI');
      console.error('   Si la contraseña tiene caracteres especiales (@, :, /, etc.), codifícalos en URL');
    } else if (error.message.includes('whitelist')) {
      console.error('💡 SUGERENCIA: Verifica que tu IP esté en la whitelist de MongoDB Atlas');
      console.error('   Ve a: Network Access → Add IP Address → 0.0.0.0/0 (Allow access from anywhere)');
      console.error('');
      console.error('   Si ya tienes 0.0.0.0/0 y conecta desde otra ubicación pero no desde esta:');
      console.error('   el bloqueo suele estar en ESTA red (firewall, ISP, corporativo).');
      console.error('   Ver: docs/CONEXION_DESDE_OTRA_UBICACION.md');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('💡 SUGERENCIA: Verifica que el nombre del cluster sea correcto en MONGO_URI');
      console.error('   El nombre del cluster puede haber cambiado en MongoDB Atlas');
    }
    
    // Verificar si es un error de certificados SSL/TLS
    const isSSLError = error.message.includes('certificate') || 
                       error.message.includes('unable to verify') ||
                       (error.reason?.servers && Array.from(error.reason.servers.values()).some((s: any) => 
                         s.error?.message?.includes('certificate') || 
                         s.error?.message?.includes('unable to verify')
                       ));
    
    if (isSSLError) {
      console.error('\n🔒 ERROR DE CERTIFICADOS SSL/TLS DETECTADO');
      console.error('   El problema es con la verificación de certificados SSL, no con el cluster.');
      console.error('   El cluster está activo pero Node.js no puede verificar el certificado.');
      console.error('');
      console.error('   SOLUCIONES (en orden de preferencia):');
      console.error('');
      console.error('   1. Actualizar certificados del sistema (RECOMENDADO):');
      console.error('      macOS:');
      console.error('        brew install ca-certificates');
      console.error('        sudo update-ca-certificates');
      console.error('');
      console.error('   2. Usar certificados del sistema en Node.js:');
      console.error('      Ejecuta Node.js con: NODE_EXTRA_CA_CERTS=/path/to/ca-bundle.crt node ...');
      console.error('      O configura la variable de entorno NODE_EXTRA_CA_CERTS');
      console.error('');
      console.error('   3. Actualizar Node.js a la última versión:');
      console.error('      Las versiones más recientes tienen mejor soporte de certificados');
      console.error('');
      console.error('   4. Solución temporal (NO RECOMENDADO para producción):');
      console.error('      Si necesitas una solución rápida temporal, puedes modificar');
      console.error('      server/config/db.ts y cambiar tlsAllowInvalidCertificates a true');
      console.error('      ⚠️  Esto reduce la seguridad y solo debe usarse para desarrollo');
    }
    
    // Detectar específicamente ECONNRESET (conexión reseteada)
    const hasECONNRESET = error.message.includes('ECONNRESET') || 
                          error.message.includes('ECONNREFUSED') ||
                          (error.reason?.servers && Array.from(error.reason.servers.values()).some((s: any) => 
                            s.error?.message?.includes('ECONNRESET') ||
                            s.error?.message?.includes('ECONNREFUSED') ||
                            s.error?.code === 'ECONNRESET' ||
                            s.error?.code === 'ECONNREFUSED'
                          ));
    
    // querySrv ECONNREFUSED = la resolución DNS del SRV de Atlas falla (red/DNS bloquean)
    if (error.message?.includes('querySrv') && (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED'))) {
      console.error('\n🔍 ERROR: querySrv ECONNREFUSED (resolución DNS SRV bloqueada)');
      console.error('   La red o el DNS no permiten resolver _mongodb._tcp.<cluster>.mongodb.net');
      console.error('');
      console.error('   PRUEBA EN .env (una o ambas):');
      console.error('   1. MONGODB_USE_PUBLIC_DNS=true   → usa DNS 1.1.1.1 / 8.8.8.8 para resolver SRV');
      console.error('   2. MONGODB_URI_DIRECT=mongodb://usuario:pass@host:27017/autoclose_ai?ssl=true');
      console.error('      → Obtén el host en Atlas: Connect → Drivers → ver "Direct connection"');
    }
    
    if (hasECONNRESET) {
      console.error('\n🔌 ERROR: ECONNRESET / ECONNREFUSED DETECTADO');
      console.error('   La conexión se establece pero luego se cierra/resetea.');
      console.error('   Esto indica que la RED de esta ubicación está bloqueando/interrumpiendo');
      console.error('   las conexiones a MongoDB después de establecerlas.');
      console.error('');
      console.error('   CAUSAS COMUNES:');
      console.error('   1. 🔥 Firewall/Proxy intermedio que corta conexiones de larga duración');
      console.error('   2. 🌐 ISP que bloquea o limita conexiones a MongoDB');
      console.error('   3. 🏢 Red corporativa con políticas restrictivas');
      console.error('   4. ⏱️  Timeout muy corto en la red (aunque MongoDB usa keepalive)');
      console.error('');
      console.error('   SOLUCIONES:');
      console.error('   1. Usar VPN desde esta ubicación hacia una red que funcione');
      console.error('   2. Contactar al administrador de red para permitir conexiones a:');
      console.error('      - *.mongodb.net (puerto 443 para mongodb+srv)');
      console.error('      - *.mongodb.net (puerto 27017 para conexiones directas)');
      console.error('   3. Probar con datos móviles (hotspot) para confirmar que es la red');
      console.error('   4. Si es un servidor/VPS, verificar firewall del servidor');
      console.error('');
      console.error('   SOLUCIÓN TEMPORAL: Agregar opciones de conexión más resilientes');
      console.error('   (ya implementado: retries aumentados y timeouts más largos)');
    }
    
    // Información adicional sobre los servidores que intentó conectar
    if (error.reason?.servers) {
      console.error('\n📡 Servidores que intentó conectar:');
      const servers = Array.from(error.reason.servers.values());
      servers.forEach((server: any) => {
        console.error(`   - ${server.address}`);
        if (server.error) {
          const errorMsg = server.error.message || server.error;
          const errorCode = server.error.code || '';
          console.error(`     Error: ${errorMsg}${errorCode ? ` (${errorCode})` : ''}`);
          
          // Detectar específicamente errores de certificado en servidores individuales
          if (errorMsg.includes('certificate') || errorMsg.includes('unable to verify')) {
            console.error(`     ⚠️  Error de certificado SSL detectado`);
          }
          
          // Detectar ECONNRESET específicamente
          if (errorMsg.includes('ECONNRESET') || errorCode === 'ECONNRESET') {
            console.error(`     🔌 Conexión reseteada por la red`);
          }
          
          if (errorMsg.includes('ECONNREFUSED') || errorCode === 'ECONNREFUSED') {
            console.error(`     🚫 Conexión rechazada por la red`);
          }
        }
        if (server.type) {
          console.error(`     Tipo: ${server.type}`);
        }
      });
    }
    
    mongoError = errorMsg;
    // No exit, permitir que la app arranque en modo degradado
  }
}

export { mongoose };
