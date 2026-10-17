#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rootSource = path.resolve(__dirname, '..');
const arg = process.argv[2];

const runtimeCommands = ['start', 'spec', 'trace', 'status', 'verify', 'accept', 'finish', 'dashboard', 'approve', 'archive'];

const itemsToCopy = [
  '.vscode',
  '.github',
  '.agents',
  '.cursorrules',
  'AGENTS.md',
  'GEMINI.md',
  'CLAUDE.md'
];

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  // This CI validates the Node distribution, not a generated Flutter app.
  if (src === path.join(rootSource, '.github', 'workflows', 'ci.yml')) return;
  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((child) => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
  } else {
    if (fs.existsSync(dest)) {
      if (fs.readFileSync(src).equals(fs.readFileSync(dest))) return;
      const backupPath = dest + `.fluttercrew-${Date.now()}.bak`;
      fs.copyFileSync(dest, backupPath);
      console.log(`ℹ️  Saved backup: ${backupPath}`);
    }
    fs.copyFileSync(src, dest);
  }
}

function installAgentsTo(targetDir) {
  if (path.resolve(targetDir) === rootSource) {
    console.log('FlutterCrew source workspace detected; installation not needed.');
    return;
  }
  for (const item of itemsToCopy) {
    const srcPath = path.join(rootSource, item);
    const destPath = path.join(targetDir, item);
    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, destPath);
      console.log(`  ✓ Installed: ${item}`);
    }
  }
  const ignorePath = path.join(targetDir, '.gitignore');
  const original = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
  const missing = ['.fluttercrew/', '*.fluttercrew-*.bak']
    .filter((line) => !original.split(/\r?\n/).includes(line));
  if (missing.length) {
    if (original) fs.copyFileSync(ignorePath, ignorePath + `.fluttercrew-${Date.now()}.bak`);
    fs.writeFileSync(ignorePath, original + (original.endsWith('\n') || !original ? '' : '\n') +
      '\n# FlutterCrew local evidence, logs and installer backups\n' + missing.join('\n') + '\n');
  }
}

