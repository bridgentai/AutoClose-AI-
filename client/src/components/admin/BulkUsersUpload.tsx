import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useInstitutionColors } from '@/hooks/useInstitutionColors';
import { Upload, FileSpreadsheet, ClipboardPaste, CheckCircle, XCircle, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';

export interface BulkRowInput {
  nombre: string;
  apellido?: string;
  email: string;
  rol: string;
  codigo_interno?: string;
  curso_grupo?: string;
}

interface BulkCreatedItem {
  email: string;
  passwordGenerated: string;
  codigoInterno: string;
  colegioId: string;
  nombre: string;
  rol: string;
  rowIndex: number;
}

interface BulkFailedItem {
  rowIndex: number;
  email?: string;
  error: string;
}

interface BulkResult {
  summary: { created: number; failed: number; total: number };
  created: BulkCreatedItem[];
  failed: BulkFailedItem[];
}

function normalizeHeader(h: string): string {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function mapRow(obj: Record<string, unknown>): BulkRowInput | null {
  const keys = Object.keys(obj).map(normalizeHeader);
  const get = (variants: string[]) => {
    for (const v of variants) {
      const i = keys.indexOf(v);
      if (i >= 0) {
        const raw = Object.values(obj)[i];
        return raw != null ? String(raw).trim() : '';
      }
    }
    return '';
  };
  const nombre = get(['nombre', 'nombre_s', 'first_name', 'nombres']);
  const apellido = get(['apellido', 'apellidos', 'last_name']);
  const email = get(['email', 'correo', 'e-mail', 'mail']);
  const rol = get(['rol', 'role', 'tipo', 'tipo_usuario']);
  const codigo_interno = get(['codigo_interno', 'codigo', 'codigo_interno', 'matricula', 'codigo_profesor']);
  const curso_grupo = get(['curso_grupo', 'curso', 'grupo', 'curso_grupo', 'grado']);

  if (!email && !nombre && !rol) return null;
  const fullName = nombre || get(['nombre_completo', 'full_name']);
  const finalNombre = nombre || (fullName && !apellido ? fullName.split(/\s+/).slice(0, -1).join(' ') : '') || fullName;
  const finalApellido = apellido || (fullName && fullName !== finalNombre ? fullName.replace(finalNombre, '').trim() : '');

  return {
    nombre: finalNombre || ' ',
    apellido: finalApellido || undefined,
    email: email || ' ',
    rol: rol || ' ',
    codigo_interno: codigo_interno || undefined,
    curso_grupo: curso_grupo || undefined,
  };
}

function parseSheet(file: File): Promise<BulkRowInput[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return reject(new Error('No se pudo leer el archivo'));
        const wb = XLSX.read(data, { type: 'binary' });
        const first = wb.SheetNames[0];
        if (!first) return resolve([]);
        const sheet = wb.Sheets[first];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const rows = json.map(mapRow).filter((r): r is BulkRowInput => r != null && r.email !== ' ' && r.nombre !== ' ');
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsBinaryString(file);
  });
}

function parsePaste(text: string): BulkRowInput[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const rows: BulkRowInput[] = [];
  const headers = lines[0].split(sep).map(normalizeHeader);
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep);
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => { obj[h] = values[j] != null ? String(values[j]).trim() : ''; });
    const row = mapRow(obj as Record<string, unknown>);
    if (row && (row.email || row.nombre)) rows.push(row);
  }
  return rows;
}

