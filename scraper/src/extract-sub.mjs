import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('extracted_subtitles');

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function findMkvFile(dir = '.') {
  const files = fs.readdirSync(dir);
  const mkv = files.find((f) => f.endsWith('.mkv'));
  if (mkv) return path.join(dir, mkv);
  const mp4 = files.find((f) => f.endsWith('.mp4'));
  if (mp4) return path.join(dir, mp4);
  return null;
}

export async function extractSubtitle(inputUrl, outputName) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const workDir = path.resolve('temp_work');
  if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  const safeName = (outputName || 'subtitle')
    .replace(/[^a-zA-Z0-9_\u0600-\u06FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const targetSubDir = path.join(OUT_DIR, safeName);
  fs.mkdirSync(targetSubDir, { recursive: true });

  console.log(`\n🎬 Starting extraction for: ${safeName}`);
  console.log(`🔗 Source URL: ${inputUrl}`);

  // 1. Download source file
  if (inputUrl.includes('.torrent') || inputUrl.includes('nyaa.si')) {
    console.log('\n📥 Downloading via Torrent (aria2c)...');
    run(`aria2c --seed-time=0 --max-connection-per-server=16 --split=16 --summary-interval=5 --dir="${workDir}" "${inputUrl}"`);
  } else if (inputUrl.includes('mega.nz')) {
    console.log('\n📥 Downloading from MEGA (megatools)...');
    try {
      run(`megatools dl --path "${workDir}" "${inputUrl}"`);
    } catch (e) {
      console.log('Megatools fallback: trying python mega-download...');
      run(`python3 -m pip install mega.py && python3 -c "from mega import Mega; m = Mega(); m.login(); m.download_url('${inputUrl}', '${workDir}')"`);
    }
  } else if (inputUrl.startsWith('http')) {
    console.log('\n📥 Downloading direct file...');
    run(`aria2c --dir="${workDir}" "${inputUrl}"`);
  } else {
    // Local file path
    if (fs.existsSync(inputUrl)) {
      const dest = path.join(workDir, path.basename(inputUrl));
      fs.copyFileSync(inputUrl, dest);
    }
  }

  const videoFile = findMkvFile(workDir);
  if (!videoFile) {
    throw new Error('No video file (.mkv / .mp4) found after download.');
  }

  console.log(`\n📦 Video file found: ${path.basename(videoFile)} (${(fs.statSync(videoFile).size / (1024 * 1024)).toFixed(1)} MB)`);

  // 2. Inspect tracks using mkvmerge / ffmpeg
  let trackExtracted = false;
  try {
    const infoRaw = spawnSync('mkvmerge', ['-J', videoFile], { encoding: 'utf8' });
    if (infoRaw.stdout) {
      const info = JSON.parse(infoRaw.stdout);
      const subTracks = (info.tracks || []).filter((t) => t.type === 'subtitles');
      const attachments = (info.attachments || []).filter((a) => /\.(ttf|otf|ttc)$/i.test(a.file_name || ''));

      console.log(`Found ${subTracks.length} subtitle track(s) and ${attachments.length} font attachment(s).`);

      // Extract subtitle tracks
      for (let i = 0; i < subTracks.length; i++) {
        const trk = subTracks[i];
        const codec = (trk.codec || '').toLowerCase();
        const ext = codec.includes('subrip') || codec.includes('srt') ? 'srt' : 'ass';
        const lang = trk.properties?.language || `track${trk.id}`;
        const subOut = path.join(targetSubDir, `${safeName}_${lang}.${ext}`);
        console.log(`⚡ Extracting Subtitle Track #${trk.id} (${trk.properties?.track_name || lang}) -> ${path.basename(subOut)}`);
        run(`mkvextract tracks "${videoFile}" ${trk.id}:"${subOut}"`);
        trackExtracted = true;
      }

      // Extract fonts if any
      if (attachments.length > 0) {
        const fontsDir = path.join(targetSubDir, 'fonts');
        fs.mkdirSync(fontsDir, { recursive: true });
        const extractArgs = attachments.map((a) => `${a.id}:"${path.join(fontsDir, a.file_name)}"`).join(' ');
        console.log(`🔤 Extracting ${attachments.length} font(s) into fonts/`);
        run(`mkvextract attachments "${videoFile}" ${extractArgs}`);
      }
    }
  } catch (err) {
    console.warn('mkvextract failed or not found, falling back to ffmpeg:', err.message);
  }

  // Fallback to ffmpeg if mkvextract didn't run
  if (!trackExtracted) {
    const fallbackAss = path.join(targetSubDir, `${safeName}.ass`);
    console.log(`⚡ Extracting with FFmpeg -> ${path.basename(fallbackAss)}`);
    run(`ffmpeg -y -i "${videoFile}" -map 0:s:0 -c:s copy "${fallbackAss}"`);
  }

  // 3. Clean up heavy video file immediately to free disk
  console.log('\n🧹 Cleaning up temporary video files...');
  fs.rmSync(workDir, { recursive: true, force: true });

  console.log(`\n🎉 Extraction Complete! Output saved in:\n   📁 ${targetSubDir}`);
  const results = fs.readdirSync(targetSubDir);
  for (const f of results) console.log(`   - ${f}`);
  return targetSubDir;
}

if (process.argv[1]?.endsWith('extract-sub.mjs')) {
  const url = process.argv[2] || 'https://nyaa.si/download/2151962.torrent';
  const name = process.argv[3] || 'Clevatess_II_08';
  extractSubtitle(url, name).catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
}