function findLatestBackup(targetDir, relativePath) {
  const dir = path.dirname(path.join(targetDir, relativePath));
  if (!fs.existsSync(dir)) return null;
  const base = path.basename(relativePath);
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}\\.fluttercrew-\\d+\\.bak$`);
  const matches = fs.readdirSync(dir).filter((f) => regex.test(f)).sort();
  if (matches.length > 0) {
    return path.join(dir, matches[matches.length - 1]);
  }
  return null;
}

function restoreOrRemove(targetDir, relativePath) {
  const filePath = path.join(targetDir, relativePath);
  const backup = findLatestBackup(targetDir, relativePath);
  if (backup && fs.existsSync(backup)) {
    fs.copyFileSync(backup, filePath);
    console.log(`  ✓ Restored ${relativePath} from backup: ${path.basename(backup)}`);
  } else if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
    console.log(`  ✓ Removed ${relativePath}`);
  }
}

function cleanBackups(targetDir) {
  function walkAndClean(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      try {
        if (fs.statSync(full).isDirectory()) {
          if (!['.git', 'node_modules', '.dart_tool', 'build'].includes(file)) {
            walkAndClean(full);
          }
        } else if (/\.fluttercrew-\d+\.bak$/.test(file)) {
          fs.rmSync(full, { force: true });
        }
      } catch { /* ignore permission errors */ }
    }
  }
  walkAndClean(targetDir);
}

function uninstallAgentsFrom(targetDir) {
  if (path.resolve(targetDir) === rootSource) {
    console.log('Cannot uninstall inside FlutterCrew source workspace.');
    return;
  }
  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Target directory '${targetDir}' does not exist.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nUninstalling FlutterCrew from: ${targetDir}...`);

  // 1. Remove .agents and .fluttercrew
  const agentsDir = path.join(targetDir, '.agents');
  if (fs.existsSync(agentsDir)) {
    fs.rmSync(agentsDir, { recursive: true, force: true });
    console.log('  ✓ Removed .agents/');
  }
  const runtimeDir = path.join(targetDir, '.fluttercrew');
  if (fs.existsSync(runtimeDir)) {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    console.log('  ✓ Removed .fluttercrew/');
  }

  // 2. Restore or remove core instruction files
  restoreOrRemove(targetDir, 'AGENTS.md');
  restoreOrRemove(targetDir, 'GEMINI.md');
  restoreOrRemove(targetDir, 'CLAUDE.md');
  restoreOrRemove(targetDir, '.cursorrules');

  // 3. Remove Copilot prompts and instructions
  const promptsDir = path.join(targetDir, '.github', 'prompts');
  if (fs.existsSync(promptsDir)) {
    fs.rmSync(promptsDir, { recursive: true, force: true });
    console.log('  ✓ Removed .github/prompts/');
  }
  const githubAgentsDir = path.join(targetDir, '.github', 'agents');
  if (fs.existsSync(githubAgentsDir)) {
    fs.rmSync(githubAgentsDir, { recursive: true, force: true });
    console.log('  ✓ Removed .github/agents/');
  }
  restoreOrRemove(targetDir, path.join('.github', 'copilot-instructions.md'));

  // If .github is empty, clean it up
  const githubDir = path.join(targetDir, '.github');
  if (fs.existsSync(githubDir)) {
    try {
      if (fs.readdirSync(githubDir).length === 0) {
        fs.rmdirSync(githubDir);
      }
    } catch { /* keep if not empty */ }
  }

  // 4. Restore VS Code settings if backup exists
  const settingsBak = path.join(targetDir, '.vscode', 'settings.json.bak');
  const settingsPath = path.join(targetDir, '.vscode', 'settings.json');
  if (fs.existsSync(settingsBak)) {
    fs.renameSync(settingsBak, settingsPath);
    console.log('  ✓ Restored .vscode/settings.json from settings.json.bak');
  }

  // 5. Clean up .gitignore
  const gitignorePath = path.join(targetDir, '.gitignore');
  const gitignoreBak = findLatestBackup(targetDir, '.gitignore');
  if (gitignoreBak && fs.existsSync(gitignoreBak)) {
    fs.copyFileSync(gitignoreBak, gitignorePath);
    console.log('  ✓ Restored .gitignore from backup');
  } else if (fs.existsSync(gitignorePath)) {
    let content = fs.readFileSync(gitignorePath, 'utf8');
    content = content
      .replace(/\n?# FlutterCrew local evidence[^\n]*\n\.fluttercrew\/\n\*\.fluttercrew-\*\.bak\n?/g, '')
      .replace(/\.fluttercrew\/\r?\n?/g, '')
      .replace(/\*\.fluttercrew-\*\.bak\r?\n?/g, '');
    fs.writeFileSync(gitignorePath, content, 'utf8');
    console.log('  ✓ Cleaned .gitignore entries');
  }

  // 6. Clean all remaining .fluttercrew-*.bak files
  cleanBackups(targetDir);

  console.log('\nFlutterCrew successfully uninstalled!\n');
}

