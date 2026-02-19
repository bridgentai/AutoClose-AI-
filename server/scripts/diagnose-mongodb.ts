#!/usr/bin/env ts-node
/**
 * Script de diagnóstico para MongoDB Atlas
 * 
 * Este script ayuda a diagnosticar problemas de conexión a MongoDB Atlas
 * ejecutando pruebas independientes sin necesidad de iniciar el servidor completo.
 * 
 * Uso: npx ts-node server/scripts/diagnose-mongodb.ts
 */

import mongoose from 'mongoose';
import * as dns from 'dns';
import { promisify } from 'util';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

const resolve4 = promisify(dns.resolve4);
const lookup = promisify(dns.lookup);

async function diagnoseMongoDB() {
  console.log('🔍 DIAGNÓSTICO DE CONEXIÓN A MONGODB ATLAS\n');
  console.log('='.repeat(60));
  
  const MONGO_URI = process.env.MONGO_URI?.trim();
  
  if (!MONGO_URI) {
    console.error('❌ Error: MONGO_URI no está configurado en .env');
    process.exit(1);
  }
  
  console.log('\n1️⃣  VERIFICACIÓN DE URI');
  console.log('-'.repeat(60));
  console.log(`URI completa: ${MONGO_URI.substring(0, 80)}...`);
  
  // Extraer información de la URI
  const uriMatch = MONGO_URI.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
  if (!uriMatch) {
    console.error('❌ Error: Formato de URI inválido');
    console.error('   Debe ser: mongodb+srv://usuario:contraseña@cluster.mongodb.net/base_datos');
    process.exit(1);
  }
  
  const [, username, password, cluster, database] = uriMatch;
  console.log(`   Usuario: ${username}`);
  console.log(`   Cluster: ${cluster}`);
  console.log(`   Base de datos: ${database}`);
  console.log(`   Longitud de contraseña: ${password.length} caracteres`);
  
  // Verificar codificación de contraseña
  if (password !== encodeURIComponent(password)) {
    console.warn('⚠️  La contraseña contiene caracteres que pueden necesitar codificación URL');
    console.warn('   Caracteres especiales comunes: @ → %40, : → %3A, / → %2F');
  }
  
  console.log('\n2️⃣  VERIFICACIÓN DE DNS');
  console.log('-'.repeat(60));
  try {
    console.log(`Resolviendo DNS para: ${cluster}...`);
    const addresses = await resolve4(cluster);
    console.log(`✅ DNS resuelto correctamente`);
    console.log(`   Direcciones IP encontradas: ${addresses.length}`);
    addresses.slice(0, 3).forEach((addr, i) => {
      console.log(`   ${i + 1}. ${addr}`);
    });
  } catch (error: any) {
    console.error(`❌ Error resolviendo DNS: ${error.message}`);
    console.error('   Esto indica un problema de red o que el cluster no existe');
  }
  
  console.log('\n3️⃣  VERIFICACIÓN DE CONECTIVIDAD');
  console.log('-'.repeat(60));
  try {
    console.log(`Verificando conectividad a: ${cluster}...`);
    const lookupResult = await lookup(cluster);
    console.log(`✅ Conectividad OK`);
    console.log(`   IP: ${lookupResult.address}`);
    console.log(`   Familia: IPv${lookupResult.family}`);
  } catch (error: any) {
    console.error(`❌ Error de conectividad: ${error.message}`);
  }
  
  console.log('\n4️⃣  INTENTO DE CONEXIÓN A MONGODB');
  console.log('-'.repeat(60));
  console.log('Intentando conectar con Mongoose...');
  
  // Detectar si hay problemas de certificados SSL
  const allowInvalidCerts = process.env.MONGO_ALLOW_INVALID_CERTS === 'true';
  if (allowInvalidCerts) {
    console.warn('⚠️  ADVERTENCIA: Verificación de certificados SSL deshabilitada para esta prueba');
  }
  
  const connectionOptions: mongoose.ConnectOptions = {
    serverSelectionTimeoutMS: 10000, // 10 segundos para diagnóstico rápido
    socketTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    tls: true,
    tlsAllowInvalidCertificates: allowInvalidCerts,
    tlsAllowInvalidHostnames: false,
  };
  
  try {
    await mongoose.connect(MONGO_URI, connectionOptions);
    
    console.log('✅ CONEXIÓN EXITOSA');
    console.log(`   Base de datos: ${mongoose.connection.db?.databaseName}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Puerto: ${mongoose.connection.port}`);
    console.log(`   Estado: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`);
    
    // Probar una operación simple
    try {
      const collections = await mongoose.connection.db?.listCollections().toArray();
      console.log(`   Colecciones encontradas: ${collections?.length || 0}`);
    } catch (e) {
      console.warn('   No se pudo listar colecciones (puede ser normal)');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ DIAGNÓSTICO COMPLETADO: Conexión funcionando correctamente');
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ ERROR DE CONEXIÓN');
    console.error('-'.repeat(60));
    console.error(`Tipo: ${error.constructor.name}`);
    console.error(`Mensaje: ${error.message}`);
    
    if (error.code) {
      console.error(`Código: ${error.code}`);
    }
    
    // Análisis específico del error
    console.error('\n🔍 ANÁLISIS DEL ERROR:');
    
      // Verificar si es un error de certificados SSL
      const isSSLError = error.message.includes('certificate') || 
                         error.message.includes('unable to verify') ||
                         (error.reason?.servers && Array.from(error.reason.servers.values()).some((s: any) => 
                           s.error?.message?.includes('certificate') || 
                           s.error?.message?.includes('unable to verify')
                         ));
      
      if (isSSLError) {
        console.error('\n   🔒 ERROR DE CERTIFICADOS SSL/TLS');
        console.error('   El cluster está activo pero Node.js no puede verificar el certificado SSL.');
        console.error('');
        console.error('   SOLUCIONES:');
        console.error('');
        console.error('   1. Actualizar certificados del sistema (RECOMENDADO):');
        console.error('      macOS:');
        console.error('        brew install ca-certificates');
        console.error('        sudo update-ca-certificates');
        console.error('');
        console.error('   2. Actualizar Node.js:');
        console.error('      Las versiones más recientes tienen mejor soporte de certificados');
        console.error('      nvm install node  # o descarga desde nodejs.org');
        console.error('');
        console.error('   3. Solución temporal (solo desarrollo):');
        console.error('      Agrega al .env: MONGO_ALLOW_INVALID_CERTS=true');
        console.error('      ⚠️  Esto reduce la seguridad - solo para desarrollo');
        console.error('');
        console.error('   4. Usar certificados del sistema:');
        console.error('      NODE_EXTRA_CA_CERTS=/path/to/ca-bundle.crt npx ts-node ...');
      }
      
      if (error.name === 'MongoServerSelectionError' || error.name === 'MongooseServerSelectionError') {
      console.error('   Este error indica que Mongoose no puede seleccionar un servidor.');
      
      if (error.reason?.type === 'ReplicaSetNoPrimary') {
        console.error('\n   ⚠️  CAUSA MÁS PROBABLE: Cluster pausado');
        console.error('   Los clusters gratuitos de MongoDB Atlas se pausan automáticamente');
        console.error('   después de períodos de inactividad.');
        console.error('\n   SOLUCIÓN:');
        console.error('   1. Ve a https://cloud.mongodb.com/');
        console.error('   2. Inicia sesión con tu cuenta');
        console.error('   3. Ve a "Clusters" en el menú lateral');
        console.error('   4. Busca tu cluster y verifica su estado');
        console.error('   5. Si está pausado, haz clic en "Resume" o "Resume Cluster"');
        console.error('   6. Espera 2-5 minutos a que el cluster se reactive');
        console.error('   7. Ejecuta este script nuevamente para verificar');
      }
      
      if (error.message.includes('whitelist')) {
        console.error('\n   ⚠️  CAUSA: IP no está en la whitelist');
        console.error('   SOLUCIÓN:');
        console.error('   1. Ve a MongoDB Atlas → Network Access');
        console.error('   2. Haz clic en "Add IP Address"');
        console.error('   3. Selecciona "Allow access from anywhere" (0.0.0.0/0)');
        console.error('   4. O agrega tu IP específica');
      }
      
      if (error.message.includes('authentication')) {
        console.error('\n   ⚠️  CAUSA: Credenciales incorrectas');
        console.error('   SOLUCIÓN:');
        console.error('   1. Ve a MongoDB Atlas → Database Access');
        console.error('   2. Verifica que el usuario existe');
        console.error('   3. Verifica que la contraseña sea correcta');
        console.error('   4. Si la contraseña tiene caracteres especiales, codifícalos en URL');
      }
    }
    
    if (error.name === 'MongoNetworkError') {
      console.error('   Este error indica un problema de red.');
      console.error('   Puede ser:');
      console.error('   - Cluster pausado');
      console.error('   - Firewall bloqueando conexiones');
      console.error('   - Problema de DNS');
    }
    
    // Mostrar información de servidores si está disponible
    if (error.reason?.servers) {
      console.error('\n📡 Servidores que intentó conectar:');
      const servers = Array.from(error.reason.servers.values());
      servers.forEach((server: any) => {
        console.error(`   - ${server.address}`);
        if (server.error) {
          console.error(`     Error: ${server.error.message || server.error}`);
        }
        if (server.type) {
          console.error(`     Tipo: ${server.type}`);
        }
      });
    }
    
    console.error('\n❌ DIAGNÓSTICO COMPLETADO: Se encontraron problemas de conexión');
    console.error('   Revisa las sugerencias arriba para resolver el problema.');
    process.exit(1);
  }
}

// Ejecutar diagnóstico
diagnoseMongoDB().catch((error) => {
  console.error('❌ Error inesperado:', error);
  process.exit(1);
});