export function BulkUsersUpload() {
  const queryClient = useQueryClient();
  const { colorPrimario, colorSecundario } = useInstitutionColors();
  const [step, setStep] = useState<'input' | 'preview' | 'results'>('input');
  const [rows, setRows] = useState<BulkRowInput[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setFileError(null);
    if (!file) return;
    const ext = (file.name || '').toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      setFileError('Formato no soportado. Usa .xlsx o .csv');
      return;
    }
    parseSheet(file)
      .then((parsed) => {
        setRows(parsed);
        setStep('preview');
      })
      .catch(() => setFileError('No se pudo leer el archivo. Revisa que tenga columnas: nombre, apellido, email, rol, codigo_interno?, curso_grupo?'));
  }, []);

  const handlePaste = useCallback(() => {
    const parsed = parsePaste(pasteText);
    setFileError(null);
    if (parsed.length === 0) {
      setFileError('No se detectaron filas. Pega una tabla con encabezado (nombre, email, rol, ...) separado por tab o coma.');
      return;
    }
    setRows(parsed);
    setStep('preview');
  }, [pasteText]);

  const bulkMutation = useMutation({
    mutationFn: (payload: { rows: BulkRowInput[] }) =>
      apiRequest<BulkResult>('POST', '/api/users/bulk', payload),
    onSuccess: (data) => {
      setResult(data);
      setStep('results');
      queryClient.invalidateQueries({ queryKey: ['usuariosByRole'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });

  const downloadCsv = useCallback(() => {
    if (!result?.created?.length) return;
    const headers = ['email', 'contraseña_generada', 'código_interno', 'colegio', 'nombre', 'rol'];
    const lines = [headers.join(',')];
    result.created.forEach((r) => {
      lines.push([r.email, r.passwordGenerated, r.codigoInterno, r.colegioId, r.nombre, r.rol].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `usuarios_creados_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [result]);

  const reset = useCallback(() => {
    setStep('input');
    setRows([]);
    setPasteText('');
    setResult(null);
    setFileError(null);
  }, []);

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5" style={{ color: colorPrimario }} />
            Carga masiva de usuarios
          </CardTitle>
          <CardDescription className="text-white/60">
            Sube un Excel/CSV o pega una tabla. Campos: nombre, apellido, email, rol (student|teacher|parent), código interno, curso/grupo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'input' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-white/80">Archivo Excel o CSV</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="cursor-pointer inline-flex">
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
                      <span className="inline-flex items-center justify-center rounded-md border border-white/20 bg-transparent px-4 py-2 text-sm text-white hover:bg-white/10">
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Seleccionar archivo
                      </span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">O pega tabla (primera fila = encabezados)</Label>
                  <Textarea
                    placeholder="nombre	apellido	email	rol	codigo_interno	curso_grupo&#10;Juan	Pérez	juan@mail.com	student	MAT001	7A"
                    className="bg-white/5 border-white/10 text-white min-h-[100px]"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={handlePaste}
                  >
                    <ClipboardPaste className="w-4 h-4 mr-2" />
                    Usar datos pegados
                  </Button>
                </div>
              </div>
              {fileError && (
                <p className="text-red-400 text-sm">{fileError}</p>
              )}
            </>
          )}

          {step === 'preview' && (
            <>
              <p className="text-white/70">
                Vista previa: <strong>{rows.length}</strong> fila(s). Revisa y confirma.
              </p>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="p-2 text-white/80">#</th>
                      <th className="p-2 text-white/80">Nombre</th>
                      <th className="p-2 text-white/80">Apellido</th>
                      <th className="p-2 text-white/80">Email</th>
                      <th className="p-2 text-white/80">Rol</th>
                      <th className="p-2 text-white/80">Código</th>
                      <th className="p-2 text-white/80">Curso/Grupo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b border-white/5 text-white/90">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">{r.nombre}</td>
                        <td className="p-2">{r.apellido || '-'}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2">{r.rol}</td>
                        <td className="p-2">{r.codigo_interno || '-'}</td>
                        <td className="p-2">{r.curso_grupo || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 50 && <p className="text-white/50 text-sm">Mostrando 50 de {rows.length} filas.</p>}
              <div className="flex gap-2">
                <Button
                  style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                  disabled={bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate({ rows })}
                >
                  {bulkMutation.isPending ? 'Creando...' : `Crear ${rows.length} usuario(s)`}
                </Button>
                <Button variant="ghost" className="text-white/70" onClick={reset}>
                  Volver
                </Button>
              </div>
            </>
          )}

          {step === 'results' && result && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-2xl font-bold">{result.summary.created}</span>
                    </div>
                    <p className="text-white/60 text-sm">Creados</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-5 h-5" />
                      <span className="text-2xl font-bold">{result.summary.failed}</span>
                    </div>
                    <p className="text-white/60 text-sm">Fallidos</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <span className="text-2xl font-bold text-white">{result.summary.total}</span>
                    <p className="text-white/60 text-sm">Total procesados</p>
                  </CardContent>
                </Card>
              </div>
              {result.created.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-white/80">Usuarios creados (guarda las contraseñas; no se mostrarán de nuevo)</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white hover:bg-white/10"
                      onClick={downloadCsv}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descargar CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-white/10 max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="sticky top-0 bg-[#0a0a0c] border-b border-white/10">
                        <tr>
                          <th className="p-2 text-white/80">Email</th>
                          <th className="p-2 text-white/80">Contraseña</th>
                          <th className="p-2 text-white/80">Código interno</th>
                          <th className="p-2 text-white/80">Colegio</th>
                          <th className="p-2 text-white/80">Nombre</th>
                          <th className="p-2 text-white/80">Rol</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.created.map((r, i) => (
                          <tr key={i} className="border-b border-white/5 text-white/90">
                            <td className="p-2">{r.email}</td>
                            <td className="p-2 font-mono text-amber-300">{r.passwordGenerated}</td>
                            <td className="p-2">{r.codigoInterno}</td>
                            <td className="p-2">{r.colegioId}</td>
                            <td className="p-2">{r.nombre}</td>
                            <td className="p-2">{r.rol}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {result.failed.length > 0 && (
                <div>
                  <Label className="text-white/80">Filas con error</Label>
                  <div className="overflow-x-auto rounded-lg border border-white/10 max-h-[200px] overflow-y-auto mt-1">
                    <table className="w-full text-sm text-left">
                      <thead className="sticky top-0 bg-[#0a0a0c] border-b border-white/10">
                        <tr>
                          <th className="p-2 text-white/80">Fila</th>
                          <th className="p-2 text-white/80">Email</th>
                          <th className="p-2 text-white/80">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.failed.map((f, i) => (
                          <tr key={i} className="border-b border-white/5 text-red-300/90">
                            <td className="p-2">{f.rowIndex}</td>
                            <td className="p-2">{f.email || '-'}</td>
                            <td className="p-2">{f.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={reset}>
                Nueva carga
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