function promptQuestion(rl, query, defaultVal) {
  return new Promise((resolve) => {
    rl.question(`${query} ${defaultVal ? `(${defaultVal}): ` : ': '}`, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

async function runInteractiveInit() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n============================================================');
  console.log('FlutterCrew — Flutter Project Scaffolder & AI Fleet Setup');
  console.log('============================================================\n');

  try {
    // 1. Project Name
    let projectName = await promptQuestion(rl, '📌 Enter Project Name (snake_case)', 'my_flutter_app');
    projectName = projectName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const projectDir = path.resolve(projectName);
    if (fs.existsSync(projectDir)) {
      console.log(`⚠️  Directory '${projectName}' already exists!`);
      const overwrite = await promptQuestion(rl, 'Proceed and install inside this folder? (y/n)', 'y');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Aborted.');
        rl.close();
        return;
      }
    }

    // 2. Platforms / OS
    console.log('\n📱 Target Platforms:');
    console.log('  1) Mobile only (iOS, Android)');
    console.log('  2) Mobile & Web (iOS, Android, Web)');
    console.log('  3) All platforms (iOS, Android, Web, macOS, Windows, Linux)');
    const platformChoice = await promptQuestion(rl, 'Select platforms (1-3)', '1');
    let platforms = 'ios,android';
    if (platformChoice === '2') platforms = 'ios,android,web';
    if (platformChoice === '3') platforms = 'ios,android,web,macos,windows,linux';

    // 3. Backend Choice
    console.log('\n⚡ Choose Backend:');
    console.log('  1) Supabase (PostgreSQL, Row Level Security, Realtime)');
    console.log('  2) Firebase (Firestore NoSQL, Security Rules, Firebase Auth)');
    console.log('  3) None / Custom API');
    const backendChoice = await promptQuestion(rl, 'Select backend (1-3)', '1');

    // 4. State Management
    console.log('\n🧠 State Management:');
    console.log('  1) BLoC / Cubit (flutter_bloc)');
    console.log('  2) Riverpod (flutter_riverpod)');
    console.log('  3) Provider');
    const stateChoice = await promptQuestion(rl, 'Select state management (1-3)', '1');

    rl.close();

    console.log('\n🔨 Step 1: Creating Flutter project via Flutter CLI...');
    if (!fs.existsSync(path.join(projectDir, 'pubspec.yaml'))) {
      execSync(`flutter create --platforms=${platforms} "${projectName}"`, {
        stdio: 'inherit',
      });
    }

    console.log('\n📦 Step 2: Adding required production dependencies...');
    const deps = ['flutter_secure_storage', 'go_router', 'intl'];
    const devDeps = ['mocktail', 'flutter_lints'];

    if (stateChoice === '1') {
      deps.push('flutter_bloc', 'equatable');
      devDeps.push('bloc_test');
    } else if (stateChoice === '2') {
      deps.push('flutter_riverpod');
    } else {
      deps.push('provider');
    }

    if (backendChoice === '1') {
      deps.push('supabase_flutter');
    } else if (backendChoice === '2' && !fs.existsSync(path.join(projectDir, 'firestore.rules'))) {
      deps.push('firebase_core', 'firebase_auth', 'cloud_firestore', 'firebase_storage');
    }

    execSync(`flutter pub add ${deps.join(' ')}`, { cwd: projectDir, stdio: 'inherit' });
    execSync(`flutter pub add --dev ${devDeps.join(' ')}`, { cwd: projectDir, stdio: 'inherit' });

    console.log('\n🏗️  Step 3: Generating MVVM Architecture folders...');
    const folders = [
      'lib/core/constants',
      'lib/core/errors',
      'lib/core/theme',
      'lib/core/utils',
      'lib/core/services',
      'lib/features/home/models',
      'lib/features/home/services',
      'lib/features/home/viewmodels',
      'lib/features/home/views/pages',
      'lib/features/home/views/widgets',
    ];

    if (backendChoice === '1') {
      folders.push('supabase/migrations');
      fs.mkdirSync(path.join(projectDir, 'supabase/migrations'), { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, '.env.example'),
        'SUPABASE_URL=https://your-project.supabase.co\nSUPABASE_ANON_KEY=your-anon-key\n'
      );
    } else if (backendChoice === '2') {
      fs.writeFileSync(
        path.join(projectDir, 'firestore.rules'),
        `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    // Deny by default. Replace with reviewed ownership/schema rules.\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}\n`
      );
    }

    folders.forEach((dir) => {
      fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
    });

    console.log('\nStep 4: Installing FlutterCrew AI Agent Fleet...');
    installAgentsTo(projectDir);

    console.log('\n============================================================');
    console.log(`Project '${projectName}' successfully created!`);
    console.log('============================================================');
    console.log(`\nNext steps:`);
    console.log(`  1) cd "${projectName}"`);
    console.log(`  2) code .`);
    console.log(`  3) Open Copilot Chat / Antigravity / Claude Code and type:`);
    console.log(`     /fluttercrew-deliver <requirements file>\n`);
    console.log('Backend packages are installed, not connected. Complete project setup and delivery gates.');
  } catch (err) {
    console.error('❌ Error during setup:', err.message);
    rl.close();
    process.exit(1);
  }
}

// Main execution switch
if (runtimeCommands.includes(arg)) {
  try {
    require('../.agents/runtime/crew.js').run(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else if (arg === 'uninstall' || arg === 'remove') {
  const targetDir = path.resolve(process.argv[3] || '.');
  uninstallAgentsFrom(targetDir);
} else if (arg === 'create' || arg === 'init' || arg === 'new') {
  runInteractiveInit();
} else {
  const targetDir = path.resolve(arg || '.');
  const pubspecPath = path.join(targetDir, 'pubspec.yaml');

  if (!fs.existsSync(pubspecPath) && !arg) {
    // If run in an empty directory without args, offer interactive project creation
    console.log('\nNo Flutter project detected in current directory.');
    console.log('Would you like to scaffold a new Flutter project?');
    runInteractiveInit();
  } else {
    console.log(`\nInstalling FlutterCrew into existing project: ${targetDir}`);
    installAgentsTo(targetDir);
    console.log('\nFlutterCrew installed successfully!\n');
  }
}

module.exports = { installAgentsTo, uninstallAgentsFrom };

