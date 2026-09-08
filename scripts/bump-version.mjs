#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = 'package.json';
const TAURI_CONF = 'src-tauri/tauri.conf.json';
const CARGO_TOML = 'src-tauri/Cargo.toml';
const CARGO_LOCK = 'src-tauri/Cargo.lock';
const VERSION_FILES = [PACKAGE_JSON, TAURI_CONF, CARGO_TOML, CARGO_LOCK];

const USAGE = [
    'Usage: node scripts/bump-version.mjs <version|major|minor|patch|prerelease>',
    '',
    '  <version>    explicit semver version, must be greater than the current one (leading v allowed)',
    '  major        bump major: 0.1.2 -> 1.0.0',
    '  minor        bump minor: 0.1.2 -> 0.2.0',
    '  patch        bump patch: 0.1.2 -> 0.1.3, or strip prerelease: 0.1.3-beta2 -> 0.1.3',
    '  prerelease   append auto-numbered beta suffix: 0.1.2 -> 0.1.2-beta1',
    '',
    'Examples:',
    '  node scripts/bump-version.mjs 0.2.0',
    '  node scripts/bump-version.mjs patch',
    '  node scripts/bump-version.mjs prerelease',
].join('\n');

function fail(message) {
    console.error(`bump-version: ${message}`);
    process.exit(1);
}

function git(args) {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function parseVersion(input) {
    const text = input.trim().replace(/^v/, '');
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+[\w.-]+)?$/.exec(text);
    if (!m) return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4] ?? null, text };
}

function compareIdentifiers(a, b) {
    const aNum = /^\d+$/.test(a);
    const bNum = /^\d+$/.test(b);
    if (aNum && bNum) return Number(a) - Number(b);
    if (aNum) return -1;
    if (bNum) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
}

function compareVersions(a, b) {
    for (const key of ['major', 'minor', 'patch']) {
        if (a[key] !== b[key]) return a[key] - b[key];
    }
    if (a.prerelease === b.prerelease) return 0;
    if (a.prerelease === null) return 1;
    if (b.prerelease === null) return -1;
    const aParts = a.prerelease.split('.');
    const bParts = b.prerelease.split('.');
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
        if (aParts[i] === undefined) return -1;
        if (bParts[i] === undefined) return 1;
        const c = compareIdentifiers(aParts[i], bParts[i]);
        if (c !== 0) return c;
    }
    return 0;
}

function nextPrereleaseNumber(base) {
    const prefix = `v${base}-beta`;
    let max = 0;
    const tags = git(`tag --list "${prefix}*"`);
    for (const line of tags.split('\n')) {
        const name = line.trim();
        if (!name.startsWith(prefix)) continue;
        const n = Number(name.slice(prefix.length));
        if (Number.isInteger(n) && n > max) max = n;
    }
    return max + 1;
}

function setJsonVersion(raw, newVersion) {
    const data = JSON.parse(raw);
    data.version = newVersion;
    return JSON.stringify(data, null, 4) + (raw.endsWith('\n') ? '\n' : '');
}

function setCargoTomlVersion(raw, newVersion) {
    const re = /^version(\s*)=(\s*)"[^"]*"/m;
    if (!re.test(raw)) fail(`Could not find the [package] version in ${CARGO_TOML}.`);
    return raw.replace(re, `version$1=$2"${newVersion}"`);
}

function setCargoLockVersion(raw, newVersion) {
    const re = /(\[\[package\]\]\nname = "copall"\nversion = ")[^"]*(")/;
    if (!re.test(raw)) fail(`Could not find the copall entry in ${CARGO_LOCK}.`);
    return raw.replace(re, `$1${newVersion}$2`);
}

function main() {
    const argv = process.argv.slice(2);
    if (argv.length !== 1) fail(`Expected exactly one argument.\n${USAGE}`);
    const arg = argv[0];

    const currentRaw = JSON.parse(readFileSync(join(ROOT, PACKAGE_JSON), 'utf8')).version;
    const current = parseVersion(String(currentRaw));
    if (!current) fail(`Current version "${currentRaw}" in ${PACKAGE_JSON} is not valid semver.`);

    let newVersion;
    if (arg === 'major') {
        newVersion = `${current.major + 1}.0.0`;
    } else if (arg === 'minor') {
        newVersion = `${current.major}.${current.minor + 1}.0`;
    } else if (arg === 'patch') {
        newVersion = current.prerelease === null
            ? `${current.major}.${current.minor}.${current.patch + 1}`
            : `${current.major}.${current.minor}.${current.patch}`;
    } else if (arg === 'prerelease') {
        const base = `${current.major}.${current.minor}.${current.patch}`;
        newVersion = `${base}-beta${nextPrereleaseNumber(base)}`;
    } else {
        const parsed = parseVersion(arg);
        if (!parsed) fail(`"${arg}" is not a version, major, minor, patch or prerelease.\n${USAGE}`);
        if (compareVersions(parsed, current) <= 0) {
            fail(`New version ${parsed.text} must be greater than current ${currentRaw}.`);
        }
        newVersion = parsed.text;
    }

    const tag = `v${newVersion}`;
    let tagExists = false;
    try {
        tagExists = git(`rev-parse -q --verify refs/tags/${tag}`).length > 0;
    } catch {
        tagExists = false;
    }
    if (tagExists) fail(`Tag ${tag} already exists. Tags are immutable, pick a new version.`);

    const dirty = git(`status --porcelain -- ${VERSION_FILES.join(' ')}`);
    if (dirty) fail(`Version files have uncommitted changes, commit or stash them first:\n${dirty}`);

    const pkgRaw = readFileSync(join(ROOT, PACKAGE_JSON), 'utf8');
    const tauriRaw = readFileSync(join(ROOT, TAURI_CONF), 'utf8');
    const cargoTomlRaw = readFileSync(join(ROOT, CARGO_TOML), 'utf8');
    const cargoLockRaw = readFileSync(join(ROOT, CARGO_LOCK), 'utf8');

    const pkgNew = setJsonVersion(pkgRaw, newVersion);
    const tauriNew = setJsonVersion(tauriRaw, newVersion);
    const cargoTomlNew = setCargoTomlVersion(cargoTomlRaw, newVersion);
    const cargoLockNew = setCargoLockVersion(cargoLockRaw, newVersion);

    writeFileSync(join(ROOT, PACKAGE_JSON), pkgNew);
    writeFileSync(join(ROOT, TAURI_CONF), tauriNew);
    writeFileSync(join(ROOT, CARGO_TOML), cargoTomlNew);
    writeFileSync(join(ROOT, CARGO_LOCK), cargoLockNew);

    git(`add -- ${VERSION_FILES.join(' ')}`);
    try {
        execSync(`git diff --cached --quiet -- ${VERSION_FILES.join(' ')}`, { cwd: ROOT, stdio: 'pipe' });
        fail(`Nothing to commit, all version files already at ${newVersion}.`);
    } catch (e) {
        if (e.status !== 1) throw e;
    }

    execSync(`git commit -m "chore: bump version to ${newVersion}" -- ${VERSION_FILES.join(' ')}`, {
        cwd: ROOT,
        stdio: 'inherit',
    });
    execSync(`git tag -a ${tag} -m ${tag}`, { cwd: ROOT, stdio: 'inherit' });

    console.log(`Done: ${currentRaw} -> ${newVersion}, tagged ${tag}.`);
    console.log('Nothing was pushed. Push with: git push --follow-tags');
}

main();
