# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['main_api.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
        ('js', 'js'),
        ('icons', 'icons'),
        ('sise.db', '.')
    ],
    hiddenimports=['passlib.handlers.bcrypt'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    pyi_version='6.8.0'
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SISE_API',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='SISE_API',
)
datas=[
    ('templates', 'templates'),
    ('static', 'static'),
    ('js', 'js'),
    ('icons', 'icons'),
    ('sise.db', '.')
],