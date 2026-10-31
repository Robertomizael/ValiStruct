"""Puerta estatica: pseudo-relocaciones MinGW de 32 bits en DLL de Windows.

Contexto (ValiStruct v5.4, hotfix Windows):
  conda-forge r-base 4.5.x construye Rblas.dll/Rlapack.dll como DLL
  "forwarder". Los paquetes R compilados contra la DLL (sin biblioteca de
  importacion) reciben pseudo-relocaciones de 32 bits por cada llamada
  BLAS/LAPACK. Si Windows (ASLR) carga la BLAS real a mas de 2 GB del
  paquete, el runtime MinGW aborta con:
      "Mingw-w64 runtime failure: 32 bit pseudo relocation ... out of range"
  Ver conda-forge/r-base-feedstock#428.

  El fallo depende de las direcciones que asigne ASLR en cada equipo y en
  cada arranque, por lo que una prueba dinamica en CI puede pasar por azar.
  Esta puerta es determinista: inspecciona la tabla de pseudo-relocaciones
  (formato v2) de cada DLL y falla si encuentra entradas de 32 bits.

Uso:
  python check_pe_pseudo_relocs.py <carpeta> [<carpeta> ...] [--report out.json]
Codigo de salida: 0 = sin entradas de 32 bits; 1 = encontradas o escaneo invalido.
Requiere: pefile (solo en la maquina de compilacion; no se empaqueta).
"""
import argparse
import collections
import json
import os
import struct
import sys

import pefile

RP_V2_HEADER = b'\x00' * 8 + b'\x01\x00\x00\x00'


def scan_dll(path):
    pe = pefile.PE(path, fast_load=True)
    try:
        pe.parse_data_directories(
            directories=[pefile.DIRECTORY_ENTRY['IMAGE_DIRECTORY_ENTRY_IMPORT']])
        image_base = pe.OPTIONAL_HEADER.ImageBase
        iat = {}
        for entry in getattr(pe, 'DIRECTORY_ENTRY_IMPORT', []):
            dll = entry.dll.decode(errors='replace').lower()
            for imp in entry.imports:
                name = imp.name.decode(errors='replace') if imp.name else '#%s' % imp.ordinal
                iat[imp.address - image_base] = (dll, name)
        counts = collections.defaultdict(collections.Counter)
        examples = collections.defaultdict(list)
        if not iat:
            return counts, examples
        data = pe.__data__
        for sec in pe.sections:
            raw = data[sec.PointerToRawData: sec.PointerToRawData + sec.SizeOfRawData]
            pos = 0
            while True:
                i = raw.find(RP_V2_HEADER, pos)
                if i < 0:
                    break
                pos = i + 1
                if i % 4:
                    continue
                j = i + 12
                while j + 12 <= len(raw):
                    sym, _target, flags = struct.unpack_from('<III', raw, j)
                    bits = flags & 0xff
                    if sym in iat and bits in (8, 16, 32, 64):
                        dll, name = iat[sym]
                        counts[dll][bits] += 1
                        if len(examples[dll]) < 5 and name not in examples[dll]:
                            examples[dll].append(name)
                        j += 12
                    else:
                        break
        return counts, examples
    finally:
        pe.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('roots', nargs='+')
    ap.add_argument('--report', default=None)
    ap.add_argument('--min-dlls', type=int, default=1,
                    help='falla si se escanean menos DLL (proteccion contra rutas vacias)')
    args = ap.parse_args()

    report = {'dlls_scanned': 0, 'pseudo_reloc_entries_total': 0, 'unreadable': [], 'offenders': {}}
    for root in args.roots:
        if not os.path.exists(root):
            print('ERROR: no existe la ruta %s' % root)
            return 1
        targets = [root] if os.path.isfile(root) else [
            os.path.join(dp, f) for dp, _, fs in os.walk(root) for f in fs if f.lower().endswith('.dll')]
        for path in targets:
            try:
                counts, examples = scan_dll(path)
            except pefile.PEFormatError as exc:
                report['unreadable'].append({'dll': path, 'error': str(exc)})
                continue
            report['dlls_scanned'] += 1
            report['pseudo_reloc_entries_total'] += sum(sum(c.values()) for c in counts.values())
            bad = {dll: c[32] for dll, c in counts.items() if c.get(32)}
            if bad:
                report['offenders'][path] = {
                    'entries_32bit_by_import': bad,
                    'example_symbols': {dll: examples[dll] for dll in bad},
                }

    print('DLL escaneadas: %d' % report['dlls_scanned'])
    print('Entradas de pseudo-relocacion detectadas (todas las anchuras): %d'
          % report['pseudo_reloc_entries_total'])
    if report['unreadable']:
        print('DLL no legibles como PE (se ignoran): %d' % len(report['unreadable']))
    for path, info in sorted(report['offenders'].items()):
        print('FALLA 32 bits: %s -> %s ej. %s'
              % (path, info['entries_32bit_by_import'], info['example_symbols']))
    if args.report:
        with open(args.report, 'w', encoding='utf-8') as fh:
            json.dump(report, fh, indent=1)

    if report['dlls_scanned'] < args.min_dlls:
        print('ERROR: se escanearon menos DLL de las esperadas (%d < %d).'
              % (report['dlls_scanned'], args.min_dlls))
        return 1
    if report['offenders']:
        print('RESULTADO: NO-GO. Hay DLL con pseudo-relocaciones de 32 bits.')
        return 1
    print('RESULTADO: OK. Ninguna DLL contiene pseudo-relocaciones de 32 bits.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
