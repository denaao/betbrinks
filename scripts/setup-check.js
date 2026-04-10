/**
 * BetBrinks - Verificação rápida de setup
 * Executa: pnpm setup  ou  node scripts/setup-check.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const checks = [
  {
    name: 'Node.js >= 20',
    check: () => {
      const v = process.version.replace('v', '').split('.')[0];
      return parseInt(v) >= 20 ? `v${process.version}` : null;
    },
  },
  {
    name: 'pnpm instalado',
    check: () => {
      try { return execSync('pnpm -v', { encoding: 'utf8' }).trim(); } catch { return null; }
    },
  },
  {
    name: 'Docker rodando',
    check: () => {
      try { execSync('docker info', { stdio: 'ignore' }); return 'OK'; } catch { return null; }
    },
  },
  {
    name: '.env configurado',
    check: () => {
      const envPath = path.join(root, '.env');
      if (!fs.existsSync(envPath)) return null;
      const content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('CHANGE_ME') || content.includes('YOUR_API')) return 'INCOMPLETO';
      return 'OK';
    },
  },
  {
    name: 'API_FOOTBALL_KEY definida',
    check: () => {
      const envPath = path.join(root, '.env');
      if (!fs.existsSync(envPath)) return null;
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/API_FOOTBALL_KEY=(.+)/);
      if (!match || match[1].includes('YOUR_')) return null;
      return `${match[1].slice(0, 8)}...`;
    },
  },
  {
    name: 'node_modules instalados',
    check: () => {
      return fs.existsSync(path.join(root, 'node_modules')) ? 'OK' : null;
    },
  },
  {
    name: 'Prisma Client gerado',
    check: () => {
      const prismaClient = path.join(root, 'apps', 'api', 'node_modules', '.prisma');
      return fs.existsSync(prismaClient) ? 'OK' : null;
    },
  },
  {
    name: 'PostgreSQL acessivel',
    check: () => {
      try {
        execSync('docker exec betbrinks-postgres pg_isready -U betbrinks', { stdio: 'ignore' });
        return 'OK';
      } catch { return null; }
    },
  },
  {
    name: 'Redis acessivel',
    check: () => {
      try {
        const res = execSync('docker exec betbrinks-redis redis-cli ping', { encoding: 'utf8' }).trim();
        return res === 'PONG' ? 'OK' : null;
      } catch { return null; }
    },
  },
];

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  BetBrinks - Verificacao de Setup');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

let allOk = true;

for (const c of checks) {
  const result = c.check();
  if (result) {
    console.log(`  ✅ ${c.name}: ${result}`);
  } else {
    console.log(`  ❌ ${c.name}`);
    allOk = false;
  }
}

console.log('');
if (allOk) {
  console.log('  🎉 Tudo pronto! Execute: pnpm dev');
} else {
  console.log('  ⚠️  Alguns itens precisam de atencao.');
  console.log('  Execute: scripts\\setup.bat (Windows) ou bash scripts/setup.sh (Mac/Linux)');
}
console.log('');
