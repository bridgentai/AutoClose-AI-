#!/usr/bin/env ts-node
/**
 * Script de prueba agresiva de conexión a MongoDB Atlas
 * Prueba múltiples estrategias de conexión para diagnosticar problemas
 */

import mongoose from 'mongoose';
import * as dns from 'dns';
import { promisify } from 'util';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const resolve4 = promisify(dns.resolve4);
const lookup = promisify(dns.lookup);

async function testConnection() {
  console.log('🧪 PRUEBA AGRESIVA DE CONEXIÓN A MONGODB ATLAS\n');
  console.log('='.repeat(70));
  
  const MONGO_URI = process.env.MONGO_URI?.trim();
  
  if (!MONGO_URI) {
    console.error('❌ Error: MONGO_URI no está configurado');
    process.exit(1);
  }
  
  // Extraer información
  const uriMatch = MONGO_URI.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
  if (!uriMatch) {
    console.error('❌ Error: Formato de URI inválido');
    process.exit(1);
  }
  
  const [, username, password, cluster, database] = uriMatch;
  
  console.log('\n📋 INFORMACIÓN DE CONEXIÓN:');
  console.log(`   Cluster: ${cluster}`);
  console.log(`   Base de datos: ${database}`);
  console.log(`   Usuario: ${username}`);
  console.log(`   MONGO_ALLOW_INVALID_CERTS: ${process.env.MONGO_ALLOW_INVALID_CERTS || 'false'}`);
  
  // Prueba 1: DNS con múltiples métodos
  console.log('\n1️⃣  PRUEBA DE DNS');
  console.log('-'.repeat(70));
  
  let dnsResolved = false;
  
  // Método 1: resolve4 (A records)
  try {
    const addresses = await resolve4(cluster);
    console.log(`✅ DNS resuelto (A records): ${addresses.length} direcciones encontradas`);
    addresses.slice(0, 3).forEach((addr, i) => {
      console.log(`   ${i + 1}. ${addr}`);
    });
    dnsResolved = true;
  } catch (error: any) {
    console.error(`❌ Error DNS (A records): ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}`);
    
    if (error.code === 'ENODATA') {
      console.error('\n   ⚠️  ENODATA: El DNS no tiene registros para este dominio');
      console.error('   Esto puede indicar:');
      console.error('   1. Problema con los servidores DNS configurados');
      console.error('   2. El dominio está bloqueado por el DNS');
      console.error('   3. Problema temporal de resolución DNS');
    }
  }
  
  // Método 2: lookup (más robusto, usa getaddrinfo)
  try {
    const lookupResult = await lookup(cluster);
    console.log(`\n✅ DNS resuelto (lookup): ${lookupResult.address}`);
    console.log(`   Familia: IPv${lookupResult.family}`);
    dnsResolved = true;
  } catch (error: any) {
    console.error(`\n❌ Error DNS (lookup): ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}`);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      console.error('\n   🔍 DIAGNÓSTICO:');
      console.error('   El DNS no puede resolver el dominio del cluster.');
      console.error('   Esto NO es un problema de MongoDB Atlas, es un problema de DNS.');
      console.error('');
      console.error('   SOLUCIONES:');
      console.error('   1. Cambiar servidores DNS:');
      console.error('      macOS: System Preferences → Network → Advanced → DNS');
      console.error('      Agrega: 8.8.8.8 (Google) o 1.1.1.1 (Cloudflare)');
      console.error('');
      console.error('   2. Verificar configuración de red:');
      console.error('      Puede haber un proxy o VPN interfiriendo');
      console.error('');
      console.error('   3. Probar desde terminal:');
      console.error(`      nslookup ${cluster}`);
      console.error(`      dig ${cluster}`);
      console.error('');
      console.error('   4. Reiniciar servicios de red:');
      console.error('      sudo dscacheutil -flushcache  # macOS');
      console.error('      sudo killall -HUP mDNSResponder  # macOS');
    }
  }
  
  if (!dnsResolved) {
    console.error('\n❌ NO SE PUDO RESOLVER EL DNS');
    console.error('   Sin resolución DNS, no se puede conectar a MongoDB.');
    console.error('   El problema está en la configuración de DNS de esta máquina/red.');
    console.error('');
    console.error('   PRÓXIMOS PASOS:');
    console.error('   1. Cambia los servidores DNS (ver arriba)');
    console.error('   2. Prueba: nslookup autoclosecluster.srcqfmb.mongodb.net');
    console.error('   3. Si funciona desde otra ubicación, compara la configuración DNS');
    process.exit(1);
  }
  
  // Prueba 2: Conectividad básica
  console.log('\n2️⃣  PRUEBA DE CONECTIVIDAD');
  console.log('-'.repeat(70));
  try {
    const lookupResult = await lookup(cluster);
    console.log(`✅ Conectividad básica OK`);
    console.log(`   IP: ${lookupResult.address}`);
  } catch (error: any) {
    console.error(`❌ Error de conectividad: ${error.message}`);
  }
  
  // Prueba 3: Conexión con opciones mínimas
  console.log('\n3️⃣  PRUEBA 1: Conexión con opciones mínimas');
  console.log('-'.repeat(70));
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    console.log('✅ CONEXIÓN EXITOSA con opciones mínimas');
    await mongoose.disconnect();
  } catch (error: any) {
    console.error(`❌ Falló: ${error.message}`);
    console.error(`   Tipo: ${error.constructor.name}`);
  }
  
  // Prueba 4: Conexión con opciones estándar
  console.log('\n4️⃣  PRUEBA 2: Conexión con opciones estándar');
  console.log('-'.repeat(70));
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority',
    });
    console.log('✅ CONEXIÓN EXITOSA con opciones estándar');
    await mongoose.disconnect();
  } catch (error: any) {
    console.error(`❌ Falló: ${error.message}`);
    console.error(`   Tipo: ${error.constructor.name}`);
    
    // Mostrar detalles del error
    if (error.reason?.servers) {
      console.error('\n   Servidores intentados:');
      const servers = Array.from(error.reason.servers.values());
      servers.forEach((server: any) => {
        console.error(`   - ${server.address}`);
        if (server.error) {
          console.error(`     Error: ${server.error.message || server.error}`);
        }
      });
    }
  }
  
  // Prueba 5: Conexión con TLS relajado
  console.log('\n5️⃣  PRUEBA 3: Conexión con TLS relajado');
  console.log('-'.repeat(70));
  const allowInvalidCerts = process.env.MONGO_ALLOW_INVALID_CERTS === 'true';
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      tls: true,
      tlsAllowInvalidCertificates: true, // Forzar true para esta prueba
      tlsAllowInvalidHostnames: true, // También relajar hostname
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority',
    });
    console.log('✅ CONEXIÓN EXITOSA con TLS relajado');
    await mongoose.disconnect();
  } catch (error: any) {
    console.error(`❌ Falló: ${error.message}`);
    console.error(`   Tipo: ${error.constructor.name}`);
    
    if (error.reason?.servers) {
      console.error('\n   Servidores intentados:');
      const servers = Array.from(error.reason.servers.values());
      servers.forEach((server: any) => {
        console.error(`   - ${server.address}`);
        if (server.error) {
          const errMsg = server.error.message || server.error;
          console.error(`     Error: ${errMsg}`);
          
          if (errMsg.includes('ECONNRESET')) {
            console.error(`     🔌 Conexión reseteada por la red`);
          }
          if (errMsg.includes('ECONNREFUSED')) {
            console.error(`     🚫 Conexión rechazada`);
          }
          if (errMsg.includes('timeout')) {
            console.error(`     ⏱️  Timeout - la red está muy lenta o bloqueando`);
          }
        }
      });
    }
  }
  
  // Prueba 6: Conexión con múltiples reintentos
  console.log('\n6️⃣  PRUEBA 4: Conexión con múltiples reintentos');
  console.log('-'.repeat(70));
  let connected = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`   Intento ${attempt} de 5...`);
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 15000,
        tls: true,
        tlsAllowInvalidCertificates: true,
        tlsAllowInvalidHostnames: true,
      });
      console.log(`✅ CONEXIÓN EXITOSA en intento ${attempt}`);
      connected = true;
      await mongoose.disconnect();
      break;
    } catch (error: any) {
      if (attempt < 5) {
        console.log(`   Intento ${attempt} falló: ${error.message.substring(0, 60)}...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close().catch(() => {});
        }
      } else {
        console.error(`❌ Todos los intentos fallaron`);
        console.error(`   Último error: ${error.message}`);
      }
    }
  }
  
  // Resumen
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN');
  console.log('='.repeat(70));
  
  if (connected) {
    console.log('✅ AL MENOS UNA PRUEBA FUE EXITOSA');
    console.log('   El problema puede ser de configuración específica.');
    console.log('   Revisa qué prueba funcionó y usa esas opciones.');
  } else {
    console.log('❌ TODAS LAS PRUEBAS FALLARON');
    console.log('');
    console.log('   Esto sugiere que:');
    console.log('   1. La red está bloqueando completamente MongoDB');
    console.log('   2. El cluster tiene problemas (aunque muestre activo)');
    console.log('   3. Las credenciales son incorrectas');
    console.log('   4. Hay un problema temporal de MongoDB Atlas');
    console.log('');
    console.log('   PRÓXIMOS PASOS:');
    console.log('   1. Verifica las credenciales en MongoDB Atlas → Database Access');
    console.log('   2. Prueba con MongoDB Compass desde esta misma máquina');
    console.log('   3. Verifica que el cluster realmente esté activo (puede mostrar activo pero tener problemas)');
    console.log('   4. Intenta desde otra red/máquina para confirmar');
  }
  
  process.exit(connected ? 0 : 1);
}

testConnection().catch((error) => {
  console.error('❌ Error inesperado:', error);
  process.exit(1);
});
