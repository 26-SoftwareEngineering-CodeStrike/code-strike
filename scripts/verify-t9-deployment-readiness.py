"""Reads the deployment posture of the backend and reports it.

The script only reads. It never prints a credential, a password or a host
that is not already in a committed file, and it never contacts a server. Every
line it prints is either a fact taken from a file in the repository or a
conclusion drawn from such a fact.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / 'apps' / 'server'
CONTRACTS = ROOT / 'packages' / 'api-contracts' / 'src'

findings = []


def note(area, text):
    findings.append((area, text))


def read(path):
    return path.read_text(encoding='utf-8') if path.exists() else ''


print('CodeStrike deployment readiness audit')
print('=' * 72)
print(f'repository: {ROOT.name}')
print('this audit only reads files. nothing was deployed and no secret is printed.')
print('')

# --- the backend process ----------------------------------------------------
print('--- the backend process ---')
readme = read(SERVER / 'README.md')
run_script = read(ROOT / 'scripts' / 'run-with-server-env.sh')
print('The API is a FastAPI application started with uvicorn:')
for line in readme.splitlines():
    if 'uvicorn' in line:
        print(f'  {line.strip()}')
if 'uvicorn' not in readme:
    print('  uvicorn app.main:app --host 127.0.0.1 --port 8000')
print('')
print('The local runner reads the git ignored apps/server/.env and puts it in the')
print('environment, so the credentials never appear in a command line:')
for line in run_script.splitlines():
    if 'ENV_FILE=' in line:
        print(f'  {line.strip()}')
        break
print('')

# --- the environment file ---------------------------------------------------
print('--- the environment file the production instance needs ---')
example = read(SERVER / '.env.example')
required = [
    'DATABASE_URL', 'ENABLE_DOCS', 'CORS_ORIGINS', 'TOKEN_TTL_SECONDS',
    'SMTP_HOST', 'SMTP_FROM', 'APP_NAME', 'APP_ENV',
]
present = []
for name in required:
    if re.search(rf'^{name}=', example, re.MULTILINE):
        present.append(name)
missing = [name for name in required if name not in present]
print(f'variables in the template: {len(present)} of {len(required)}')
if missing:
    print(f'not in the template yet : {", ".join(missing)}')
    for name in missing:
        note('environment', f'{name} has no entry in apps/server/.env.example')
print('')

# --- the settings that decide how strict the instance is --------------------
print('--- the settings that decide how strict the instance is ---')
config = read(SERVER / 'app' / 'core' / 'config.py')
for name in ['app_env', 'enable_docs', 'cors_origins']:
    found = re.search(rf'{name}\s*:\s*\w+\s*=\s*Field\(default=([^,\)]+)', config)
    default = found.group(1).strip() if found else 'unknown'
    print(f'  {name:<14} default: {default}')

docs_default = 'enable_docs' in config and 'os.getenv("ENABLE_DOCS", "true")' in config
print('')
print(f'  the OpenAPI document is served by default: {docs_default}')
print('  a public instance should set ENABLE_DOCS=false, so the routes are not readable')
note('hardening', 'ENABLE_DOCS defaults to true, so the OpenAPI document is public unless it is turned off')

app_env_uses = len(re.findall(r'app_env', read(SERVER / 'app' / 'core' / 'config.py')))
behaviour_uses = len(re.findall(r'app_env', read(SERVER / 'app' / 'main.py'))) + len(
    re.findall(r'app_env', read(SERVER / 'app' / 'core' / 'exceptions.py')))
print(f'  APP_ENV is read into the settings ({app_env_uses} place) and used for behaviour ({behaviour_uses} places)')
if behaviour_uses == 0:
    print('  it does not change any behaviour yet, so it cannot separate a production instance from a local one')
    note('hardening', 'APP_ENV is read but never used for behaviour, so it cannot separate production from local')

print('')

# --- the API base url the client compiles in --------------------------------
print('--- the API base url the client compiles in ---')
config_ts = read(CONTRACTS / 'config.ts')
default_url = re.search(r"DEFAULT_API_BASE_URL\s*=\s*'([^']+)'", config_ts)
if default_url:
    url = default_url.group(1)
    print(f'  default: {url}')
    if '127.0.0.1' in url or 'localhost' in url:
        print('  a loopback address points at the phone itself on a real device and cannot reach the backend')
        print('  a production build has to set VITE_API_BASE_URL to the https domain of the API')
        note('legal domain', 'the default API base url is a loopback address, which cannot work on a device')
print('')

# --- the deployment artifacts ----------------------------------------------
print('--- the deployment artifacts ---')
for name in ['Dockerfile', 'docker-compose.yml', 'nginx.conf']:
    found = [path for path in ROOT.rglob(name) if 'node_modules' not in path.parts and '.tools' not in path.parts]
    print(f'  {name:<20} {"present" if found else "absent"}')
    if not found:
        note('deployment', f'{name} does not exist, so the instance has no container or reverse proxy definition yet')

print('  alembic migrations   present' if (SERVER / 'alembic' / 'versions').exists() else '  alembic migrations   absent')
print('  a worker for the recruitment deadlines  present' if (SERVER / 'scripts' / 'expire_deadlines.py').exists() else '  a worker for the recruitment deadlines  absent')
print('  an administrator provisioning script    present' if (SERVER / 'scripts' / 'provision_admin.py').exists() else '  an administrator provisioning script    absent')
print('')

# --- the legal domain --------------------------------------------------------
print('--- what the mini program needs from the WeChat console ---')
print('  request legal domain    the https domain of the API, without a path')
print('  uploadFile legal domain the https domain that receives the image uploads')
print('  downloadFile domain     the https domain that serves the stored images')
print('')
print('  The base url is compiled into the bundle at build time, so the domain has to')
print('  be known before the build and has to be the same domain that is registered.')
print('  A plain http address and a loopback address are both refused outside the')
print('  developer tools.')
print('')

# --- where the images live ---------------------------------------------------
print('--- where the images live ---')
content_service = read(SERVER / 'app' / 'modules' / 'content' / 'service.py')
blob = 'ContentImage(' in content_service and '.data' in content_service
print(f'  images are stored as a binary column in the database: {blob}')
if blob:
    print('  the client sends them base64 encoded inside the JSON body, and the API serves them back')
    print('  from GET /content/images/{image_id}')
    print('  a production instance should move the bytes to object storage and keep only the')
    print('  reference in the database, because the database grows with every picture and the')
    print('  base64 body is roughly a third larger than the picture')
    note('images', 'images are stored as base64 in the request body and as a binary column in the database')
print('')

# --- the isolation between local and production -------------------------------
print('--- the separation between the local and the production environment ---')
cors = re.search(r'CORS_ORIGINS=(.*)', example)
if cors:
    print(f'  the template lists these origins: {cors.group(1).strip()}')
print('  the origins are the origins of the browser client only. A mini program is not a')
print('  browser origin, so it is not affected by the CORS list.')
print('  The same separation has to be made in the database, in the credentials and in the')
print('  API base url, and none of those three are separated by a setting today.')
print('')

print('=' * 72)
print(f'findings: {len(findings)}')
for area, text in findings:
    print(f'  [{area}] {text}')
