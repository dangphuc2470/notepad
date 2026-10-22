import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/.test(version)) {
    console.error('Please provide a valid semver version (e.g., 1.0.2).');
    console.log('Usage: npm run release <version>');
    process.exit(1);
}

console.log(`Bumping version to ${version}...`);

try {
    // 1. Update package.json
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    packageJson.version = version;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✅ Updated package.json');

    // 2. Update tauri.conf.json
    const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
    tauriConf.version = version;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log('✅ Updated tauri.conf.json');

    // 3. Update Cargo.toml
    const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
    let cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
    cargoToml = cargoToml.replace(/version\s*=\s*"[^"]+"/, `version = "${version}"`);
    fs.writeFileSync(cargoTomlPath, cargoToml);
    console.log('✅ Updated Cargo.toml');

    execSync('cargo check --manifest-path src-tauri/Cargo.toml', { cwd: rootDir, stdio: 'inherit' });
    console.log('✅ Updated Cargo.lock');

    // 4. Update README.md download links
    const readmePath = path.join(rootDir, 'README.md');
    let readme = fs.readFileSync(readmePath, 'utf-8');
    // Handle replacing older download links with new NotePad-v tag links
    readme = readme.replace(/(download\/(?:app|NotePad)-v)[^\/]+(\/Notepad(?:Mac)?_)[a-zA-Z0-9._-]+(\.dmg)/g, (match, p1, p2, p3) => {
        if (match.includes('_aarch64')) return `download/NotePad-v${version}${p2}${version}_aarch64${p3}`;
        if (match.includes('_x64')) return `download/NotePad-v${version}${p2}${version}_x64${p3}`;
        return `download/NotePad-v${version}${p2}${version}_x64${p3}`;
    });
    fs.writeFileSync(readmePath, readme);
    console.log('✅ Updated README.md');

    // 5. Commit and tag
    execSync('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock README.md scripts/release.js .github/workflows/release.yml .github/workflows/update-cask.yml src/version.ts', { cwd: rootDir, stdio: 'inherit' });
    execSync(`git commit -m "chore(release): v${version}"`, { cwd: rootDir, stdio: 'inherit' });
    execSync(`git tag NotePad-v${version}`, { cwd: rootDir, stdio: 'inherit' });

    // 6. Push
    execSync('git push origin main', { cwd: rootDir, stdio: 'inherit' });
    execSync('git push origin --tags', { cwd: rootDir, stdio: 'inherit' });

    console.log(`\n🎉 Successfully bumped version, tagged as NotePad-v${version}, and pushed to GitHub!`);
    console.log('The GitHub Action release workflow will now build the apps and update the Homebrew cask.');

} catch (error) {
    console.error('\n❌ Release process failed:');
    console.error(error);
    process.exit(1);
}
