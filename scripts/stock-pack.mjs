// AI 종목 분석 결과(work/out/report.md + meta.json)를 암호화해 reports 브랜치 작업 폴더의 s/ 에 넣는다.
//   node scripts/stock-pack.mjs work/out rep
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { sitePassword, encrypt } from './gate.mjs';
const [outDir, repDir] = process.argv.slice(2);
const meta = JSON.parse(readFileSync(join(outDir, 'meta.json'), 'utf8')), md = readFileSync(join(outDir, 'report.md'), 'utf8');
meta.id = `${meta.market}_${meta.code}_${meta.created.replace(/[-:T+]/g, '').slice(0, 12)}`;
mkdirSync(join(repDir, 's'), { recursive: true });
writeFileSync(join(repDir, 's', `${meta.id}.json.enc.json`), JSON.stringify(encrypt(JSON.stringify({ meta, md }), sitePassword())));
console.log('게시:', meta.id, md.length + '자');
