#!/usr/bin/env python3
"""Finite Docker-only setup/restart/backup/restore/secret-file smoke test.
Uses an isolated source copy, random Compose project and synthetic data only.
Never reads the checkout's .env or targets its Compose project.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import stat
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid

root = Path(__file__).resolve().parent.parent
project = 'skillbox-smoke-' + uuid.uuid4().hex[:10]
work = Path(tempfile.mkdtemp(prefix=project + '-'))
with socket.socket() as socket_probe:
    socket_probe.bind(('127.0.0.1', 0))
    port = socket_probe.getsockname()[1]
origin = f'http://127.0.0.1:{port}'
# Do not inherit an operator's Compose project, override files or app secrets.
env = {key: value for key, value in os.environ.items() if not key.startswith(('COMPOSE_', 'SKILLBOX_', 'DATABASE_URL', 'POSTGRES_', 'AI_GATEWAY_'))}
env['COMPOSE_PROJECT_NAME'] = project

def run(*args, ok=True):
    result = subprocess.run(args, cwd=work, env=env, check=False)
    if ok and result.returncode:
        raise RuntimeError('Command failed: ' + args[0])
    return result.returncode

def api(path, method='GET', body=None):
    request = urllib.request.Request(origin + path, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + values['SKILLBOX_ADMIN_TOKEN'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)

try:
    paths = set(subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).decode().strip('\0').split('\0'))
    for name in paths:
        source = root / name
        if not source.is_file():
            continue
        if source.is_symlink():
            raise RuntimeError('Unexpected source symlink')
        destination = work / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    assert not (work / '.env').exists()
    run('bash', 'scripts/skillbox.sh', 'setup', '--origin', origin, '--port', str(port))
    assert stat.S_IMODE((work / '.env').stat().st_mode) == 0o600
    with (work / '.env').open('a') as file:
        file.write(f'SKILLBOX_IMAGE={project}:test\n')
    values = dict(line.split('=', 1) for line in (work / '.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
    run('bash', 'scripts/skillbox.sh', 'start')
    assert api('/healthz')['ok']
    assert api('/api/skills')['items'] == []
    content = b'---\nname: recovery-fixture\ndescription: Synthetic recovery test\n---\nRestorable content.\n'
    file = {'path': 'SKILL.md', 'content': base64.b64encode(content).decode(), 'sha256': hashlib.sha256(content).hexdigest(), 'size': len(content), 'executable': False}
    revision = api('/api/skills/recovery-fixture', 'PUT', {'files': [file], 'expectedRevision': None})['revision']
    api('/api/settings/ai-gateway', 'PUT', {'apiKey': 'synthetic-recovery-fixture-key'})
    run('bash', 'scripts/skillbox.sh', 'stop')
    run('bash', 'scripts/skillbox.sh', 'start')
    assert api('/api/skills/recovery-fixture')['revision'] == revision
    assert api('/api/settings/ai-gateway')['configured']
    run('bash', 'scripts/skillbox.sh', 'doctor')
    run('bash', 'scripts/skillbox.sh', 'backup')
    dump, = list((work / 'backups').glob('*.dump'))
    sidecar = dump.with_suffix('.env')
    assert stat.S_IMODE(sidecar.stat().st_mode) == 0o600
    assert sidecar.read_bytes() == (work / '.env').read_bytes()
    api('/api/skills/recovery-fixture', 'DELETE', {'expectedRevision': revision})
    assert api('/api/skills')['items'] == []
    assert run('bash', 'scripts/skillbox.sh', 'restore', str(dump), ok=False) != 0
    assert api('/healthz')['ok']
    run('bash', 'scripts/skillbox.sh', 'restore', str(dump), '--confirm-replace-database')
    assert api('/api/skills/recovery-fixture')['revision'] == revision
    assert api('/api/settings/ai-gateway')['configured']
    # Verify mounted secrets work before database initialization, not just in a unit function.
    (work / 'owner.secret').write_text(values['SKILLBOX_ADMIN_TOKEN'])
    (work / 'database.secret').write_text(f"postgres://skillbox:{values['POSTGRES_PASSWORD']}@db:5432/skillbox")
    os.chmod(work / 'owner.secret', 0o600)
    os.chmod(work / 'database.secret', 0o600)
    override = {'services': {'app': {'environment': {'SKILLBOX_ADMIN_TOKEN': '', 'DATABASE_URL': '', 'SKILLBOX_ADMIN_TOKEN_FILE': '/run/secrets/owner', 'DATABASE_URL_FILE': '/run/secrets/database'}, 'volumes': ['./owner.secret:/run/secrets/owner:ro', './database.secret:/run/secrets/database:ro']}}}
    (work / 'secrets-test.yml').write_text(json.dumps(override))
    run('docker', 'compose', '-f', 'compose.yml', '-f', 'secrets-test.yml', 'up', '-d', '--no-deps', '--no-build', '--wait', 'app')
    assert api('/api/skills/recovery-fixture')['revision'] == revision
    assert api('/api/settings/ai-gateway')['configured']
    print(json.dumps({'dockerOnlySetup': True, 'restartPersistence': True, 'protectedBackup': True, 'restoreConfirmationRequired': True, 'restoredRevisionAndEncryptedSettings': True, 'mountedStartupSecrets': True, 'syntheticOnly': True}))
finally:
    cleaned = run('docker', 'compose', 'down', '--volumes', ok=False) == 0
    subprocess.run(['docker', 'image', 'rm', project + ':test'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if cleaned:
        shutil.rmtree(work)
    else:
        print('Cleanup failed; preserve isolated fixture for inspection: ' + str(work))
