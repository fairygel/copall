import glob
import json
import os
import sys
from datetime import datetime, timezone


def classify(name):
    lower = name.lower()
    if name.endswith('.msi') or ('setup' in lower and name.endswith('.exe')):
        return 'windows-x86_64'
    if name.endswith('.AppImage'):
        return 'linux-x86_64'
    if name.endswith('.app.tar.gz'):
        if 'aarch64' in name:
            return 'darwin-aarch64'
        if 'x86_64' in name:
            return 'darwin-x86_64'
        return 'darwin-aarch64'
    return None


def main():
    version, repo, artifacts_dir, output = sys.argv[1:5]
    base_url = f'https://github.com/{repo}/releases/download/{version}'

    platforms = {}
    for path in sorted(glob.glob(f'{artifacts_dir}/**/*', recursive=True)):
        if not os.path.isfile(path) or path.endswith('.sig'):
            continue
        sig_path = path + '.sig'
        if not os.path.exists(sig_path):
            print(f'skip {path}: no .sig file')
            continue
        target = classify(os.path.basename(path))
        if target is None:
            print(f'skip {path}: not an updater bundle')
            continue
        with open(sig_path) as f:
            signature = f.read().strip()
        platforms[target] = {
            'url': base_url + '/' + os.path.basename(path),
            'signature': signature,
        }

    manifest = {
        'version': version,
        'notes': f'Copall {version}',
        'pub_date': datetime.now(timezone.utc).isoformat(),
        'platforms': platforms,
    }
    with open(output, 'w') as out:
        json.dump(manifest, out, indent=2)
    print(json.dumps(manifest, indent=2))


main()
